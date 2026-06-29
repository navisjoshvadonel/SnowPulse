import datetime
import os
import shutil
import time
import uuid
from typing import Any

from fastapi import Cookie, Depends, FastAPI, File, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session

from .ai.gemini_service import GeminiService
from .analytics.engine import AnalyticsEngine
from .auth import (
    ALGORITHM,
    JWT_REFRESH_SECRET_KEY,
    JWT_SECRET_KEY,
    create_access_token,
    create_refresh_token,
    delete_refresh_token_cookie,
    get_password_hash,
    set_refresh_token_cookie,
    verify_password,
)
from .cache.cache_service import cache_service
from .database import Base, SessionLocal, engine, get_db
from .dependencies import get_current_user, verify_dashboard_ownership
from .limiter import limiter
from .logging_config import configure_logging, logger
from .models import Dataset, RefreshToken, User, UserDashboard, Insight
from .monitoring import run_liveness_check, run_readiness_check, get_metrics_response
from .schemas import (
    DashboardCreate,
    DashboardResponse,
    DatasetResponse,
    TokenResponse,
    UserCreate,
    UserResponse,
    JobSubmission,
    JobStatusResponse,
    InsightResponse,
)
from .storage.service import storage_service
from .search.service import search_service
from .jobs.manager import JobManager
from .forecasting.predictor import ForecastingPredictor
from .ml.serving import MLServing

# Initialize logging
configure_logging()

gemini_service = GeminiService()

class QueryRequest(BaseModel):
    query: str

# Initialize database schemas
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SnowPulse AI Secure Backend",
    description="Multi-tenant backend demonstrating strict user isolation, cookie-based refresh tokens, and GDPR compliance.",
    version="1.0.0"
)

# SlowAPI setup
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS setup: allow credentials to enable secure HttpOnly cookie transport
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .ai.routes import router as ai_router

app.include_router(ai_router)

# Structured Logging Middleware
@app.middleware("http")
async def log_request_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    start_time = time.time()

    # Try resolving user from token if Authorization header is present
    user_id = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
            email = payload.get("sub")
            if email:
                user_id = email
        except Exception:
            pass

    response = await call_next(request)

    duration = time.time() - start_time
    logger.info(
        "http.request",
        request_id=request_id,
        user_id=user_id,
        method=request.method,
        endpoint=request.url.path,
        execution_time=f"{duration:.4f}s",
        status_code=response.status_code
    )

    response.headers["X-Request-ID"] = request_id
    return response


@app.on_event("startup")
def bootstrap_shared_datasets():
    """
    On startup, verify if some shared datasets exist.
    If not, create them so multiple tenants have shared access to the same analytics datasets.
    """
    db = next(get_db())
    try:
        if db.query(Dataset).count() == 0:
            default_datasets = [
                Dataset(
                    name="Global Sales Performance",
                    description="Standard transactions and regional metrics dataset containing columns for Date, Revenue, and Outliers.",
                    file_path="./test_sales_data.csv"
                ),
                Dataset(
                    name="Marketing Operations Matrix",
                    description="Shared marketing dataset containing campaign spend statistics, click-through rates, and conversion metrics.",
                    file_path="./test_marketing_data.csv"
                )
            ]
            db.add_all(default_datasets)
            db.commit()
    except Exception as e:
        print(f"Error bootstrapping data: {e}")
    finally:
        db.close()


# --- AUTHENTICATION ENDPOINTS ---

@app.post("/api/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new tenant account.
    """
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    hashed_pwd = get_password_hash(user_in.password)
    new_user = User(
        email=user_in.email,
        hashed_password=hashed_pwd
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/api/auth/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login_user(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Verifies user credentials.
    Issues a short-lived access token in the JSON response,
    and sets a long-lived refresh token in an HttpOnly cookie.
    """
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Create short-lived access token
    access_token = create_access_token(data={"sub": user.email})

    # 2. Create long-lived refresh token
    refresh_token_jwt = create_refresh_token(data={"sub": user.email})

    # 3. Store refresh token in database (for session tracking & revocation capabilities)
    expiry = datetime.datetime.utcnow() + datetime.timedelta(days=7)
    db_refresh_token = RefreshToken(
        token=refresh_token_jwt,
        user_id=user.id,
        expires_at=expiry
    )
    db.add(db_refresh_token)
    db.commit()

    # 4. Set HttpOnly, SameSite cookie
    set_refresh_token_cookie(response, refresh_token_jwt)

    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/auth/refresh", response_model=TokenResponse)
def refresh_access_token(
    response: Response,
    refresh_token: str | None = Cookie(None),
    db: Session = Depends(get_db)
):
    """
    Rotates access token. Looks up the HttpOnly refresh token cookie,
    verifies validity against DB, and returns a new Access Token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate refresh token session",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not refresh_token:
        raise credentials_exception

    try:
        payload = jwt.decode(refresh_token, JWT_REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        if email is None or token_type != "refresh":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Query DB to make sure token exists, belongs to the user, and is not revoked
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token,
        RefreshToken.revoked is False,
        RefreshToken.expires_at > datetime.datetime.utcnow()
    ).first()

    if not db_token:
        raise credentials_exception

    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user or not user.is_active:
        raise credentials_exception

    # Generate new access token
    new_access_token = create_access_token(data={"sub": user.email})
    return {"access_token": new_access_token, "token_type": "bearer"}


@app.post("/api/auth/logout")
def logout(
    response: Response,
    refresh_token: str | None = Cookie(None),
    db: Session = Depends(get_db)
):
    """
    Log out the user: revokes the refresh token from the database,
    and deletes the client-side HttpOnly cookie.
    """
    if refresh_token:
        db_token = db.query(RefreshToken).filter(RefreshToken.token == refresh_token).first()
        if db_token:
            db_token.revoked = True
            db.commit()

    delete_refresh_token_cookie(response)
    return {"detail": "Logged out successfully"}


@app.get("/api/user/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns details of the currently authenticated tenant user.
    """
    return current_user


# --- DATA ACCESS ENDPOINTS (Logical Tenant Isolation) ---

@app.get("/api/datasets", response_model=list[DatasetResponse])
def get_datasets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch all shared datasets.
    Requires any active registered user credentials to read metadata.
    """
    return db.query(Dataset).all()


@app.get("/api/dashboards", response_model=list[DashboardResponse])
@limiter.limit("100/minute")
def get_user_dashboards(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch user dashboards.
    Strictly filters records by the current_user.id. Users cannot query other user's data.
    """
    return db.query(UserDashboard).filter(UserDashboard.user_id == current_user.id).all()


@app.post("/api/dashboards", response_model=DashboardResponse)
@limiter.limit("100/minute")
def create_user_dashboard(
    request: Request,
    dashboard_in: DashboardCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a private user dashboard linked to a shared dataset.
    The user_id is populated from the authenticated token session rather than client input.
    """
    # Verify dataset exists
    dataset = db.query(Dataset).filter(Dataset.id == dashboard_in.dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared dataset not found"
        )

    db_dashboard = UserDashboard(
        user_id=current_user.id,
        dataset_id=dashboard_in.dataset_id,
        title=dashboard_in.title,
        insight_notes=dashboard_in.insight_notes,
        query_history=dashboard_in.query_history or []
    )
    db.add(db_dashboard)
    db.commit()
    db.refresh(db_dashboard)
    return db_dashboard


@app.get("/api/dashboards/{dashboard_id}", response_model=DashboardResponse)
@limiter.limit("100/minute")
def get_single_dashboard(
    request: Request,
    dashboard: UserDashboard = Depends(verify_dashboard_ownership)
):
    """
    Fetch details of a specific dashboard session.
    Enforces route-level ownership validation dependency.
    """
    return dashboard


# --- PRIVACY PURGE (GDPR Compliance - Right to be Forgotten) ---

@app.delete("/api/user/account", status_code=status.HTTP_200_OK)
def delete_user_account(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    GDPR Purge Endpoint.
    Fully deletes the user's main profile. Due to database-level CASCADE rules,
    all linked dashboards (insights, queries) and session refresh tokens
    are instantly and permanently deleted from the persistent database.
    Does NOT affect the shared datasets table.
    """
    try:
        # Perform permanent hard delete on user
        user_id = current_user.id
        
        # Purge MinIO reports referenced in semantic memory
        from .ai.memory.vector_store import SemanticMemory
        reports = db.query(SemanticMemory).filter(
            SemanticMemory.user_id == user_id,
            SemanticMemory.category == "report"
        ).all()
        for report in reports:
            meta = report.metadata_json or {}
            obj_path = meta.get("object_path")
            if obj_path and obj_path.startswith("minio://reports/"):
                filename = obj_path.replace("minio://reports/", "")
                try:
                    storage_service.delete_file("reports", filename)
                except Exception as e:
                    logger.warning(f"Failed to delete report file {filename} during GDPR purge: {e}")
                    
        # Delete database-level semantic memories
        db.query(SemanticMemory).filter(SemanticMemory.user_id == user_id).delete()
        
        db.delete(current_user)
        db.commit()

        # Clear the HttpOnly session cookie
        delete_refresh_token_cookie(response)

        return {
            "status": "success",
            "message": f"Account registration for {current_user.email} and all associated private dashboards, credentials, and profiles have been completely purged from the system in compliance with GDPR guidelines."
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while purging user data: {str(e)}"
        )


# --- DATASET UPLOAD & POLARS/GEMINI ANALYTICS ENDPOINTS ---

@app.post("/api/datasets/upload", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a custom CSV or Excel dataset, persist in MinIO, and trigger the analytics pipeline.
    """
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ('csv', 'xlsx', 'xls'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV and Excel (.xlsx, .xls) files are supported."
        )

    try:
        content_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file stream: {str(e)}"
        )

    # 1. Upload to MinIO S3
    file_key = f"{datetime.datetime.utcnow().timestamp()}_{file.filename}"
    try:
        storage_service.upload_file(
            bucket_name="datasets",
            object_name=file_key,
            data=content_bytes,
            content_type=file.content_type or "application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload dataset to storage server: {str(e)}"
        )

    # 2. Save metadata in DB
    db_dataset = Dataset(
        name=file.filename.rsplit('.', 1)[0],
        description=f"Uploaded by {current_user.email} (In-flight validation)",
        file_path=f"minio://datasets/{file_key}"
    )
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)

    # 3. Trigger asynchronous background pipeline coordinator
    job_id = None
    try:
        job_id = await JobManager.submit_job(
            "process_pipeline_task",
            dataset_id=db_dataset.id,
            file_key=file_key,
            original_filename=file.filename
        )
    except Exception as e:
        logger.error(f"Failed to enqueue background pipeline for dataset {db_dataset.id}: {e}")

    db_dataset.job_id = job_id
    return db_dataset


@app.get("/api/analytics/summary/{dataset_id}")
@limiter.limit("60/minute")
def get_analytics_summary(
    request: Request,
    dataset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve statistical summaries, ECharts structures, anomalies, and correlations.
    """
    kpi_key = f"kpis:{dataset_id}"
    trend_key = f"trends:{dataset_id}"
    geo_key = f"geo:{dataset_id}"
    anom_key = f"anomalies:{dataset_id}"
    corr_key = f"correlations:{dataset_id}"

    kpis = cache_service.get(kpi_key)
    trends = cache_service.get(trend_key)
    geo = cache_service.get(geo_key)
    anomalies = cache_service.get(anom_key)
    correlations = cache_service.get(corr_key)

    engine = None
    if not (kpis and trends and geo and anomalies and correlations):
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found"
            )
        try:
            engine = AnalyticsEngine(dataset.file_path)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Analytics computation failed: {str(e)}"
            )

    if not kpis and engine:
        kpis = engine.get_kpis()
        cache_service.set(kpi_key, kpis, ttl_seconds=300)
    if not trends and engine:
        trends = engine.get_trends()
        cache_service.set(trend_key, trends, ttl_seconds=1800)
    if not geo and engine:
        geo = engine.get_geo_metrics()
        cache_service.set(geo_key, geo, ttl_seconds=600)
    if not anomalies and engine:
        anomalies = engine.get_anomalies()
        cache_service.set(anom_key, anomalies, ttl_seconds=600)
    if not correlations and engine:
        correlations = engine.get_correlations()
        cache_service.set(corr_key, correlations, ttl_seconds=600)

    return {
        "kpis": kpis,
        "trends": trends,
        "geo": geo,
        "anomalies": anomalies,
        "correlations": correlations
    }


@app.get("/api/analytics/insights/{dataset_id}")
@limiter.limit("60/minute")
def get_analytics_insights(
    request: Request,
    dataset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve automated Gemini AI insights (headline, trends, regional highlights, and recommendations).
    """
    cache_key = f"insights:{dataset_id}"
    insights = cache_service.get(cache_key)
    if insights:
        return insights

    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )

    try:
        engine = AnalyticsEngine(dataset.file_path)
        context = engine.generate_statistical_context_summary()
        insights = gemini_service.generate_dashboard_insights(context)
        cache_service.set(cache_key, insights, ttl_seconds=900)
        return insights
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate insights: {str(e)}"
        )


@app.post("/api/analytics/query/{dataset_id}")
@limiter.limit("20/minute")
def post_copilot_query(
    request: Request,
    dataset_id: int,
    payload: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Pose natural language queries to the Gemini Copilot.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )

    try:
        engine = AnalyticsEngine(dataset.file_path)
        context = engine.generate_statistical_context_summary()
        response = gemini_service.ask_copilot(payload.query, context)

        # Save query to history if user has a dashboard linked to this dataset
        dashboard = db.query(UserDashboard).filter(
            UserDashboard.user_id == current_user.id,
            UserDashboard.dataset_id == dataset_id
        ).first()
        if dashboard:
            history = dashboard.query_history or []
            if not history:
                history = []
            history.append({
                "query": payload.query,
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "response": response
            })
            # Force dirty session for json mutation
            dashboard.query_history = None
            db.commit()
            dashboard.query_history = history
            db.commit()

        return {"response": response}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process query: {str(e)}"
        )


@app.get("/health/liveness")
def health_liveness():
    """
    Liveness check to ensure app is running.
    """
    return run_liveness_check()


@app.get("/health/readiness")
def health_readiness():
    """
    Readiness check to verify dependencies are responsive.
    """
    return run_readiness_check(SessionLocal)


# --- PROMETHEUS METRICS EXPORTER ---

@app.get("/metrics")
def get_metrics():
    """
    Prometheus metrics scraping endpoint.
    """
    return get_metrics_response()


# --- ASYNCHRONOUS BACKGROUND JOBS API ---

@app.post("/api/jobs", response_model=JobStatusResponse)
async def submit_background_job(
    job_in: JobSubmission,
    current_user: User = Depends(get_current_user)
):
    """
    Submit an arbitrary background job (for administrative or pipeline testing).
    """
    try:
        args = job_in.arguments or {}
        job_id = await JobManager.submit_job(
            job_in.task_name,
            queue=job_in.queue,
            **args
        )
        return {
            "job_id": job_id,
            "task_name": job_in.task_name,
            "status": "queued",
            "message": "Job submitted to background queue."
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit background job: {str(e)}"
        )


@app.get("/api/jobs", response_model=list[JobStatusResponse])
async def list_background_jobs(current_user: User = Depends(get_current_user)):
    """
    List all background jobs and their current status details.
    """
    try:
        return await JobManager.get_all_jobs()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list jobs: {str(e)}"
        )


@app.get("/api/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve status, progress percentage, logs, and results of a background job.
    """
    try:
        status_info = await JobManager.get_job_status(job_id)
        if not status_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job {job_id} not found."
            )
        return status_info
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve job status: {str(e)}"
        )


# --- OBJECT STORAGE API ---

@app.get("/api/storage/presigned/{bucket}/{key:path}")
def get_download_url(
    bucket: str,
    key: str,
    current_user: User = Depends(get_current_user)
):
    """
    Generate a secure, short-lived presigned URL to download files from MinIO.
    """
    try:
        url = storage_service.generate_presigned_url(
            bucket_name=bucket,
            object_name=key,
            expires_delta_seconds=600  # 10 minutes
        )
        return {"url": url}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate URL: {str(e)}"
        )


# --- UNIFIED RESOURCE SEARCH API ---

@app.get("/api/search")
def unified_search(
    q: str,
    filter_by: str | None = None,
    limit: int = 10,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """
    Unified search across datasets, dashboards, and insights via Meilisearch.
    """
    try:
        return search_service.search_resources(
            query=q,
            filter_by=filter_by,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search request failed: {str(e)}"
        )


# --- TIME-SERIES FORECASTING API ---

@app.post("/api/forecast/train/{dataset_id}")
async def trigger_forecast_training(
    dataset_id: int,
    target_col: str,
    steps: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger time-series forecast model training for a dataset as a background task.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        job_id = await JobManager.submit_job(
            "run_forecast_task",
            dataset_id=dataset_id,
            target_col=target_col,
            steps=steps
        )
        return {"job_id": job_id, "status": "queued", "message": "Forecasting model training initiated."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/forecast/predict/{dataset_id}")
def get_forecast_predictions(
    dataset_id: int,
    steps: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve future forecast projections and explanations using the best trained model.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        predictor = ForecastingPredictor(dataset_id=dataset_id)
        if not predictor.loaded:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No forecasting model found for this dataset. Please train one first."
            )
        return predictor.predict(steps=steps)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- MACHINE LEARNING PLATFORM API ---

@app.post("/api/ml/train/{dataset_id}")
async def trigger_ml_training(
    dataset_id: int,
    task_type: str,  # segmentation, churn, revenue_prediction, anomaly
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger training for a specific Scikit-Learn task (clustering, classification, regression, anomalies) as a background task.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        job_id = await JobManager.submit_job(
            "run_ml_training_task",
            dataset_id=dataset_id,
            task_type=task_type
        )
        return {"job_id": job_id, "status": "queued", "message": f"ML pipeline training for '{task_type}' initiated."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/predict/{dataset_id}")
def run_ml_inference(
    dataset_id: int,
    task_type: str,
    input_records: list[dict[str, Any]],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Serve predictions using the latest trained model registered for a task type.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        server = MLServing(dataset_id=dataset_id, task_type=task_type)
        if not server.loaded:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No trained model registered for task type '{task_type}'. Please trigger training first."
            )
        return server.predict(input_records)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- INSIGHTS AUTOMATION API ---

@app.get("/api/insights/dataset/{dataset_id}", response_model=list[InsightResponse])
def get_dataset_insights(
    dataset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve all structured, categorized insights and actionable recommendations for a dataset.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    return db.query(Insight).filter(Insight.dataset_id == dataset_id).order_by(Insight.score.desc()).all()


@app.post("/api/insights/trigger/{dataset_id}")
async def trigger_insights_generation(
    dataset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually enqueue a background job to run analytical insight scans and recommendations.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        job_id = await JobManager.submit_job(
            "run_insight_generation_task",
            dataset_id=dataset_id
        )
        return {"job_id": job_id, "status": "queued", "message": "AI insights scans initiated in background."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
