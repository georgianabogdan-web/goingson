"""Google Drive uploader for Granola meeting transcripts."""

import io
import json
import os
from pathlib import Path
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload

SCOPES = ["https://www.googleapis.com/auth/drive.file"]
TOKEN_PATH = Path(__file__).parent / "token.json"
CREDENTIALS_PATH = Path(__file__).parent / "credentials.json"


class DriveUploader:
    """Uploads files to Google Drive using OAuth2."""

    def __init__(
        self,
        credentials_path: Optional[str] = None,
        token_path: Optional[str] = None,
    ):
        self.credentials_path = Path(credentials_path) if credentials_path else CREDENTIALS_PATH
        self.token_path = Path(token_path) if token_path else TOKEN_PATH
        self.service = None
        self._authenticate()

    def _authenticate(self):
        """Authenticate with Google Drive via OAuth2."""
        creds = None

        if self.token_path.exists():
            creds = Credentials.from_authorized_user_file(str(self.token_path), SCOPES)

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not self.credentials_path.exists():
                    raise FileNotFoundError(
                        f"Google OAuth credentials file not found at {self.credentials_path}. "
                        "Download it from the Google Cloud Console: "
                        "https://console.cloud.google.com/apis/credentials"
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    str(self.credentials_path), SCOPES
                )
                creds = flow.run_local_server(port=0)

            # Save the token for future runs
            with open(self.token_path, "w") as f:
                f.write(creds.to_json())

        self.service = build("drive", "v3", credentials=creds)

    def get_or_create_folder(self, folder_name: str, parent_id: Optional[str] = None) -> str:
        """Get or create a folder in Google Drive. Returns the folder ID."""
        query = (
            f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' "
            f"and trashed = false"
        )
        if parent_id:
            query += f" and '{parent_id}' in parents"

        results = self.service.files().list(
            q=query, spaces="drive", fields="files(id, name)"
        ).execute()

        files = results.get("files", [])
        if files:
            return files[0]["id"]

        # Create the folder
        metadata = {
            "name": folder_name,
            "mimeType": "application/vnd.google-apps.folder",
        }
        if parent_id:
            metadata["parents"] = [parent_id]

        folder = self.service.files().create(body=metadata, fields="id").execute()
        return folder["id"]

    def upload_file(
        self,
        filename: str,
        content: str,
        mime_type: str,
        folder_id: str,
        update_existing: bool = True,
    ) -> str:
        """Upload a file to Google Drive. Returns the file ID."""
        if update_existing:
            # Check if file already exists in the folder
            query = (
                f"name = '{filename}' and '{folder_id}' in parents and trashed = false"
            )
            results = self.service.files().list(
                q=query, spaces="drive", fields="files(id)"
            ).execute()

            existing = results.get("files", [])
            if existing:
                # Update existing file
                media = MediaInMemoryUpload(
                    content.encode("utf-8"), mimetype=mime_type
                )
                self.service.files().update(
                    fileId=existing[0]["id"], media_body=media
                ).execute()
                return existing[0]["id"]

        # Create new file
        metadata = {
            "name": filename,
            "parents": [folder_id],
        }
        media = MediaInMemoryUpload(content.encode("utf-8"), mimetype=mime_type)
        file = self.service.files().create(
            body=metadata, media_body=media, fields="id"
        ).execute()
        return file["id"]

    def file_exists(self, filename: str, folder_id: str) -> bool:
        """Check if a file already exists in a folder."""
        query = f"name = '{filename}' and '{folder_id}' in parents and trashed = false"
        results = self.service.files().list(
            q=query, spaces="drive", fields="files(id)"
        ).execute()
        return len(results.get("files", [])) > 0
