"""
GET /beta
Computes portfolio beta against SPY benchmark using yfinance.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yfinance as yf
import numpy as np
from datetime import date, timedelta
from ppi_client import get_ppi, ACCOUNT

router = APIRouter()

LOOKBACK_DAYS = 252
MIN_OBSERVATIONS = 20


class TickerBeta(BaseModel):
    ticker: str
    beta: float
    weight: float
    weighted_beta: float


class BetaResponse(BaseModel):
    portfolio_beta: float
    benchmark: str
    lookback_days: int
    tickers: list[TickerBeta]
    note: str


def _compute_beta(t_ret: np.ndarray, b_ret: np.ndarray) -> float:
    if len(t_ret) < MIN_OBSERVATIONS:
        return 1.0
    cov = np.cov(t_ret, b_ret)
    var_b = cov[1, 1]
    return round(float(cov[0, 1] / var_b), 4) if var_b != 0 else 1.0


@router.get("/beta", response_model=BetaResponse, tags=["analytics"])
async def get_beta():
    try:
        ppi = get_ppi()
        data = ppi.account.get_balance_and_positions(ACCOUNT)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PPI API error: {exc}")

    end_date = date.today()
    start_date = end_date - timedelta(days=LOOKBACK_DAYS + 30)

    try:
        spy = yf.download("SPY", start=start_date, end=end_date, progress=False, auto_adjust=True)
        spy_ret = spy["Close"].pct_change().dropna()
