import os
import psycopg2
from config import DB_URL
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

# Async engine for SQLAlchemy (used by FastAPI routes)
_async_url = DB_URL
if _async_url and _async_url.startswith("postgresql://"):
    _async_url = _async_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(_async_url, echo=False)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields an AsyncSession."""
    async with AsyncSessionLocal() as session:
        yield session


def get_connection():
    """Raw psycopg2 connection for vs_addition / retrieval_tool."""
    return psycopg2.connect(DB_URL)
