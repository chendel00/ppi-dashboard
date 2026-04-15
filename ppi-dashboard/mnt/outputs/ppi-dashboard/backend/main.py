"""
PPI Dashboard — FastAPI backend
Run locally:   uvicorn main:app --reload
Deploy:        Set PPI_API_KEY, PPI_API_SECRET, PPI_ACCOUNT_NUMBER as env vars.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import portfolio, beta, goals

app = FastAPI(
    title="PPI Dashboard API",
    description="Portfolio analytics backed by PPI API + yfinance",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# In production set ALLOWED_ORIGINS to your frontend URL.
import os

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(portfolio.router)
app.include_router(beta.router)
app.include_router(goals.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
