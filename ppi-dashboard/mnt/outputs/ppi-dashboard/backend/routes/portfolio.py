"""
GET /portfolio
Returns positions and balances using the official ppi-client library.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ppi_client import get_ppi, ACCOUNT

router = APIRouter()


class Position(BaseModel):
    ticker: str
    description: str
    quantity: float
    current_price: float
    market_value: float
    currency: str
    asset_type: str


class PortfolioResponse(BaseModel):
    positions: list[Position]
    total_market_value_ars: float
    total_market_value_usd: float
    cash_ars: float
    cash_usd: float


@router.get("/portfolio", response_model=PortfolioResponse, tags=["portfolio"])
async def get_portfolio():
    try:
        ppi = get_ppi()
        data = ppi.account.get_balance_and_positions(ACCOUNT)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PPI API error: {exc}")

    positions: list[Position] = []
    total_ars = 0.0
    total_usd = 0.0

    raw_groups = data.get("groupedInstruments") or []
    for group in raw_groups:
        items = group.get("instruments") or group.get("detail") or [group]
        for item in items:
            ticker = str(item.get("ticker") or item.get("symbol") or "")
            description = str(item.get("description") or item.get("name") or ticker)
            quantity = float(item.get("quantity") or 0)
            price = float(item.get("price") or 0)
            market_value = float(item.get("amount") or (quantity * price))
            currency = str(item.get("currency") or "ARS").upper()
            asset_type = str(item.get("instrumentType") or item.get("type") or group.get("type") or "STOCK")

            if not ticker:
                continue

            if currency == "USD":
                total_usd += market_value
            else:
                total_ars += market_value

            positions.append(Position(
                ticker=ticker,
                description=description,
                quantity=quantity,
                current_price=price,
                market_value=market_value,
                currency=currency,
                asset_type=asset_type,
            ))

    cash_ars = 0.0
    cash_usd = 0.0
    for avail in (data.get("groupedAvailability") or []):
        symbol = str(avail.get("symbol") or avail.get("currency") or "").upper()
        amount = float(avail.get("amount") or 0)
        if symbol in ("USD", "U$S", "DOLAR"):
            cash_usd += amount
        else:
            cash_ars += amount

    return PortfolioResponse(
        positions=positions,
        total_market_value_ars=round(total_ars, 2),
        total_market_value_usd=round(total_usd, 2),
        cash_ars=round(cash_ars, 2),
        cash_usd=round(cash_usd, 2),
    )
