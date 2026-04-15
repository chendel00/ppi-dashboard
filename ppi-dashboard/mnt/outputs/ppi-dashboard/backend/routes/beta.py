import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yfinance as yf
import numpy as np
import pandas as pd
from datetime import date, timedelta
from ppi_wrapper import get_ppi, ACCOUNT

# Fix para YFTzMissingError en entornos cloud (Render, etc.)
yf.set_tz_cache_location("/tmp/yf_tz_cache")

router = APIRouter()
LOOKBACK_DAYS = 252
MIN_OBSERVATIONS = 20
CACHE_TTL = 6 * 3600  # 6 horas

_cache: dict = {"data": None, "ts": 0.0}

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


def _download_closes(tickers: list[str], start: date, end: date) -> dict[str, pd.Series]:
    """
    Descarga precios de cierre para múltiples tickers en una sola llamada.
    Devuelve {ticker: pd.Series} con los que pudieron descargarse.
    """
    result: dict[str, pd.Series] = {}
    if not tickers:
        return result

    try:
        raw = yf.download(
            tickers,
            period="1y",          # evita el YFTzMissingError en cloud
            progress=False,
            auto_adjust=True,
            threads=True,
        )
    except Exception as exc:
        # Si falla la descarga masiva, intentar uno por uno como fallback
        for t in tickers:
            try:
                single = yf.download(t, period="1y", progress=False, auto_adjust=True)
                if not single.empty:
                    s = single["Close"]
                    if isinstance(s, pd.DataFrame):
                        s = s.iloc[:, 0]
                    s = s.squeeze().dropna()
                    if isinstance(s, pd.Series) and len(s) > 0:
                        result[t] = s
            except Exception:
                pass
        return result

    if raw is None or raw.empty:
        return result

    close = raw["Close"] if "Close" in raw.columns else raw

    if isinstance(close, pd.Series):
        # Un solo ticker descargado
        if len(tickers) == 1:
            s = close.dropna()
            if len(s) > 0:
                result[tickers[0]] = s
    elif isinstance(close, pd.DataFrame):
        for t in tickers:
            if t in close.columns:
                s = close[t].dropna()
                if len(s) > 0:
                    result[t] = s

    return result


@router.get("/beta", response_model=BetaResponse, tags=["analytics"])
async def get_beta():
    now = time.time()

    if _cache["data"] is not None and (now - _cache["ts"]) < CACHE_TTL:
        result = _cache["data"].model_copy()
        result.cached = True
        return result

    # Posiciones de PPI
    try:
        ppi = get_ppi()
        data = ppi.account.get_balance_and_positions(ACCOUNT)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PPI API error: {exc}")

    end_date = date.today()
    start_date = end_date - timedelta(days=LOOKBACK_DAYS + 30)

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

    underlying_map = {t: CEDEAR_MAP.get(t, t) for t in ticker_values}
    all_underlyings = list(set(underlying_map.values()))
    tickers_to_dl = list(set(["SPY"] + all_underlyings))

    closes = _download_closes(tickers_to_dl, start_date, end_date)

    spy_series = closes.get("SPY")
    if spy_series is None or len(spy_series) < MIN_OBSERVATIONS:
        # Si yfinance falla completamente, devolver betas = 1 con nota de error
        ticker_betas = [
            TickerBeta(ticker=t, underlying=underlying_map[t], beta=1.0,
                       weight=round(v / total_value, 4),
                       weighted_beta=round(1.0 * v / total_value, 4))
            for t, v in ticker_values.items()
        ]
        return BetaResponse(
            portfolio_beta=1.0, benchmark="SPY", lookback_days=LOOKBACK_DAYS,
            tickers=ticker_betas,
            note="No se pudieron obtener datos de yfinance. Betas temporalmente en 1.0."
        )

    spy_ret = spy_series.pct_change().dropna()

    errors = []
    ticker_betas: list[TickerBeta] = []

    for ticker, value in ticker_values.items():
        underlying = underlying_map[ticker]
        weight = value / total_value

        t_series = closes.get(underlying)
        if t_series is None or len(t_series) < MIN_OBSERVATIONS:
            errors.append(f"{ticker}({underlying}): sin datos")
            beta = 1.0
        else:
            t_ret = t_series.pct_change().dropna()
            merged = pd.concat([t_ret, spy_ret], axis=1, join="inner").dropna()
            if len(merged) < MIN_OBSERVATIONS:
                errors.append(f"{ticker}: pocas observaciones ({len(merged)})")
                beta = 1.0
            else:
                beta = _compute_beta(merged.iloc[:, 0].values, merged.iloc[:, 1].values)

        ticker_betas.append(TickerBeta(
            ticker=ticker, underlying=underlying, beta=beta,
            weight=round(weight, 4), weighted_beta=round(beta * weight, 4),
        ))

    portfolio_beta = round(sum(t.weighted_beta for t in ticker_betas), 4)
    note = "Beta calculada con precios del subyacente en yfinance."
    if errors:
        note += f" Sin datos: {'; '.join(errors)}."

    result = BetaResponse(
        portfolio_beta=portfolio_beta, benchmark="SPY",
        lookback_days=LOOKBACK_DAYS, tickers=ticker_betas,
        note=note, cached=False,
    )

    _cache["data"] = result
    _cache["ts"] = now
    return result
