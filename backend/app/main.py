import datetime
import os
import shutil
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Response, Cookie, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from pydantic import BaseModel

from .database import engine, Base, get_db
from .models import User, Dataset, UserDashboard, RefreshToken
from .schemas import (
    UserCreate, UserResponse, UserUpdate,
    DatasetResponse, DatasetCreate,
    DashboardCreate, DashboardResponse, TokenResponse
)
from .auth import (
    get_password_hash, verify_password,
    create_access_token, create_refresh_token,
    set_refresh_token_cookie, delete_refresh_token_cookie,
    JWT_REFRESH_SECRET_KEY, ALGORITHM
)
from .dependencies import get_current_user, verify_dashboard_ownership
from .analytics.engine import AnalyticsEngine
from .ai.gemini_service import GeminiService

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

# CORS setup: allow credentials to enable secure HttpOnly cookie transport
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
def login_user(
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
    refresh_token: Optional[str] = Cookie(None),
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
        RefreshToken.revoked == False,
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
    refresh_token: Optional[str] = Cookie(None),
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

@app.get("/api/datasets", response_model=List[DatasetResponse])
def get_datasets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch all shared datasets. 
    Requires any active registered user credentials to read metadata.
    """
    return db.query(Dataset).all()


@app.get("/api/dashboards", response_model=List[DashboardResponse])
def get_user_dashboards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch user dashboards. 
    Strictly filters records by the current_user.id. Users cannot query other user's data.
    """
    return db.query(UserDashboard).filter(UserDashboard.user_id == current_user.id).all()


@app.post("/api/dashboards", response_model=DashboardResponse)
def create_user_dashboard(
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
def get_single_dashboard(
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
def upload_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a custom CSV dataset for personal analysis.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are supported."
        )
        
    os.makedirs("./uploads", exist_ok=True)
    file_path = f"./uploads/{datetime.datetime.utcnow().timestamp()}_{file.filename}"
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
        
    db_dataset = Dataset(
        name=file.filename.rsplit('.', 1)[0],
        description=f"Uploaded by {current_user.email} on {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
        file_path=file_path
    )
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)
    
    return db_dataset


@app.get("/api/analytics/summary/{dataset_id}")
def get_analytics_summary(
    dataset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve statistical summaries, ECharts structures, anomalies, and correlations.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dataset not found"
        )
        
    try:
        engine = AnalyticsEngine(dataset.file_path)
        return {
            "kpis": engine.get_kpis(),
            "trends": engine.get_trends(),
            "geo": engine.get_geo_metrics(),
            "anomalies": engine.get_anomalies(),
            "correlations": engine.get_correlations()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analytics computation failed: {str(e)}"
        )


@app.get("/api/analytics/insights/{dataset_id}")
def get_analytics_insights(
    dataset_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve automated Gemini AI insights (headline, trends, regional highlights, and recommendations).
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
        insights = gemini_service.generate_dashboard_insights(context)
        return insights
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate insights: {str(e)}"
        )


@app.post("/api/analytics/query/{dataset_id}")
def post_copilot_query(
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
