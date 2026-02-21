import uuid
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Date, Text, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base
from pgvector.sqlalchemy import Vector

from sqlalchemy.dialects.postgresql import UUID

from sqlalchemy.dialects.postgresql import JSONB

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, relationship
from config import DB_URL

engine = create_engine(DB_URL)
SessionLocal = sessionmaker(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    email = Column(String(200), nullable=False, unique=True)
    tier = Column(String(20), nullable=False, default="free")
    creation_date = Column(DateTime, default=func.now())
    update_tier_date = Column(Date, default=func.now())

    activities = relationship("Activity", back_populates="user")
    oauth_accounts = relationship("OauthProvider", back_populates="user", cascade="all, delete-orphan")


class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    activity_name = Column(String(50), nullable=False)
    ticker = Column(String(10), nullable=False)
    fast_use = Column(Integer)
    deep_use = Column(Integer)
    debate_level = Column(Integer)
    activity_start_date = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="activities")

class OauthProvider(Base):
    __tablename__ = "oauth_accounts"

    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    provider = Column(String(100), nullable=False)
    provider_user_id = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="oauth_accounts")

    __table_args__ = (UniqueConstraint("provider", "provider_user_id", name="uq_provider_account"))



class DocumentChunk(Base):
    __tablename__ = 'chunks'

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=func.now())
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384))
    ticker = Column(String(10), nullable=False)
    filing_date = Column(Date)
    year = Column(Integer)
    quarter = Column(String(2))

class LLMFinancialAnalysis(Base):
    __tablename__='llm_financial_analysis'

    id = Column(Integer, primary_key=True)
    ticker = Column(String(10), nullable=False)
    llm_model = Column(String(100), nullable=False)
    analysis = Column(JSONB)
    latest_filing_date = Column(Date)
    created_at = Column(DateTime, default=func.now())

class FinancialStatements(Base):
    __tablename__ = 'financial_statements'
    __table_args__ = (UniqueConstraint('ticker', 'latest_filing_date'),)

    id = Column(Integer, primary_key=True)
    ticker = Column(String(10), nullable=False)
    financial_data = Column(Text, nullable=False)
    latest_filing_date = Column(Date)
    created_at = Column(DateTime, default=func.now())

# Auto-create any new tables on import
Base.metadata.create_all(engine)
