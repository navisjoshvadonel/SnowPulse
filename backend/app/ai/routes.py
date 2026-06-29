import os
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, Dataset
from .gateway.client import OllamaClient
from .memory.vector_store import VectorStore
from .graphs.supervisor import run_supervisor_workflow
from .tools.database_tools import DatabaseTools
from .workflows.reports import ReportGenerator
from .evaluation.evaluator import AIEvaluator
from ..logging_config import logger

router = APIRouter(prefix="/api/ai", tags=["AI Intelligence Layer"])

# Instantiate global engines
ollama_client = OllamaClient()
vector_store = VectorStore()

# Request schemas
class ChatRequest(BaseModel):
    query: str
    dataset_id: Optional[int] = None

class AnalyzeRequest(BaseModel):
    dataset_id: int

class ReportRequest(BaseModel):
    query: str
    report_type: str  # 'executive', 'kpi', 'forecast', 'operational'
    dataset_id: Optional[int] = None

class ForecastRequest(BaseModel):
    dataset_id: int
    steps: Optional[int] = 30

@router.post("/chat")
async def chat_endpoint(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Server-Sent Events endpoint streaming supervisor multi-agent thoughts and token-by-token final answers.
    """
    logger.info("ai.chat_request", user_id=current_user.id, query=req.query, dataset_id=req.dataset_id)
    
    # 1. Build execution context
    context = {"user_id": current_user.id}
    
    if req.dataset_id:
        dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        # Enforce that path absolute or exists
        context["dataset_path"] = dataset.file_path
        context["dataset_id"] = dataset.id
        context["dataset_name"] = dataset.name

    async def sse_generator():
        try:
            # First, check memory store for similar historical conversations
            memories = await vector_store.search_memory(
                db=db,
                user_id=current_user.id,
                query=req.query,
                dataset_id=req.dataset_id,
                limit=2
            )
            if memories:
                history_str = "\n".join([f"- Past Q&A: {m['content']}" for m in memories])
                context["historical_memory"] = history_str
                yield f"data: {json.dumps({'type': 'reasoning', 'content': 'Retrieved historical context from vector memory.'})}\n\n"

            # Execute LangGraph supervisor workflow
            full_response = []
            async for event in run_supervisor_workflow(req.query, context, db):
                event_type = event.get("type", "reasoning")
                content = event.get("data", "")
                
                if event_type == "output":
                    full_response.append(content)
                    yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'reasoning', 'content': content})}\n\n"

            # After successful response, write question and compiled answer into semantic memory
            if full_response:
                complete_answer = "".join(full_response)
                memory_content = f"Question: {req.query}\nAnswer: {complete_answer}"
                await vector_store.add_memory(
                    db=db,
                    user_id=current_user.id,
                    category="question",
                    content=memory_content,
                    dataset_id=req.dataset_id,
                    metadata={"query": req.query}
                )
                
        except Exception as e:
            logger.error(f"SSE execution error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': f'Execution failed: {str(e)}'})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@router.post("/analyze")
async def analyze_endpoint(
    req: AnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers Polars engine parsing to retrieve general dataset KPIs, correlation matrix, and anomaly flags.
    """
    dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    stats = DatabaseTools.get_dataset_statistics(dataset.file_path)
    if not stats.get("success"):
        raise HTTPException(status_code=400, detail=stats.get("error"))
        
    return stats

@router.post("/report")
async def report_endpoint(
    req: ReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compiles a multi-agent analytical summary, renders a professional PDF, uploads to MinIO,
    and returns S3 download URLs.
    """
    logger.info("ai.report_request", user_id=current_user.id, type=req.report_type)
    
    # 1. Ask Supervisor Report Agent to build markdown content
    context = {"user_id": current_user.id}
    if req.dataset_id:
        dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
        if dataset:
            context["dataset_path"] = dataset.file_path
            context["dataset_id"] = dataset.id
            context["dataset_name"] = dataset.name
            
    # Gather statistics to inject
    stats = {}
    if req.dataset_id and "dataset_path" in context:
        stats = DatabaseTools.get_dataset_statistics(context["dataset_path"])
        
    prompt = f"""
Compose a comprehensive executive {req.report_type} report.
User Objective: "{req.query}"
Dataset Statistics Context:
{json.dumps(stats, indent=2)}
"""
    system_prompt = "You are the Executive Report Agent. Format a detailed analytical summary in clean markdown."
    
    # Retrieve Markdown
    markdown_content = await ollama_client.generate(prompt, system_prompt, model="qwen2.5:7b")
    
    # 2. Render and upload PDF
    try:
        obj_path, presigned_url = await ReportGenerator.generate_and_upload_report(
            markdown_content=markdown_content,
            report_type=req.report_type,
            user_id=current_user.id,
            dataset_id=req.dataset_id
        )
        
        # Save reference to vector store for semantic memory searches
        await vector_store.add_memory(
            db=db,
            user_id=current_user.id,
            category="report",
            content=f"Report Title: {req.report_type.upper()} Analytical Summary\nSummary:\n{markdown_content[:300]}...",
            dataset_id=req.dataset_id,
            metadata={"object_path": obj_path, "report_type": req.report_type}
        )
        
        return {
            "success": True,
            "report_type": req.report_type,
            "object_path": obj_path,
            "presigned_url": presigned_url,
            "markdown_preview": markdown_content
        }
    except Exception as e:
        logger.error(f"Report workflow execution failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate report PDF: {str(e)}")

@router.post("/forecast")
async def forecast_endpoint(
    req: ForecastRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Computes time-series scenario predictions (baseline vs optimistic vs pessimistic growth paths).
    """
    dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    scenarios = DatabaseTools.get_forecast_scenarios(req.dataset_id, steps=req.steps)
    if not scenarios.get("success"):
        raise HTTPException(status_code=400, detail=scenarios.get("error"))
        
    return scenarios

@router.get("/models")
async def models_endpoint(current_user: User = Depends(get_current_user)):
    """
    Lists active models registered inside local Ollama instance.
    """
    models = await ollama_client.get_available_models()
    return {"models": models}

@router.get("/health")
async def health_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns aggregated metrics and connection states of local AI backend.
    """
    ollama_health = await ollama_client.check_health()
    
    # Vector store count
    vector_ok = True
    record_count = 0
    try:
        from .memory.vector_store import SemanticMemory
        record_count = db.query(SemanticMemory).count()
    except Exception:
        vector_ok = False
        
    return {
        "status": "healthy" if (ollama_health.get("status") == "healthy" and vector_ok) else "degraded",
        "ollama": ollama_health,
        "vector_memory": {
            "connected": vector_ok,
            "records_stored": record_count
        }
    }

@router.get("/eval")
async def eval_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Runs the automated evaluation pipeline and scores latency, routing, security, and overlaps.
    """
    results = await AIEvaluator.run_full_evaluation_suite(db)
    return results
