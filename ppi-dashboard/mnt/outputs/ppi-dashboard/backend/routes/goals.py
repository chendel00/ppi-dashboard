"""
GET /goals
Returns investment goals and progress from goals.json + live portfolio value.
"""

import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date
from ppi_wrapper import get_ppi, ACCOUNT

router = APIRouter()
GOALS_FILE = os.path.join(os.path.dirname(__file__), "..", "goals.json")


class Goal(BaseModel):
    id: str
    name: str
    target_amount: float
    currency: str
    deadline: Optional[str] = None
    description: Optional[str] = None
    current_amount: float = 0.0
    progress_pct: float = 0.0
    on_track: bool = False


class GoalsResponse(BaseModel):
    goals: list[Goal]
    total_portfolio_value_ars: float
    total_portfolio_value_usd: float


def _load_goals() -> list[dict]:
    try:
        with open(GOALS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"goals.json error: {exc}")


@router.get("/goals", response_model=GoalsResponse, tags=["goals"])
async def get_goals():
    raw_goals = _load_goals()

    try:
        ppi = get_ppi()
        data = ppi.account.get_balance_and_positions(ACCOUNT)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PPI API error: {exc}")

    total_ars = 0.0
    total_usd = 0.0

    raw_groups = data.get("groupedInstruments") or []
    for group in raw_groups:
        items = group.get("instruments") or group.get("detail") or [group]
        for item in items:
            currency = str(item.get("currency") or "ARS").upper()
            market_value = float(item.get("amount") or 0)
            if currency == "USD":
                total_usd += market_value
            else:
                total_ars += market_value

    for avail in (data.get("groupedAvailability") or []):
        symbol = str(avail.get("symbol") or avail.get("currency") or "").upper()
        amount = float(avail.get("amount") or 0)
        if symbol in ("USD", "U$S", "DOLAR"):
            total_usd += amount
        else:
            total_ars += amount

    goals: list[Goal] = []
    for g in raw_goals:
        target = float(g.get("target_amount", 0))
        currency = g.get("currency", "ARS").upper()
        current = total_ars if currency == "ARS" else total_usd
        progress = (current / target * 100) if target > 0 else 0.0

        on_track = False
        if g.get("deadline") and target > 0:
            try:
                deadline = date.fromisoformat(g["deadline"])
                today = date.today()
                created = date.fromisoformat(g.get("created", "2024-01-01"))
                if deadline > today:
                    total_days = (deadline - created).days or 1
                    elapsed = (today - created).days
                    expected = (elapsed / total_days) * 100
                    on_track = progress >= expected * 0.9
            except Exception:
                pass

        goals.append(Goal(
            id=g.get("id", ""),
            name=g.get("name", ""),
            target_amount=target,
            currency=currency,
            deadline=g.get("deadline"),
            description=g.get("description"),
            current_amount=round(current, 2),
            progress_pct=round(progress, 2),
            on_track=on_track,
        ))

    return GoalsResponse(
        goals=goals,
        total_portfolio_value_ars=round(total_ars, 2),
        total_portfolio_value_usd=round(total_usd, 2),
    )
