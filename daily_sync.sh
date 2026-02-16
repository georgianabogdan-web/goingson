#!/bin/bash
# Daily sync script for Granola meeting transcript backup.
# Schedule this with cron or launchd to run every evening.
#
# Cron example (run at 8pm daily):
#   0 20 * * * /path/to/granola-drive-backup/daily_sync.sh
#
# Or use the launchd plist for macOS (see setup instructions in README).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/sync.log"
VENV_DIR="${SCRIPT_DIR}/venv"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "Starting daily Granola sync..."

# Activate virtual environment
if [ -d "$VENV_DIR" ]; then
    source "$VENV_DIR/bin/activate"
else
    log "Error: Virtual environment not found at $VENV_DIR. Run setup first."
    exit 1
fi

# Run the sync
cd "$SCRIPT_DIR"
python backup.py --sync --days 2 2>&1 | tee -a "$LOG_FILE"

log "Daily sync complete."
