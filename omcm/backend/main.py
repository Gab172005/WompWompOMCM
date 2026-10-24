"""FastAPI entry point. Domain endpoints live in routers/."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from config import today  # Public utility retained for API consumers.
from services import repository
from services.data import load_data
from routers import municipalities, optimization, simulation, clinics, integrations, assistant

@asynccontextmanager
async def lifespan(app):
    repository.initialize()
    load_data()
    yield

app = FastAPI(title="OMCM", version="1.0.0", lifespan=lifespan,
              description="Laguna mobile clinic planning and simulation demo.")
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(CORSMiddleware,
    allow_origins=[origin.strip().rstrip("/") for origin in os.getenv("OMCM_CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",") if origin.strip()],
    allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])
for router in (municipalities.router, optimization.router, simulation.router, clinics.router, integrations.router, assistant.router):
    app.include_router(router)
