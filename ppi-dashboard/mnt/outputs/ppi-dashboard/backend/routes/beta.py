"""
GET /beta
Calcula la beta de cartera usando valores de betas.json.
Los betas son vs. S&P 500 y se actualizan manualmente cada 3-6 meses.
Cache de 6 horas en memoria.
"""

import os
import json
import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ppi_wrapper import get_ppi, ACCOUNT

router = APIRouter()

CACHE_TTL = 6 * 3600
_cache: dict = {"data": None, "ts": 0.0}

CEDEAR_MAP = {
    "EMBJ":   "ERJ",
    "AMZND":  "AMZN",
    "GOOGLD": "GOOGL",
    "MSTFD":  "MSFT",
    "APPLED": "AAPL",
}

# Ruta al archivo de betas (mismo directorio que este script)
BETAS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "betas.json")


def _load_betas() -> dict[str, float]:
    try:
        with open(BETAS_FILE) as f:
            data = json.load(f)
        return {k: float(v) for k, v in data.items() if not k.startswith("_")}
    except Exception:
        return {}


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

    betas_db = _load_betas()
    underlying_map = {t: CEDEAR_MAP.get(t, t) for t in ticker_values}

    ticker_betas: list[TickerBeta] = []
    missing = []

    for ticker, value in ticker_values.items():
        underlying = underlying_map[ticker]
        weight = value / total_value
        # Buscar por underlying primero, luego por ticker original
        beta = betas_db.get(underlying) or betas_db.get(ticker)
        if beta is None:
            missing.append(ticker)
            beta = 1.0

        ticker_betas.append(TickerBeta(
            ticker=ticker,
            underlying=underlying,
            beta=beta,
            weight=round(weight, 4),
            weighted_beta=round(beta * weight, 4),
        ))

    portfolio_beta = round(sum(t.weighted_beta for t in ticker_betas), 4)

    updated = betas_db.get("_updated", "desconocida")  # no existe porque filtramos _, pero por si acaso
    note = "Beta vs. S&P 500 — valores de referencia actualizados 2026-04-15."
    if missing:
        note += f" Sin beta para: {', '.join(missing)} (usando 1.0). Agregá al archivo betas.json."

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
