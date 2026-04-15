"""
GET /portfolio
Returns positions and balances using the official ppi-client library.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ppi_wrapper import get_ppi, ACCOUNT

router = APIRouter()


class Position(BaseModel):
    ticker: str
    description: str
    quantity: float
    current_price: float
    market_value: float
    avg_cost: float       # precio promedio de compra
    pnl_ars: float        # ganancia/pérdida en ARS
    pnl_pct: float        # ganancia/pérdida porcentual
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

            # Precio promedio de compra — PPI puede usar distintos nombres de campo
            avg_cost = float(
                item.get("averagePrice") or
                item.get("avgPrice") or
                item.get("purchasePrice") or
                item.get("pricePurchase") or
                item.get("cost") or
                item.get("averageCost") or
                item.get("openingPrice") or
                0
            )

            # P&L no realizado
            if avg_cost > 0 and quantity > 0:
                pnl_ars = (price - avg_cost) * quantity
                pnl_pct = ((price - avg_cost) / avg_cost) * 100
            else:
                pnl_ars = 0.0
                pnl_pct = 0.0

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
                avg_cost=avg_cost,
                pnl_ars=round(pnl_ars, 2),
                pnl_pct=round(pnl_pct, 2),
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
