from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yfinance as yf
import numpy as np
from datetime import date, timedelta
from ppi_wrapper import get_ppi, ACCOUNT

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

def _compute_beta(t_ret, b_ret):
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
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"yfinance error: {exc}")

    ticker_values = {}
    for group in (data.get("groupedInstruments") or []):
        items = group.get("instruments") or group.get("detail") or [group]
        for item in items:
            ticker = str(item.get("ticker") or item.get("symbol") or "")
            currency = str(item.get("currency") or "ARS").upper()
            market_value = float(item.get("amount") or 0)
            if ticker and currency == "USD" and market_value > 0:
                ticker_values[ticker] = ticker_values.get(ticker, 0) + market_value

    total_value = sum(ticker_values.values())
    if total_value == 0:
        return BetaResponse(
            portfolio_beta=1.0, benchmark="SPY", lookback_days=LOOKBACK_DAYS,
            tickers=[], note="No USD positions — defaulting to beta = 1.0",
        )

    ticker_betas = []
    for ticker, value in ticker_values.items():
        try:
            hist = yf.download(ticker, start=start_date, end=end_date, progress=False, auto_adjust=True)
            if hist.empty:
                beta = 1.0
            else:
                t_ret = hist["Close"].pct_change().dropna()
                aligned = t_ret.align(spy_ret, join="inner")
                beta = _compute_beta(aligned[0].values, aligned[1].values)
        except Exception:
            beta = 1.0
        weight = value / total_value
        ticker_betas.append(TickerBeta(ticker=ticker, beta=beta, weight=round(weight,4), weighted_beta=round(beta*weight,4)))

    return BetaResponse(
        portfolio_beta=round(sum(t.weighted_beta for t in ticker_betas), 4),
        benchmark="SPY", lookback_days=LOOKBACK_DAYS, tickers=ticker_betas,
        note="Beta calculada sobre posiciones en USD.",
    )
