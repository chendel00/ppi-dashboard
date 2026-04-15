"""
GET /goals
Returns investment goals and progress from goals.json + live portfolio value.
"""

import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ppi_client import get_ppi_client

router = APIRouter()

GOALS_FILE = os.path.join(os.path.dirname(__file__), "..", "goals.json")


class Goal(BaseModel):
    id: str
    name: str
    target_amount: float
    currency: str
    deadline: Optional[str] = None   # ISO date string, e.g. "2026-12-31"
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
        raise HTTPException(status_code=500, detail=f"goals.json parse error: {exc}")


@router.get("/goals", response_model=GoalsResponse, tags=["goals"])
async def get_goals():
    """
    Returns goals defined in goals.json enriched with current portfolio values.
    Progress for 'portfolio_value' type goals is calculated from live PPI data.
    """
    raw_goals = _load_goals()

    try:
        client = get_ppi_client()
        positions = client.get_positions()
        balances = client.get_balances()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"PPI API error: {exc}")

    # Total ARS portfolio value
    total_ars = sum(
        float(p.get("quantity", 0)) * float(p.get("price") or p.get("currentPrice") or 0)
        for p in positions
        if (p.get("currency") or "ARS").upper() == "ARS"
    )
    total_ars += float(balances.get("availableARS") or balances.get("cashARS") or 0)

    # Total USD portfolio value
    total_usd = sum(
        float(p.get("quantity", 0)) * float(p.get("price") or p.get("currentPrice") or 0)
        for p in positions
        if (p.get("currency") or "ARS").upper() == "USD"
    )
    total_usd += float(balances.get("availableUSD") or balances.get("cashUSD") or 0)

    goals: list[Goal] = []
    for g in raw_goals:
        target = float(g.get("target_amount", 0))
        currency = g.get("currency", "ARS").upper()

        # Determine current amount based on goal type
        goal_type = g.get("type", "portfolio_value")
        if goal_type == "portfolio_value":
            current = total_ars if currency == "ARS" else total_usd
        elif goal_type == "fixed":
            current = float(g.get("current_amount", 0))
        else:
            current = float(g.get("current_amount", 0))

        progress = (current / target * 100) if target > 0 else 0.0

        # Simple on-track heuristic: if deadline is set and progress is proportional
        on_track = False
        if g.get("deadline") and target > 0:
            from datetime import date
            try:
                deadline = date.fromisoformat(g["deadline"])
                today = date.today()
                # Created date optional; default to 2024-01-01
                created = date.fromisoformat(g.get("created", "2024-01-01"))
                if deadline > today:
                    total_duration = (deadline - created).days or 1
                    elapsed = (today - created).days
                    expected_progress = (elapsed / total_duration) * 100
                    on_track = progress >= expected_progress * 0.9  # 10% tolerance
            except Exception:
                pass

        goals.append(
            Goal(
                id=g.get("id", ""),
                name=g.get("name", ""),
                target_amount=target,
                currency=currency,
                deadline=g.get("deadline"),
                description=g.get("description"),
                current_amount=round(current, 2),
                progress_pct=round(progress, 2),
                on_track=on_track,
            )
        )

    return GoalsResponse(
        goals=goals,
        total_portfolio_value_ars=round(total_ars, 2),
        total_portfolio_value_usd=round(total_usd, 2),
    )
