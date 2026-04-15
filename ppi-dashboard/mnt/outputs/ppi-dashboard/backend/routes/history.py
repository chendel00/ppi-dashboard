"""
GET /history
Returns portfolio P&L history from PPI movements.
Builds a cumulative value series from account movements.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import date, timedelta
from ppi_client.models.account_movements import AccountMovements
from ppi_wrapper import get_ppi, ACCOUNT

router = APIRouter()

class DataPoint(BaseModel):
    date: str
    amount: float
    description: str
    currency: str

class HistoryResponse(BaseModel):
    movements: list[DataPoint]

@router.get("/history", response_model=HistoryResponse, tags=["history"])
async def get_history():
    try:
        ppi = get_ppi()
        date_to = date.today()
        date_from = date_to - timedelta(days=365)
        movements = ppi.account.get_movements(
            AccountMovements(ACCOUNT, date_from, date_to, None)
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PPI API error: {exc}")

    points = []
    for m in (movements or []):
        points.append(DataPoint(
            date=str(m.get("settlementDate") or m.get("date") or ""),
            amount=float(m.get("amount") or 0),
            description=str(m.get("description") or ""),
            currency=str(m.get("currency") or "ARS"),
        ))

    return HistoryResponse(movements=points)
