"""
GET /mep
Returns the MEP (dólar bolsa) exchange rate using PPI market data.
Calculates MEP via AL30 bond: precio en ARS / precio en USD.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ppi_wrapper import get_ppi

router = APIRouter()

class MepResponse(BaseModel):
    rate: float
    source: str

@router.get("/mep", response_model=MepResponse, tags=["fx"])
async def get_mep():
    try:
        ppi = get_ppi()
        # AL30 en pesos (mercado CI)
        ars = ppi.marketdata.current("AL30", "BONOS", "CI")
        # AL30D en dólares (mercado CI)
        usd = ppi.marketdata.current("AL30D", "BONOS", "CI")
        price_ars = float(ars.get("price") or ars.get("last") or 0)
        price_usd = float(usd.get("price") or usd.get("last") or 0)
        if price_usd == 0:
            raise ValueError("precio USD es 0")
        rate = round(price_ars / price_usd, 2)
        return MepResponse(rate=rate, source="AL30/AL30D")
    except Exception as exc:
        # Fallback: devolvemos un valor de referencia para no romper el frontend
        return MepResponse(rate=0.0, source=f"error: {exc}")
