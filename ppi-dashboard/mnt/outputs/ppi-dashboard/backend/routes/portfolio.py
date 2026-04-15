"""
GET /portfolio
Returns positions with current market value and unrealised P&L.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ppi_client import get_ppi_client

router = APIRouter()


class Position(BaseModel):
    ticker: str
    description: str
    quantity: float
    avg_price: float          # average acquisition price (ARS)
    current_price: float
    market_value: float       # quantity * current_price
    cost_basis: float         # quantity * avg_price
    unrealised_pnl: float     # market_value - cost_basis
    unrealised_pnl_pct: float # as percentage
    currency: str
    asset_type: str


class PortfolioResponse(BaseModel):
    positions: list[Position]
    total_market_value: float
    total_cost_basis: float
    total_unrealised_pnl: float
    total_unrealised_pnl_pct: float
    cash_ars: float
    cash_usd: float


@router.get("/portfolio", response_model=PortfolioResponse, tags=["portfolio"])
async def get_portfolio():
    """
    Fetches positions from PPI and enriches them with current prices and P&L.
    """
    try:
        client = get_ppi_client()
        raw_positions = client.get_positions()
        balances = client.get_balances()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PPI API error: {exc}")

    positions: list[Position] = []

    for pos in raw_positions:
        ticker = pos.get("ticker") or pos.get("symbol", "")
        description = pos.get("description") or pos.get("name", ticker)
        quantity = float(pos.get("quantity") or pos.get("amount") or 0)
        avg_price = float(pos.get("averagePrice") or pos.get("avg_price") or 0)
        current_price = float(
            pos.get("price") or pos.get("currentPrice") or pos.get("last") or avg_price
        )
        currency = pos.get("currency", "ARS")
        asset_type = pos.get("instrumentType") or pos.get("type", "STOCK")

        market_value = quantity * current_price
        cost_basis = quantity * avg_price
        unrealised_pnl = market_value - cost_basis
        unrealised_pnl_pct = (unrealised_pnl / cost_basis * 100) if cost_basis else 0.0

        positions.append(
            Position(
                ticker=ticker,
                description=description,
                quantity=quantity,
                avg_price=avg_price,
                current_price=current_price,
                market_value=market_value,
                cost_basis=cost_basis,
                unrealised_pnl=unrealised_pnl,
                unrealised_pnl_pct=round(unrealised_pnl_pct, 2),
                currency=currency,
                asset_type=asset_type,
            )
        )

    total_market_value = sum(p.market_value for p in positions)
    total_cost_basis = sum(p.cost_basis for p in positions)
    total_pnl = total_market_value - total_cost_basis
    total_pnl_pct = (total_pnl / total_cost_basis * 100) if total_cost_basis else 0.0

    # Extract cash balances
    cash_ars = float(
        balances.get("availableARS")
        or balances.get("cashARS")
        or balances.get("ars", 0)
        or 0
    )
    cash_usd = float(
        balances.get("availableUSD")
        or balances.get("cashUSD")
        or balances.get("usd", 0)
        or 0
    )

    return PortfolioResponse(
        positions=positions,
        total_market_value=total_market_value,
        total_cost_basis=total_cost_basis,
        total_unrealised_pnl=total_pnl,
        total_unrealised_pnl_pct=round(total_pnl_pct, 2),
        cash_ars=cash_ars,
        cash_usd=cash_usd,
    )
