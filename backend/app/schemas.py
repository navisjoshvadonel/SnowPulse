from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
import datetime

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    avatar_url: Optional[str] = None

class UserResponse(UserBase):
    id: int
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class DatasetBase(BaseModel):
    name: str
    description: Optional[str] = None
    file_path: str

class DatasetCreate(DatasetBase):
    pass

class DatasetResponse(DatasetBase):
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class DashboardBase(BaseModel):
    title: str
    insight_notes: Optional[str] = None
    query_history: Optional[List[Any]] = None

class DashboardCreate(DashboardBase):
    dataset_id: int

class DashboardResponse(DashboardBase):
    id: int
    user_id: int
    dataset_id: int
    created_at: datetime.datetime
    dataset: DatasetResponse

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
