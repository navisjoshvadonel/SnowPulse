import logging
import os
from typing import Any

import meilisearch
from meilisearch.errors import MeilisearchError

logger = logging.getLogger("snowpulse.search")

MEILI_HOST = os.getenv("MEILI_HOST", "http://localhost:7700")
MEILI_MASTER_KEY = os.getenv("MEILI_MASTER_KEY", "masterKey123")

class SearchService:
    """
    Service layer wrapping Meilisearch for ultra-fast, typo-tolerant, faceted search.
    """
    def __init__(self):
        try:
            self.client = meilisearch.Client(MEILI_HOST, MEILI_MASTER_KEY, timeout=2.0)
            self.enabled = True
            if os.getenv("ENV") != "testing":
                self.bootstrap_indices()
            logger.info(f"Meilisearch client connected to host: {MEILI_HOST}")
        except Exception as e:
            self.client = None
            self.enabled = False
            logger.error(f"Failed to initialize Meilisearch client: {e}")

    def bootstrap_indices(self) -> None:
        """
        Creates indices and configures settings (filterable and searchable attributes).
        We use a unified search index 'snowpulse_resources' to search across multiple resource types easily,
        or we can partition them. A single unified index is best for multi-resource global search!
        """
        index_name = "snowpulse_resources"
        try:
            # Create index if it does not exist
            self.client.create_index(index_name, {"primaryKey": "id"})
            index = self.client.index(index_name)

            # Configure settings
            index.update_filterable_attributes([
                "resource_type",
                "user_id",
                "dataset_id",
                "severity"
            ])
            index.update_searchable_attributes([
                "title",
                "name",
                "description",
                "content",
                "insight_notes",
                "category"
            ])
            logger.info("Meilisearch unified index 'snowpulse_resources' bootstrapped successfully.")
        except Exception as e:
            self.enabled = False
            logger.warning(f"Meilisearch host offline or bootstrap failed: {e}. Search service disabled.")

    def index_document(self, resource_type: str, document: dict[str, Any]) -> None:
        """
        Indexes or updates a single resource document.
        The document must have an 'id' field.
        We format the id to be unique across all resources, e.g. '{resource_type}_{original_id}'.
        """
        if not self.enabled or not self.client:
            return

        doc_id = f"{resource_type}_{document.get('id')}"
        search_doc = {
            "id": doc_id,
            "resource_id": document.get("id"),
            "resource_type": resource_type,
            "user_id": document.get("user_id"),
            "dataset_id": document.get("dataset_id"),
            "title": document.get("title") or document.get("name") or "",
            "description": document.get("description") or document.get("insight_notes") or "",
            "content": document.get("content") or "",
            "category": document.get("category") or "",
            "severity": document.get("severity") or "info",
            "created_at": document.get("created_at")
        }

        try:
            self.client.index("snowpulse_resources").add_documents([search_doc])
            logger.info(f"Indexed resource '{doc_id}' in Meilisearch.")
        except MeilisearchError as e:
            logger.error(f"Failed to index document {doc_id}: {e}")

    def delete_document(self, resource_type: str, original_id: str) -> None:
        """
        Removes a document from the search index.
        """
        if not self.enabled or not self.client:
            return

        doc_id = f"{resource_type}_{original_id}"
        try:
            self.client.index("snowpulse_resources").delete_document(doc_id)
            logger.info(f"Deleted document '{doc_id}' from Meilisearch index.")
        except MeilisearchError as e:
            logger.error(f"Failed to delete document {doc_id}: {e}")

    def search(
        self,
        query: str,
        user_id: int | None = None,
        resource_type: str | None = None,
        limit: int = 20,
        offset: int = 0
    ) -> dict[str, Any]:
        """
        Performs typo-tolerant full-text search.
        """
        if not self.enabled or not self.client:
            return {"hits": [], "nbHits": 0, "exhaustiveNbHits": False, "limit": limit, "offset": offset, "processingTimeMs": 0, "query": query}

        filter_queries = []
        if user_id is not None:
            filter_queries.append(f"user_id = {user_id}")
        if resource_type is not None:
            filter_queries.append(f"resource_type = '{resource_type}'")

        options = {
            "limit": limit,
            "offset": offset,
        }
        if filter_queries:
            options["filter"] = " AND ".join(filter_queries)

        try:
            return self.client.index("snowpulse_resources").search(query, options)
        except MeilisearchError as e:
            logger.error(f"Search failed for query '{query}': {e}")
            return {"hits": [], "nbHits": 0, "error": str(e)}

    def reindex_all_resources(self, db_session) -> dict[str, Any]:
        """
        Synchronous database fetch and indexing.
        Should be invoked inside a background task to prevent blocking HTTP workers.
        """
        if not self.enabled or not self.client:
            return {"indexed": 0}

        from ..models import Dataset, UserDashboard
        # Fetch Dashboards
        dashboards = db_session.query(UserDashboard).all()
        datasets = db_session.query(Dataset).all()

        docs = []
        for d in dashboards:
            docs.append({
                "id": f"dashboard_{d.id}",
                "resource_id": d.id,
                "resource_type": "dashboard",
                "user_id": d.user_id,
                "dataset_id": d.dataset_id,
                "title": d.title,
                "description": d.insight_notes or "",
                "content": f"Query history: {str(d.query_history or '')}",
                "created_at": d.created_at.isoformat() if d.created_at else None
            })

        for ds in datasets:
            docs.append({
                "id": f"dataset_{ds.id}",
                "resource_id": ds.id,
                "resource_type": "dataset",
                "user_id": None, # Shared dataset
                "dataset_id": ds.id,
                "title": ds.name,
                "description": ds.description or "",
                "content": f"File path: {ds.file_path}",
                "created_at": ds.created_at.isoformat() if ds.created_at else None
            })

        try:
            index = self.client.index("snowpulse_resources")
            # Clear index
            index.delete_all_documents()
            # Batch add documents
            if docs:
                index.add_documents(docs)
            logger.info(f"Reindexed all resources. Total documents: {len(docs)}")
            return {"indexed": len(docs)}
        except MeilisearchError as e:
            logger.error(f"Reindexing failed: {e}")
            return {"indexed": 0, "error": str(e)}

# Global search service instance
search_service = SearchService()
