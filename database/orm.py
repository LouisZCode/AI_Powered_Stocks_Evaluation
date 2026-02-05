from sqlalchemy import Column, Integer, String, DateTime, Date, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base
from pgvector.sqlalchemy import Vector

from sqlalchemy.dialects.postgresql import JSONB

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker 
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

class LLM_Financial_Analysis(Base):
    __tablename__='llm_financial_analysis'

    id = Column(Integer, primary_key=True)
    ticker = Column(String(10), nullable=False)
    llm_model = Column(String(100), nullable=False)
    analysis = Column(JSONB)
    latest_filling_date = Column(Date)
    created_at = Column(DateTime, default=func.now())
