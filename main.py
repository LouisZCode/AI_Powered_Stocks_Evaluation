# test by:   uvicorn main:app --reload
# test frontend   cd frontend   &&   npm run dev

from agents.agents import AVAILABLE_MODELS
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import all_routes

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
for router in all_routes:
    app.include_router(router)

@app.get("/health/")
def health():
    return {"health" : "OK"}

@app.get("/models/")
async def show_available_models():
    return {"available_models" : list(AVAILABLE_MODELS.keys())}

