#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} $1"; }

cleanup() {
  log "Stopping awake..."
  kill "$SLEEP_PID" 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

log "Starting awake — keeping system alive"

# 1. Prevent system sleep via systemd-inhibit
if command -v systemd-inhibit &>/dev/null; then
  systemd-inhibit --what=sleep:idle:handle-lid-switch \
    --who="awake.sh" --why="Keep bot running" \
    sleep infinity &
  SLEEP_PID=$!
  log "systemd-inhibit active (PID $SLEEP_PID)"
else
  warn "systemd-inhibit not found — sleep may still occur"
  SLEEP_PID=""
fi

# 2. Disable screen lock/screensaver
if command -v xset &>/dev/null; then
  xset s off 2>/dev/null
  xset -dpms 2>/dev/null
  xset s noblank 2>/dev/null
  log "Screen blanking/power-saving disabled"
fi
if command -v gsettings &>/dev/null; then
  gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null
  gsettings set org.gnome.desktop.screensaver idle-activation-enabled false 2>/dev/null
  gsettings set org.gnome.desktop.screensaver lock-enabled false 2>/dev/null
fi

# 3. Main keep-alive loop
COUNT=0
while true; do
  COUNT=$((COUNT + 1))

  # Jiggle mouse if possible
  if command -v xdotool &>/dev/null && [ -n "$DISPLAY" ]; then
    xdotool mousemove_relative 1 1 2>/dev/null
    xdotool mousemove_relative -- -1 -1 2>/dev/null
  fi

  # Keep network alive
  curl -s --max-time 5 https://estralisfest2026.vercel.app >/dev/null 2>&1
  curl -s --max-time 5 https://estralis-kw3j.onrender.com/api/theme/status >/dev/null 2>&1

  # Check bot processes
  BOT_COUNT=$(pgrep -f "estralis-bot/index.js" 2>/dev/null | wc -l)
  DASH_COUNT=$(pgrep -f "dashboard/server.js" 2>/dev/null | wc -l)

  if [ $((COUNT % 6)) -eq 0 ]; then
    log "Alive — bots:$BOT_COUNT dash:$DASH_COUNT uptime:$(uptime -p | sed 's/up //')"
  fi

  sleep 10
done
