# test by:   uvicorn main:app --reload
# test frontend   cd frontend   &&   npm run dev

import os
from agents.agents import AVAILABLE_MODELS
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from routes import all_routes

app = FastAPI()

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "dev-secret"),
)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in all_routes:
    app.include_router(router)


@app.get("/health/")
def health():
    return {"health": "OK"}


@app.get("/models/")
async def show_available_models():
    return {"available_models": list(AVAILABLE_MODELS.keys())}
