"""
GET /beta
Calcula la beta de cartera usando Financial Modeling Prep (FMP) API.
Un solo request batch para todos los tickers. Cache de 6 horas.
"""

import os
import time
import asyncio
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ppi_wrapper import get_ppi, ACCOUNT

router = APIRouter()

FMP_KEY  = os.environ.get("FMP_API_KEY", "aWsmJIlquftt7iKfc73BXjNhbOgu5n7E")
FMP_BASE = "https://financialmodelingprep.com/api/v3"
CACHE_TTL = 6 * 3600  # 6 horas

_cache: dict = {"data": None, "ts": 0.0}

# CEDEARs argentinos → ticker subyacente en mercados USA
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


async def _fetch_one_beta(client: httpx.AsyncClient, ticker: str) -> tuple[str, float | None]:
    """Fetch beta para un ticker individual desde FMP."""
    try:
        url = f"{FMP_BASE}/profile/{ticker}?apikey={FMP_KEY}"
        r = await client.get(url)
        r.raise_for_status()
        data = r.json()
        if data and isinstance(data, list):
            beta = data[0].get("beta")
            if beta is not None:
                return ticker, round(float(beta), 4)
    except Exception:
        pass
    return ticker, None


async def _fetch_betas(underlyings: list[str]) -> dict[str, float]:
    """
    Requests individuales en paralelo a FMP.
    El plan free no soporta batch, pero sí requests individuales.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        results = await asyncio.gather(*[_fetch_one_beta(client, t) for t in underlyings])
    return {ticker: beta for ticker, beta in results if beta is not None}


@router.get("/beta", response_model=BetaResponse, tags=["analytics"])
async def get_beta():
    now = time.time()

    # Servir desde cache si es reciente
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
        return BetaResponse(
            portfolio_beta=1.0, benchmark="S&P 500", lookback_days=252,
            tickers=[], note="Sin posiciones con valor.", cached=False
        )

    # Mapear CEDEARs a subyacentes
    underlying_map = {t: CEDEAR_MAP.get(t, t) for t in ticker_values}
    unique_underlyings = list(set(underlying_map.values()))

    # Fetch betas desde FMP
    try:
        fmp_betas = await _fetch_betas(unique_underlyings)
    except Exception as exc:
        # Si FMP falla, devolver 1.0 con nota de error (no 502)
        ticker_betas = [
            TickerBeta(
                ticker=t, underlying=underlying_map[t], beta=1.0,
                weight=round(v / total_value, 4),
                weighted_beta=round(1.0 * v / total_value, 4)
            )
            for t, v in ticker_values.items()
        ]
        return BetaResponse(
            portfolio_beta=1.0, benchmark="S&P 500", lookback_days=252,
            tickers=ticker_betas,
            note=f"Error al conectar con FMP: {exc}. Betas temporalmente en 1.0.",
            cached=False
        )

    # Construir respuesta
    ticker_betas: list[TickerBeta] = []
    missing = []

    for ticker, value in ticker_values.items():
        underlying = underlying_map[ticker]
        weight = value / total_value
        beta = fmp_betas.get(underlying)

        if beta is None:
            missing.append(f"{ticker}({underlying})")
            beta = 1.0

        ticker_betas.append(TickerBeta(
            ticker=ticker,
            underlying=underlying,
            beta=beta,
            weight=round(weight, 4),
            weighted_beta=round(beta * weight, 4),
        ))

    portfolio_beta = round(sum(t.weighted_beta for t in ticker_betas), 4)

    note = "Beta obtenida desde Financial Modeling Prep (FMP). Calculada vs. S&P 500."
    if missing:
        note += f" Sin datos para: {', '.join(missing)} (usando beta=1.0)."

    result = BetaResponse(
        portfolio_beta=portfolio_beta,
        benchmark="S&P 500",
        lookback_days=252,
        tickers=ticker_betas,
        note=note,
        cached=False,
    )

    _cache["data"] = result
    _cache["ts"] = now
    return result
