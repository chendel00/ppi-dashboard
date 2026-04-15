"""
PPI API Client wrapper.
Credentials are loaded from environment variables — never hardcoded.
"""

import os
import requests
from functools import lru_cache
from typing import Optional

PPI_BASE_URL = "https://clientapi.portfoliopersonal.com"


class PPIClient:
    def __init__(self):
        self.api_key = os.environ["PPI_API_KEY"]
        self.api_secret = os.environ["PPI_API_SECRET"]
        self.account_number = os.environ.get("PPI_ACCOUNT_NUMBER", "")
        self._token: Optional[str] = None
        self.session = requests.Session()

    # ── Auth ──────────────────────────────────────────────────────────────────

    def _authenticate(self) -> str:
        """Obtain a JWT from PPI and cache it."""
        url = f"{PPI_BASE_URL}/api/1.0/Account/LoginApi"
        payload = {"ApiKey": self.api_key, "ApiSecret": self.api_secret}
        resp = self.session.post(url, json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        self._token = data["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self._token}"})
        return self._token

    def _get(self, path: str, params: dict = None) -> dict:
        if not self._token:
            self._authenticate()
        url = f"{PPI_BASE_URL}{path}"
        resp = self.session.get(url, params=params, timeout=15)
        if resp.status_code == 401:
            # Token expired — re-auth once
            self._authenticate()
            resp = self.session.get(url, params=params, timeout=15)
        resp.raise_for_status()
        return resp.json()

    # ── Portfolio data ─────────────────────────────────────────────────────────

    def get_positions(self) -> list[dict]:
        """Return current open positions."""
        data = self._get("/api/1.0/Account/Positions", params={"accountNumber": self.account_number})
        return data if isinstance(data, list) else data.get("items", [])

    def get_balances(self) -> dict:
        """Return cash and asset balances."""
        return self._get("/api/1.0/Account/Balance", params={"accountNumber": self.account_number})

    def get_movements(self, from_date: str, to_date: str) -> list[dict]:
        """Return movements (buys/sells/dividends) in a date range.
        Dates in YYYY-MM-DD format.
        """
        return self._get(
            "/api/1.0/Account/Movements",
            params={
                "accountNumber": self.account_number,
                "dateFrom": from_date,
                "dateTo": to_date,
            },
        )

    def get_ticker_price(self, ticker: str, market: str = "C") -> float:
        """Get last price for a ticker. market='C' = BYMA contado."""
        data = self._get("/api/1.0/MarketData/Current", params={"ticker": ticker, "type": market})
        return float(data.get("price") or data.get("last") or 0)


@lru_cache(maxsize=1)
def get_ppi_client() -> PPIClient:
    """Singleton PPI client (one per process)."""
    return PPIClient()
