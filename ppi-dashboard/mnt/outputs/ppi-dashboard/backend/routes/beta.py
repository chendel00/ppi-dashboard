from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yfinance as yf
import numpy as np
import pandas as pd
from datetime import date, timedelta
from ppi_wrapper import get_ppi, ACCOUNT

router = APIRouter()
LOOKBACK_DAYS = 252
MIN_OBSERVATIONS = 20

# Mapa de CEDEARs argentinos → ticker subyacente en yfinance
CEDEAR_MAP = {
    "EMBJ": "ERJ",    # Embraer
    "AMZND": "AMZN",
    "GOOGLD": "GOOGL",
    "MSTFD": "MSFT",
    "APPLED": "AAPL",
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


def _close_series(ticker: str, start: date, end: date) -> pd.Series | None:
    """Download closing prices and always return a clean 1D Series."""
    try:
        df = yf.download(ticker, start=start, end=end,
                         progress=False, auto_adjust=True, threads=False)
        if df is None or df.empty:
            return None
        close = df["Close"]
        # yfinance ≥0.2.38 may return a DataFrame with MultiIndex columns
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]
        close = close.squeeze()
        if not isinstance(close, pd.Series):
            return None
        return close.dropna()
    except Exception:
        return None


def _compute_beta(t_ret: np.ndarray, b_ret: np.ndarray) -> float:
    if len(t_ret) < MIN_OBSERVATIONS:
        return 1.0
    cov_matrix = np.cov(t_ret, b_ret)
    var_b = cov_matrix[1, 1]
    if var_b == 0:
        return 1.0
    return round(float(cov_matrix[0, 1] / var_b), 4)


@router.get("/beta", response_model=BetaResponse, tags=["analytics"])
async def get_beta():
    try:
        ppi = get_ppi()
        data = ppi.account.get_balance_and_positions(ACCOUNT)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PPI API error: {exc}")

    end_date = date.today()
    start_date = end_date - timedelta(days=LOOKBACK_DAYS + 30)

    spy_close = _close_series("SPY", start_date, end_date)
    if spy_close is None or len(spy_close) < MIN_OBSERVATIONS:
        raise HTTPException(status_code=502, detail="No se pudo obtener datos de SPY desde yfinance")
    spy_ret = spy_close.pct_change().dropna()

    # Recopilar posiciones con valor > 0
    ticker_values: dict[str, float] = {}
    for group in (data.get("groupedInstruments") or []):
        items = group.get("instruments") or group.get("detail") or [group]
        for item in items:
            ticker = str(item.get("ticker") or item.get("symbol") or "")
            market_value = float(item.get("amount") or 0)
            if ticker and market_value > 0:
                ticker_values[ticker] = ticker_values.get(ticker, 0) + market_value

    total_value = sum(ticker_values.values())
    if total_value == 0:
        return BetaResponse(portfolio_beta=1.0, benchmark="SPY",
                            lookback_days=LOOKBACK_DAYS, tickers=[],
                            note="Sin posiciones con valor.")

    errors = []
    ticker_betas: list[TickerBeta] = []

    for ticker, value in ticker_values.items():
        underlying = CEDEAR_MAP.get(ticker, ticker)
        weight = value / total_value

        t_close = _close_series(underlying, start_date, end_date)
        if t_close is None or len(t_close) < MIN_OBSERVATIONS:
            errors.append(f"{ticker}→{underlying}: sin datos")
            beta = 1.0
        else:
            t_ret = t_close.pct_change().dropna()
            # Alinear por fechas comunes
            merged = pd.concat([t_ret, spy_ret], axis=1, join="inner").dropna()
            if len(merged) < MIN_OBSERVATIONS:
                errors.append(f"{ticker}: pocas observaciones ({len(merged)})")
                beta = 1.0
            else:
                beta = _compute_beta(merged.iloc[:, 0].values, merged.iloc[:, 1].values)

        ticker_betas.append(TickerBeta(
            ticker=ticker,
            underlying=underlying,
            beta=beta,
            weight=round(weight, 4),
            weighted_beta=round(beta * weight, 4),
        ))

    portfolio_beta = round(sum(t.weighted_beta for t in ticker_betas), 4)
    note = "Beta calculada con precios del subyacente en yfinance (CEDEARs mapeados a su ticker USA)."
    if errors:
        note += f" Advertencias: {'; '.join(errors)}"

    return BetaResponse(
        portfolio_beta=portfolio_beta,
        benchmark="SPY",
        lookback_days=LOOKBACK_DAYS,
        tickers=ticker_betas,
        note=note,
    )
