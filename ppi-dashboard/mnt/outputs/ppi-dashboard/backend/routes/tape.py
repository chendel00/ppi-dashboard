"""
GET /tape
Retorna variación diaria (%) de los tickers del tape usando Yahoo Finance HTTP API.
Cache de 15 minutos para no spamear YF.
"""

import time
import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

CACHE_TTL = 15 * 60  # 15 minutos
_cache: dict = {"data": None, "ts": 0.0}

# Tickers a mostrar en el tape (subyacentes US, no CEDEARs)
TAPE_TICKERS = ["COIN", "SPY", "SMH", "GLD", "URA", "NVDA", "ERJ", "AMZN", "GOOGL", "MSFT", "AAPL"]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}

YF_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=5d"


class TapeItem(BaseModel):
    ticker: str
    price: float
    change_pct: float


async def _fetch_ticker(client: httpx.AsyncClient, ticker: str) -> TapeItem | None:
    try:
        url = YF_URL.format(ticker=ticker)
        r = await client.get(url, headers=HEADERS, timeout=6.0)
        r.raise_for_status()
        data = r.json()
        closes = data["chart"]["result"][0]["indicators"]["quote"][0]["close"]
        # Filtra Nones y toma los dos últimos cierres válidos
        valid = [c for c in closes if c is not None]
        if len(valid) < 2:
            return None
        prev, last = valid[-2], valid[-1]
        chg = ((last - prev) / prev) * 100
        return TapeItem(ticker=ticker, price=round(last, 2), change_pct=round(chg, 2))
    except Exception:
        return None


@router.get("/tape", response_model=list[TapeItem], tags=["market"])
async def get_tape():
    now = time.time()
    if _cache["data"] is not None and (now - _cache["ts"]) < CACHE_TTL:
        return _cache["data"]

    async with httpx.AsyncClient() as client:
        import asyncio
        tasks = [_fetch_ticker(client, t) for t in TAPE_TICKERS]
        results = await asyncio.gather(*tasks)

    items = [r for r in results if r is not None]

    # Si no obtuvimos nada (YF bloqueado desde el server), devolvemos lista vacía
    # y el frontend cae al fallback estático
    if items:
        _cache["data"] = items
        _cache["ts"] = now

    return items
