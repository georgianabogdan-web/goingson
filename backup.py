#!/usr/bin/env python3
"""
Granola Meeting Transcript Backup to Google Drive.

Usage:
    # Initial backfill (Sep 2025 - Feb 2026)
    python backup.py --backfill

    # Backfill with custom date range
    python backup.py --from 2025-06-01 --to 2025-12-31

    # Daily sync (backs up meetings since last sync)
    python backup.py --sync

    # Sync meetings from the last N days
    python backup.py --sync --days 3
"""

import argparse
import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

from granola_client import GranolaClient, GranolaAuthError
from drive_uploader import DriveUploader
from formatter import format_transcript_markdown, format_transcript_json, make_filename

DRIVE_FOLDER_NAME = "Granola Meeting Transcripts"
LAST_SYNC_FILE = Path(__file__).parent / ".last_sync"

# Default backfill range
DEFAULT_START = datetime(2025, 9, 1)
DEFAULT_END = datetime(2026, 2, 28)


def load_last_sync() -> datetime:
    """Load the timestamp of the last successful sync."""
    if LAST_SYNC_FILE.exists():
        ts = LAST_SYNC_FILE.read_text().strip()
        return datetime.fromisoformat(ts)
    # Default to 24 hours ago
    return datetime.utcnow() - timedelta(days=1)


def save_last_sync(ts: datetime):
    """Save the timestamp of the last successful sync."""
    LAST_SYNC_FILE.write_text(ts.isoformat())


def run_backup(
    start_date: datetime,
    end_date: datetime,
    drive_folder_name: str = DRIVE_FOLDER_NAME,
    skip_existing: bool = True,
):
    """Back up Granola transcripts to Google Drive."""
    print(f"Connecting to Granola API...")
    try:
        granola = GranolaClient()
    except GranolaAuthError as e:
        print(f"Error: {e}")
        sys.exit(1)

    print(f"Authenticating with Google Drive...")
    try:
        drive = DriveUploader()
    except FileNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Get or create the target folder
    folder_id = drive.get_or_create_folder(drive_folder_name)
    print(f"Using Drive folder: '{drive_folder_name}'")

    # Fetch documents in date range
    print(f"Fetching meetings from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}...")
    documents = granola.get_documents_in_date_range(start_date, end_date)
    print(f"Found {len(documents)} meetings in range.")

    if not documents:
        print("No meetings to back up.")
        return

    backed_up = 0
    skipped = 0
    errors = 0

    for i, doc in enumerate(documents, 1):
        doc_id = doc.get("document_id", doc.get("id", "unknown"))
        title = doc.get("title", "Untitled")
        md_filename = make_filename(doc, "md")
        json_filename = make_filename(doc, "json")

        print(f"  [{i}/{len(documents)}] {title}...", end=" ", flush=True)

        # Check if already backed up
        if skip_existing and drive.file_exists(md_filename, folder_id):
            print("already exists, skipping.")
            skipped += 1
            continue

        try:
            # Fetch transcript
            transcript = granola.get_transcript(doc_id)

            # Format and upload markdown
            md_content = format_transcript_markdown(doc, transcript)
            drive.upload_file(md_filename, md_content, "text/markdown", folder_id)

            # Format and upload JSON
            json_content = format_transcript_json(doc, transcript)
            drive.upload_file(json_filename, json_content, "application/json", folder_id)

            print("done.")
            backed_up += 1

            # Rate limiting
            time.sleep(0.5)

        except Exception as e:
            print(f"error: {e}")
            errors += 1

    print(f"\nBackup complete: {backed_up} backed up, {skipped} skipped, {errors} errors.")


def main():
    parser = argparse.ArgumentParser(
        description="Back up Granola meeting transcripts to Google Drive."
    )

    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument(
        "--backfill",
        action="store_true",
        help="Run initial backfill (Sep 2025 - Feb 2026 by default)",
    )
    mode.add_argument(
        "--sync",
        action="store_true",
        help="Sync new meetings since last backup",
    )

    parser.add_argument(
        "--from",
        dest="start_date",
        type=str,
        help="Start date for backfill (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--to",
        dest="end_date",
        type=str,
        help="End date for backfill (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=1,
        help="For --sync: number of days to look back (default: 1)",
    )
    parser.add_argument(
        "--folder",
        type=str,
        default=DRIVE_FOLDER_NAME,
        help=f"Google Drive folder name (default: '{DRIVE_FOLDER_NAME}')",
    )
    parser.add_argument(
        "--no-skip",
        action="store_true",
        help="Don't skip existing files (re-upload all)",
    )

    args = parser.parse_args()

    if args.backfill:
        start = datetime.strptime(args.start_date, "%Y-%m-%d") if args.start_date else DEFAULT_START
        end = datetime.strptime(args.end_date, "%Y-%m-%d") if args.end_date else DEFAULT_END
    else:
        # Sync mode
        if args.start_date:
            start = datetime.strptime(args.start_date, "%Y-%m-%d")
        else:
            start = load_last_sync() - timedelta(days=args.days)
        end = datetime.utcnow()

    sync_start = datetime.utcnow()
    run_backup(start, end, args.folder, skip_existing=not args.no_skip)

    if args.sync:
        save_last_sync(sync_start)
        print(f"Sync timestamp saved. Next sync will pick up from {sync_start.isoformat()}.")


if __name__ == "__main__":
    main()
