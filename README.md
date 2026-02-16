# Granola Drive Backup

Back up your Granola meeting transcripts to Google Drive. Saves both Markdown (for reading) and JSON (for analysis) versions of each meeting.

## What it does

- Fetches meeting documents and full transcripts from Granola's API
- Uploads them to a Google Drive folder as `.md` and `.json` files
- Supports initial backfill of historical meetings and daily incremental sync
- Skips already-backed-up meetings to avoid duplicates

## Prerequisites

- **macOS** with Granola desktop app installed and logged in
- **Python 3.10+**
- A **Google Cloud project** with the Drive API enabled

## Setup

### 1. Install dependencies

```bash
cd granola-drive-backup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Set up Google Drive API credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **Google Drive API**: APIs & Services > Library > search "Google Drive API" > Enable
4. Create OAuth credentials: APIs & Services > Credentials > Create Credentials > OAuth client ID
   - Application type: **Desktop app**
   - Download the JSON file
5. Save it as `credentials.json` in this directory

### 3. Verify Granola is set up

Make sure Granola is installed and you're logged in. The app stores auth tokens at:
```
~/Library/Application Support/Granola/supabase.json
```

## Usage

### Initial backfill (Sep 2025 - Feb 2026)

```bash
python backup.py --backfill
```

With custom date range:
```bash
python backup.py --backfill --from 2025-06-01 --to 2026-01-31
```

### Daily sync

```bash
python backup.py --sync
```

Look back more days:
```bash
python backup.py --sync --days 3
```

### Options

| Flag | Description |
|------|-------------|
| `--backfill` | Run initial backfill (Sep 2025 - Feb 2026 by default) |
| `--sync` | Sync new meetings since last backup |
| `--from YYYY-MM-DD` | Start date |
| `--to YYYY-MM-DD` | End date |
| `--days N` | For sync: look back N days (default: 1) |
| `--folder NAME` | Google Drive folder name (default: "Granola Meeting Transcripts") |
| `--no-skip` | Re-upload all files even if they exist |

## Automated daily sync

### Option A: cron (simple)

```bash
crontab -e
```

Add this line to run at 8pm daily:
```
0 20 * * * /path/to/granola-drive-backup/daily_sync.sh
```

### Option B: launchd (macOS native)

1. Edit `com.granola-backup.daily-sync.plist` and update the path to `daily_sync.sh`
2. Install:

```bash
cp com.granola-backup.daily-sync.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.granola-backup.daily-sync.plist
```

To uninstall:
```bash
launchctl unload ~/Library/LaunchAgents/com.granola-backup.daily-sync.plist
rm ~/Library/LaunchAgents/com.granola-backup.daily-sync.plist
```

## Output format

Each meeting produces two files in your Google Drive folder:

- `2025-10-15_Team-Standup.md` - Human-readable with metadata, notes, and transcript
- `2025-10-15_Team-Standup.json` - Structured data with all fields, timestamps, and confidence scores

## Notes

- This uses Granola's internal API (not officially documented). It may break if Granola changes their API.
- The Google OAuth token is saved locally in `token.json` and refreshes automatically.
- The `.last_sync` file tracks when you last synced to avoid re-processing.
- Credentials files (`credentials.json`, `token.json`) are gitignored.
