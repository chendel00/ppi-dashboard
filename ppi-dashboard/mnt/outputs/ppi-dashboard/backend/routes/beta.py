import time
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
CACHE_TTL = 6 * 3600  # 6 horas

# Cache en memoria del proceso
_cache: dict = {"data": None, "ts": 0.0}

# Mapa de CEDEARs argentinos → ticker subyacente en yfinance
CEDEAR_MAP = {
    "EMBJ":   "ERJ",
    "AMZND":  "AMZN",
    "GOOGLD": "GOOGL",
    "MSTFD":  "MSFT",
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
    cached: bool = False


def _compute_beta(t_ret: np.ndarray, b_ret: np.ndarray) -> float:
    if len(t_ret) < MIN_OBSERVATIONS:
        return 1.0
    cov_matrix = np.cov(t_ret, b_ret)
    var_b = cov_matrix[1, 1]
    if var_b == 0:
        return 1.0
    return round(float(cov_matrix[0, 1] / var_b), 4)


def _extract_close(all_data: pd.DataFrame, ticker: str) -> pd.Series | None:
    """Extrae la serie de cierre para un ticker del DataFrame multi-ticker."""
    try:
        if isinstance(all_data.columns, pd.MultiIndex):
            # yfinance con múltiples tickers: columnas = (campo, ticker)
            if ("Close", ticker) in all_data.columns:
                s = all_data[("Close", ticker)]
            elif ticker in all_data.columns.get_level_values(1):
                s = all_data["Close"][ticker]
            else:
                return None
        else:
            # Un solo ticker
            s = all_data["Close"]

        if isinstance(s, pd.DataFrame):
            s = s.iloc[:, 0]
        s = s.squeeze().dropna()
        return s if isinstance(s, pd.Series) and len(s) > 0 else None
    except Exception:
        return None


@router.get("/beta", response_model=BetaResponse, tags=["analytics"])
async def get_beta():
    now = time.time()

    # Devolver cache si es reciente
    if _cache["data"] is not None and (now - _cache["ts"]) < CACHE_TTL:
        result = _cache["data"]
        result.cached = True
        return result

    # Obtener posiciones de PPI
    try:
        ppi = get_ppi()
        data = ppi.account.get_balance_and_positions(ACCOUNT)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PPI API error: {exc}")

    end_date = date.today()
    start_date = end_date - timedelta(days=LOOKBACK_DAYS + 30)

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

    # Mapear a subyacentes
    underlying_map = {t: CEDEAR_MAP.get(t, t) for t in ticker_values}
    all_underlyings = list(set(underlying_map.values()))
    tickers_to_dl = ["SPY"] + all_underlyings

    # Descarga única de todos los tickers (mucho más rápido que uno por uno)
    try:
        all_data = yf.download(
            tickers_to_dl,
            start=start_date,
            end=end_date,
            progress=False,
            auto_adjust=True,
            threads=True,
            group_by="ticker",
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"yfinance error: {exc}")

    # Retornos del benchmark
    spy_close = _extract_close(all_data, "SPY")
    if spy_close is None or len(spy_close) < MIN_OBSERVATIONS:
        raise HTTPException(status_code=502, detail="Sin datos de SPY desde yfinance")
    spy_ret = spy_close.pct_change().dropna()

    errors = []
    ticker_betas: list[TickerBeta] = []

    for ticker, value in ticker_values.items():
        underlying = underlying_map[ticker]
        weight = value / total_value

        t_close = _extract_close(all_data, underlying)
        if t_close is None or len(t_close) < MIN_OBSERVATIONS:
            errors.append(f"{ticker}→{underlying}: sin datos")
            beta = 1.0
        else:
            t_ret = t_close.pct_change().dropna()
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

    result = BetaResponse(
        portfolio_beta=portfolio_beta,
        benchmark="SPY",
        lookback_days=LOOKBACK_DAYS,
        tickers=ticker_betas,
        note=note,
        cached=False,
    )

    # Guardar en cache
    _cache["data"] = result
    _cache["ts"] = now

    return result
