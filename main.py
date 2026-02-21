# test by:   uvicorn main:app --reload
# test frontend   cd frontend   &&   npm run dev

from heapq import heapify
import os
from agents.agents import AVAILABLE_MODELS
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from routes import all_routes
from database.connection import engine
from database.orm import Base

app = FastAPI()

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "dev-secret"),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in all_routes:
    app.include_router(router)


@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@app.get("/health/")
def health():
    return {"health": "OK"}


@app.get("/models/")
async def show_available_models():
    return {"available_models": list(AVAILABLE_MODELS.keys())}
