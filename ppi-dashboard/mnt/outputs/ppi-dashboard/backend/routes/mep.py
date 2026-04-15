"""
GET /mep
Returns the MEP (dólar bolsa) exchange rate from dolarapi.com.
"""

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/mep", tags=["fx"])
async def get_mep():
    """Fetches MEP (dólar bolsa) rate from dolarapi.com."""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get("https://dolarapi.com/v1/dolares/bolsa")
            r.raise_for_status()
            data = r.json()
        return {
            "rate": float(data.get("venta") or data.get("compra") or 0),
            "buy":  float(data.get("compra") or 0),
            "sell": float(data.get("venta") or 0),
            "source": "dolarapi.com",
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"MEP fetch error: {exc}")
