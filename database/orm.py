from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base
from pgvector.sqlalchemy import Vector


from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker 
from config import DB_URL


def alchemy_engine():
    engine = create_engine(DB_URL)
    Session = sessionmaker(bind=engine)
    db = Session()
    return db

Base = declarative_base()

class DocumentChunk(Base):
    __tablename__ = 'chunks'

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=func.now())
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384))
    ticker = Column(String(10), nullable=False)
    filing_date = Column(DateTime)
    year = Column(Integer)
    quarter = Column(String(2))

