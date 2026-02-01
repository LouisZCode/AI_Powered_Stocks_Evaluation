from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import declarative_base
from pgvector.sqlalchemy import Vector


from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker 
from config import DB_URL



def create_engine():
    engine = create_engine(DB_URL)


Base = declarative_base()

class Chunk(Base):
    __tablename__ = 'chunks'

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime, default=func.now())
    content = Column(Text, nullable=False)
    embedding = Column(Vector(384))
    ticker = Column(String(10), nullable=False)
    filling_date = Column(DateTime)
    year = Column(Integer)
    quarter = Column(String(2))

