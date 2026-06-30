import os
from datetime import datetime
from typing import Any

import httpx
import numpy as np
from sqlalchemy import JSON, Column, DateTime, Integer, String, Text, text
from sqlalchemy.orm import Session

from ...database import Base, engine
from ...logging_config import logger

# Try loading pgvector, otherwise use fallback dummy type
try:
    from pgvector.sqlalchemy import Vector
    PGVECTOR_AVAILABLE = True
except ImportError:
    PGVECTOR_AVAILABLE = False
    # Dummy type placeholder for non-Postgres systems (like local SQLite development)
    from sqlalchemy.types import UserDefinedType
    class DummyVector(UserDefinedType):
        def __init__(self, dim=384):
            self.dim = dim
        def get_col_spec(self, **kw):
            return f"FLOAT[{self.dim}]"
    Vector = DummyVector

# Dimension for embeddings. We'll use 384 (all-minilm dimension) or 768 (nomic-embed-text)
EMBEDDING_DIM = 384
EMBEDDING_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "all-minilm")

class SemanticMemory(Base):
    __tablename__ = "semantic_memory"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    dataset_id = Column(Integer, index=True, nullable=True)
    category = Column(String(50), nullable=False)  # 'question', 'report', 'insight', 'forecast', 'dataset'
    content = Column(Text, nullable=False)
    metadata_json = Column(JSON, nullable=True)
    embedding = Column(Vector(EMBEDDING_DIM), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class VectorStore:
    def __init__(self):
        self.ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.is_postgres = engine.dialect.name == "postgresql"

        # Enable extension if Postgres
        if self.is_postgres and PGVECTOR_AVAILABLE:
            try:
                with engine.connect() as conn:
                    # pgvector extension creation
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                    conn.commit()
                logger.info("Successfully registered pgvector extension in PostgreSQL.")
            except Exception as e:
                logger.warning(f"Failed to auto-register pgvector extension: {e}")

        # Build table
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Successfully initialized semantic_memory table schema.")
        except Exception as e:
            logger.error(f"Error creating semantic_memory schemas: {e}")

    async def get_embedding(self, text_input: str) -> list[float]:
        """
        Retrieves text vector embeddings from local Ollama instance.
        Falls back to hash-based determinism if Ollama is unavailable.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    f"{self.ollama_url}/api/embeddings",
                    json={"model": EMBEDDING_MODEL, "prompt": text_input}
                )
                if res.status_code == 200:
                    embedding = res.json().get("embedding", [])
                    # Match embedding dimension by padding/slicing if needed
                    if len(embedding) > EMBEDDING_DIM:
                        return embedding[:EMBEDDING_DIM]
                    elif len(embedding) < EMBEDDING_DIM:
                        return embedding + [0.0] * (EMBEDDING_DIM - len(embedding))
                    return embedding
                else:
                    raise Exception(f"Ollama returned status code {res.status_code}: {res.text}")
        except Exception as e:
            logger.warning(f"Ollama embeddings call failed: {e}. Falling back to deterministic local mock vector.")

        # Deterministic mock fallback (reproducible vectors from string hash values)
        np.random.seed(sum(ord(c) for c in text_input) % 10000)
        mock_vec = np.random.uniform(-0.5, 0.5, EMBEDDING_DIM).tolist()
        return mock_vec

    async def add_memory(
        self,
        db: Session,
        user_id: int,
        category: str,
        content: str,
        dataset_id: int | None = None,
        metadata: dict[str, Any] | None = None
    ) -> SemanticMemory:
        """
        Inserts a new semantic memory block with generated embeddings.
        """
        vector = await self.get_embedding(content)
        memory = SemanticMemory(
            user_id=user_id,
            dataset_id=dataset_id,
            category=category,
            content=content,
            metadata_json=metadata or {},
            embedding=vector
        )
        db.add(memory)
        db.commit()
        db.refresh(memory)
        return memory

    async def search_memory(
        self,
        db: Session,
        user_id: int,
        query: str,
        dataset_id: int | None = None,
        category: str | None = None,
        limit: int = 5
    ) -> list[dict[str, Any]]:
        """
        Performs semantic similarity search. Uses pgvector on Postgres,
        or NumPy cosine similarity fallback on SQLite.
        """
        query_vector = await self.get_embedding(query)

        # Build base filter
        filters = [SemanticMemory.user_id == user_id]
        if dataset_id is not None:
            filters.append(SemanticMemory.dataset_id == dataset_id)
        if category is not None:
            filters.append(SemanticMemory.category == category)

        # 1. Native pgvector database query
        if self.is_postgres and PGVECTOR_AVAILABLE:
            try:
                # pgvector cosine distance operator is <=>
                # We sort by cosine distance ascending (closer distance = higher similarity)
                query_filter = SemanticMemory.embedding.cosine_distance(query_vector)
                memories = db.query(SemanticMemory).filter(*filters).order_by(query_filter).limit(limit).all()

                results = []
                for m in memories:
                    results.append({
                        "id": m.id,
                        "category": m.category,
                        "content": m.content,
                        "metadata": m.metadata_json,
                        "created_at": m.created_at.isoformat(),
                        "score": 1.0 - float(db.scalar(text("SELECT :vec <=> :mem_emb").bindparams(
                            vec=query_vector, mem_emb=m.embedding
                        )) or 0.0)
                    })
                return results
            except Exception as e:
                logger.error(f"PostgreSQL pgvector search failed: {e}. Falling back to NumPy memory search.")

        # 2. SQLite / NumPy memory query fallback
        try:
            memories = db.query(SemanticMemory).filter(*filters).all()
            if not memories:
                return []

            mem_vectors = [m.embedding for m in memories if m.embedding is not None]
            if not mem_vectors:
                return []

            # Cosine similarity calculations via numpy
            u = np.array(query_vector)
            scores = []

            for m in memories:
                v = np.array(m.embedding)
                dot_product = np.dot(u, v)
                norm_u = np.linalg.norm(u)
                norm_v = np.linalg.norm(v)

                similarity = float(dot_product / (norm_u * norm_v)) if norm_u > 0 and norm_v > 0 else 0.0
                scores.append((similarity, m))

            # Sort descending by similarity score
            scores.sort(key=lambda x: x[0], reverse=True)

            results = []
            for score, m in scores[:limit]:
                results.append({
                    "id": m.id,
                    "category": m.category,
                    "content": m.content,
                    "metadata": m.metadata_json,
                    "created_at": m.created_at.isoformat(),
                    "score": score
                })
            return results
        except Exception as e:
            logger.error(f"Fallback NumPy memory similarity search failed: {e}")
            return []
