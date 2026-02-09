from sqlalchemy import Column, Integer, String, DateTime, Date, Text, UniqueConstraint
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
