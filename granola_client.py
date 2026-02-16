"""Client for Granola's API to fetch meeting documents and transcripts."""

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests

GRANOLA_API_BASE = "https://api.granola.ai"
WORKOS_AUTH_URL = "https://api.workos.com/user_management/authenticate"

# Default Granola client ID (from the desktop app)
GRANOLA_CLIENT_ID = "client_01J1BQHE5SHYA0WNBSZA5V1BZG"

SUPABASE_PATH = Path.home() / "Library" / "Application Support" / "Granola" / "supabase.json"


class GranolaAuthError(Exception):
    pass


class GranolaClient:
    """Client for interacting with the Granola API."""

    def __init__(self, access_token: Optional[str] = None, refresh_token: Optional[str] = None):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self._session = requests.Session()
        self._session.headers.update({
            "Content-Type": "application/json",
            "User-Agent": "Granola/5.354.0",
        })

        if not self.access_token:
            self._load_token_from_local()

    def _load_token_from_local(self):
        """Load auth token from local Granola installation."""
        if not SUPABASE_PATH.exists():
            raise GranolaAuthError(
                f"Granola auth file not found at {SUPABASE_PATH}. "
                "Make sure Granola is installed and you're logged in."
            )

        with open(SUPABASE_PATH) as f:
            data = json.load(f)

        # The supabase.json contains the refresh token we need
        # Try to find the access token or refresh token
        if "access_token" in data:
            self.access_token = data["access_token"]
        if "refresh_token" in data:
            self.refresh_token = data["refresh_token"]

        if not self.access_token and not self.refresh_token:
            raise GranolaAuthError(
                "No access_token or refresh_token found in Granola auth file. "
                "Make sure you're logged into Granola."
            )

    def _ensure_auth(self):
        """Ensure we have a valid access token, refreshing if needed."""
        if self.access_token:
            return

        if not self.refresh_token:
            raise GranolaAuthError("No access token or refresh token available.")

        self._refresh_access_token()

    def _refresh_access_token(self):
        """Refresh the access token using the refresh token."""
        resp = requests.post(WORKOS_AUTH_URL, json={
            "client_id": GRANOLA_CLIENT_ID,
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
        })

        if resp.status_code != 200:
            raise GranolaAuthError(f"Failed to refresh token: {resp.status_code} {resp.text}")

        data = resp.json()
        self.access_token = data["access_token"]
        # Refresh tokens are single-use, save the new one
        self.refresh_token = data.get("refresh_token", self.refresh_token)

    def _api_request(self, endpoint: str, payload: dict, retries: int = 2) -> dict:
        """Make an authenticated API request."""
        self._ensure_auth()

        for attempt in range(retries + 1):
            resp = self._session.post(
                f"{GRANOLA_API_BASE}{endpoint}",
                json=payload,
                headers={"Authorization": f"Bearer {self.access_token}"},
            )

            if resp.status_code == 401 and attempt < retries:
                # Token expired, try refreshing
                self.access_token = None
                self._ensure_auth()
                continue

            resp.raise_for_status()
            return resp.json()

        raise GranolaAuthError("Failed to authenticate after retries.")

    def get_documents(self, limit: int = 100, offset: int = 0) -> list[dict]:
        """Fetch a page of documents."""
        result = self._api_request("/v2/get-documents", {
            "limit": limit,
            "offset": offset,
            "include_last_viewed_panel": True,
        })
        return result if isinstance(result, list) else result.get("documents", result.get("data", []))

    def get_all_documents(self) -> list[dict]:
        """Fetch all documents with pagination."""
        all_docs = []
        offset = 0
        page_size = 100

        while True:
            docs = self.get_documents(limit=page_size, offset=offset)
            if not docs:
                break
            all_docs.extend(docs)
            if len(docs) < page_size:
                break
            offset += page_size
            time.sleep(0.5)  # Rate limiting courtesy

        return all_docs

    def get_transcript(self, document_id: str) -> list[dict]:
        """Fetch the transcript for a specific document."""
        result = self._api_request("/v1/get-document-transcript", {
            "document_id": document_id,
        })
        return result if isinstance(result, list) else result.get("transcript", result.get("data", []))

    def get_documents_in_date_range(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> list[dict]:
        """Fetch all documents within a date range."""
        all_docs = self.get_all_documents()
        filtered = []

        for doc in all_docs:
            # Try multiple date fields
            date_str = doc.get("meeting_date") or doc.get("created_at") or doc.get("updated_at")
            if not date_str:
                continue

            try:
                # Handle various date formats
                doc_date = _parse_date(date_str)
                if start_date <= doc_date <= end_date:
                    filtered.append(doc)
            except (ValueError, TypeError):
                continue

        return filtered


def _parse_date(date_str: str) -> datetime:
    """Parse a date string in various formats."""
    for fmt in [
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d",
    ]:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    # Try dateutil as fallback
    from dateutil.parser import parse
    return parse(date_str).replace(tzinfo=None)
