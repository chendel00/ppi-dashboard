from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yfinance as yf
import numpy as np
from datetime import date, timedelta
from ppi_wrapper import get_ppi, ACCOUNT

router = APIRouter()
LOOKBACK_DAYS = 252
MIN_OBSERVATIONS = 20

# Mapa de CEDEARs argentinos a su ticker subyacente en yfinance
CEDEAR_MAP = {
    "EMBJ": "ERJ",   # Embraer
    "AMZND": "AMZN",
    "GOOGL": "GOOGL",
    "AAPL": "AAPL",
    "MSFT": "MSFT",
}

class TickerBeta(BaseModel):
    ticker: str
    underlying: str
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

    # Tomamos TODAS las posiciones (CEDEARs cotizan en pesos pero tienen ticker en yfinance)
    ticker_values = {}
    for group in (data.get("groupedInstruments") or []):
        items = group.get("instruments") or group.get("detail") or [group]
        for item in items:
            ticker = str(item.get("ticker") or item.get("symbol") or "")
            market_value = float(item.get("amount") or 0)
            if ticker and market_value > 0:
                ticker_values[ticker] = ticker_values.get(ticker, 0) + market_value

    total_value = sum(ticker_values.values())
    if total_value == 0:
        return BetaResponse(portfolio_beta=1.0, benchmark="SPY", lookback_days=LOOKBACK_DAYS,
                            tickers=[], note="Sin posiciones.")

    ticker_betas = []
    for ticker, value in ticker_values.items():
        underlying = CEDEAR_MAP.get(ticker, ticker)
        try:
            hist = yf.download(underlying, start=start_date, end=end_date, progress=False, auto_adjust=True)
            if hist.empty:
                beta = 1.0
            else:
                t_ret = hist["Close"].pct_change().dropna()
                aligned = t_ret.align(spy_ret, join="inner")
                beta = _compute_beta(aligned[0].values, aligned[1].values)
        except Exception:
            beta = 1.0

        weight = value / total_value
        ticker_betas.append(TickerBeta(
            ticker=ticker, underlying=underlying, beta=beta,
            weight=round(weight, 4), weighted_beta=round(beta * weight, 4),
        ))

    return BetaResponse(
        portfolio_beta=round(sum(t.weighted_beta for t in ticker_betas), 4),
        benchmark="SPY", lookback_days=LOOKBACK_DAYS, tickers=ticker_betas,
        note="Beta calculada sobre todos los CEDEARs usando su subyacente en yfinance.",
    )
