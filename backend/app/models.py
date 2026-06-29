import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # GDPR Privacy Purge - CASCADE deletes dashboard instances and token sessions
    dashboards = relationship("UserDashboard", back_populates="owner", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Shared relationship - multiple dashboards can query/reference the same dataset
    dashboards = relationship("UserDashboard", back_populates="dataset")
    insights = relationship("Insight", back_populates="dataset", cascade="all, delete-orphan")


class UserDashboard(Base):
    __tablename__ = "user_dashboards"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    title = Column(String, nullable=False)
    insight_notes = Column(Text, nullable=True)  # User comments / AI recommendations notes
    query_history = Column(JSON, nullable=True)   # History of analytics queries
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Multi-tenant linkage
    owner = relationship("User", back_populates="dashboards")
    dataset = relationship("Dataset", back_populates="dashboards")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")


class Insight(Base):
    __tablename__ = "insights"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=True)
    severity = Column(String, nullable=False)  # Critical, High, Medium, Info
    score = Column(Integer, nullable=False)     # 0-100
    category = Column(String, nullable=False)   # Anomaly, Growth, Risk, Forecast, ML
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationship
    dataset = relationship("Dataset", back_populates="insights")
