"""
GET /beta
Computes portfolio beta against SPY benchmark using yfinance.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yfinance as yf
import numpy as np
from datetime import date, timedelta
from ppi_client import get_ppi_client

router = APIRouter()

LOOKBACK_DAYS = 252  # 1 trading year
MIN_OBSERVATIONS = 20


class TickerBeta(BaseModel):
    ticker: str
    beta: float
    weight: float           # fraction of total portfolio value
    weighted_beta: float


class BetaResponse(BaseModel):
    portfolio_beta: float
    benchmark: str
    lookback_days: int
    tickers: list[TickerBeta]
    note: str


def _compute_beta(ticker_returns: np.ndarray, bench_returns: np.ndarray) -> float:
    """OLS beta: cov(r_i, r_m) / var(r_m)"""
    if len(ticker_returns) < MIN_OBSERVATIONS:
        return 1.0  # default for insufficient data
    cov_matrix = np.cov(ticker_returns, bench_returns)
    var_bench = cov_matrix[1, 1]
    if var_bench == 0:
        return 1.0
    return round(float(cov_matrix[0, 1] / var_bench), 4)


@router.get("/beta", response_model=BetaResponse, tags=["analytics"])
async def get_beta():
    """
    Computes portfolio beta vs SPY.
    Uses last 252 calendar days of yfinance data.
    Positions valued in USD; ARS positions are skipped (not listed in yfinance).
    """
    try:
        client = get_ppi_client()
        positions = client.get_positions()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PPI API error: {exc}")

    end_date = date.today()
    start_date = end_date - timedelta(days=LOOKBACK_DAYS + 30)  # extra buffer

    # Download SPY benchmark
    try:
        spy = yf.download("SPY", start=start_date, end=end_date, progress=False, auto_adjust=True)
        bench_returns = spy["Close"].pct_change().dropna().values
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"yfinance SPY error: {exc}")

    ticker_betas: list[TickerBeta] = []
    total_value = 0.0
    ticker_values: dict[str, float] = {}

    # Only USD-denominated positions get a yfinance beta (CEDEARs, ONs, etc.)
    usd_positions = [
        p for p in positions
        if (p.get("currency") or "ARS").upper() == "USD"
    ]

    for pos in usd_positions:
        ticker = (pos.get("ticker") or pos.get("symbol", "")).upper()
        qty = float(pos.get("quantity") or 0)
        price = float(pos.get("price") or pos.get("currentPrice") or 0)
        value = qty * price
        ticker_values[ticker] = value
        total_value += value

    if total_value == 0:
        return BetaResponse(
            portfolio_beta=1.0,
            benchmark="SPY",
            lookback_days=LOOKBACK_DAYS,
            tickers=[],
            note="No USD positions found — defaulting to beta = 1.0",
        )

    for ticker, value in ticker_values.items():
        try:
            hist = yf.download(ticker, start=start_date, end=end_date, progress=False, auto_adjust=True)
            if hist.empty:
                beta = 1.0
            else:
                t_returns = hist["Close"].pct_change().dropna()
                # Align to common dates with SPY
                aligned = t_returns.align(
                    yf.download("SPY", start=start_date, end=end_date, progress=False, auto_adjust=True)["Close"].pct_change().dropna(),
                    join="inner",
                )
                beta = _compute_beta(aligned[0].values, aligned[1].values)
        except Exception:
            beta = 1.0

        weight = value / total_value
        ticker_betas.append(
            TickerBeta(
                ticker=ticker,
                beta=beta,
                weight=round(weight, 4),
                weighted_beta=round(beta * weight, 4),
            )
        )

    portfolio_beta = round(sum(t.weighted_beta for t in ticker_betas), 4)

    return BetaResponse(
        portfolio_beta=portfolio_beta,
        benchmark="SPY",
        lookback_days=LOOKBACK_DAYS,
        tickers=ticker_betas,
        note="Beta computed on USD-denominated positions only.",
    )
