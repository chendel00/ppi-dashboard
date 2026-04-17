from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import portfolio, beta, goals, mep, history, tape
import os

app = FastAPI(title="PPI Dashboard API", version="2.0.0")

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(portfolio.router)
app.include_router(beta.router)
app.include_router(goals.router)
app.include_router(mep.router)
app.include_router(history.router)
app.include_router(tape.router)

@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
