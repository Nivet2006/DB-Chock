#!/bin/bash

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

BOT="node $SCRIPT_DIR/index.js"
CSV="$SCRIPT_DIR/output.csv"
DASHBOARD="node $SCRIPT_DIR/dashboard/server.js"
TARGET_FLAG="$SCRIPT_DIR/logs/target.flag"

print_banner() {
  echo -e "${CYAN}"
  echo "  ╔═════════════════════════════════════════════════╗"
  echo "  ║              DATABASE CHOCK                     ║"
  echo "  ║               ft. SNAKEKING                     ║"
  echo "  ╚═════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

log_step() { echo -e "\n${GREEN}[✓]${NC} ${BOLD}$1${NC}"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_err()  { echo -e "${RED}[✗]${NC} $1"; }

get_stats() {
  if [ ! -f "$CSV" ]; then echo "0 0 0"; return; fi
  local total=$(tail -n +2 "$CSV" | grep -c . 2>/dev/null || echo 0)
  local success=$(grep -c ',SUCCESS' "$CSV" 2>/dev/null || echo 0)
  local failed=$(grep -c ',FAILURE' "$CSV" 2>/dev/null || echo 0)
  echo "$total $success $failed"
}

show_stats() {
  local s=($(get_stats))
  [ -z "${s[0]}" ] && s[0]=0; [ -z "${s[1]}" ] && s[1]=0; [ -z "${s[2]}" ] && s[2]=0
  echo ""
  echo -e "  ${BOLD}STATS${NC}  ${GREEN}OK:${NC} ${s[1]} ${BOLD}||${NC} ${RED}FAIL:${NC} ${s[2]} ${BOLD}||${NC} ${YELLOW}TOTAL:${NC} ${s[0]} ${BOLD}||${NC} ${BOLD}RATE:${NC} $((s[0] > 0 ? s[1] * 100 / s[0] : 0))%"
  echo ""
}

count_names() { wc -l < "$SCRIPT_DIR/NAMES.TXT" 2>/dev/null || echo 100; }

kill_all() {
  pkill -f "cloudflared" 2>/dev/null; wait 2>/dev/null
  pkill -f "estralis-bot/index.js" 2>/dev/null; wait 2>/dev/null
  pkill -f "dashboard/server.js" 2>/dev/null; wait 2>/dev/null
  pkill -f "tor --SocksPort" 2>/dev/null; wait 2>/dev/null
  log_step "All processes stopped"
}

reset_csv() {
  echo -e "\n  ${YELLOW}clearing previous cache data...${NC}"
  echo '"Timestamp","Event Name","Full Name","Email","Phone","College","Branch","Semester","UTR","Sender UPI","Payee UPI","Registration Reference Number","Status"' > "$CSV"
  rm -f "$SCRIPT_DIR/screenshots/"*.png "$SCRIPT_DIR/generated_receipts/"*.jpg "$SCRIPT_DIR/logs/"*.log 2>/dev/null || true
  log_step "Cache cleared — fresh start"
}

set_target() {
  local val="$1"
  echo "$val" > "$TARGET_FLAG"
}

install_deps() {
  log_step "Installing/checking npm packages..."
  cd "$SCRIPT_DIR" && npm install
  if ! npx playwright install chromium 2>/dev/null; then npx playwright install chromium; fi
  if ! command -v cloudflared &>/dev/null; then
    log_step "Installing cloudflared..."
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
    sudo dpkg -i /tmp/cloudflared.deb 2>/dev/null || sudo apt install -f -y
    rm -f /tmp/cloudflared.deb
  fi
  mkdir -p "$SCRIPT_DIR"/{uploads,logs,generated_receipts,screenshots,logos}
  log_step "Ready"
}

setup_tor() {
  if ! command -v tor &>/dev/null; then
    log_step "Installing Tor..."
    sudo apt install -y tor 2>/dev/null
  fi
  log_step "Tor is available"
}

tor_instance() {
  local port=$1
  local data_dir="/tmp/tor_$port"
  mkdir -p "$data_dir"
  tor --SocksPort "$port" --DataDirectory "$data_dir" --RunAsDaemon 1 2>/dev/null
}

print_banner

if [ ! -d "$SCRIPT_DIR/node_modules" ]; then install_deps; fi

TOTAL_NAMES=$(count_names)

while true; do
  show_stats
  echo -e "${BOLD}─── RUN ─────────────────────────────────────${NC}"
  printf "  ${CYAN}%-8s${NC} %s\n" "1 2 3" "Quick parallel runs"
  printf "  ${CYAN}%-8s${NC} %s\n" "5 10 20" "Quick parallel runs"
  printf "  ${CYAN}%-8s${NC} %s\n" "C" "Custom count + parallel"
  printf "  ${CYAN}%-8s${NC} %s\n" "A" "Run ALL ($TOTAL_NAMES)"
  printf "  ${CYAN}%-8s${NC} %s\n" "I" "Infinite loop (Faker)"
  echo ""
  echo -e "${BOLD}─── DASHBOARD & TUNNEL ──────────────────────${NC}"
  printf "  ${CYAN}%-8s${NC} %s\n" "D" "Dashboard"
  printf "  ${CYAN}%-8s${NC} %s\n" "T" "Dashboard + Cloudflare Tunnel"
  printf "  ${CYAN}%-8s${NC} %s\n" "B" "Bot + Dashboard + Tunnel (opens browser)"
  printf "  ${CYAN}%-8s${NC} %s ${YELLOW}(no browser)${NC}\n" "H" "Headless Bot + Dashboard + Tunnel"
  printf "  ${CYAN}%-8s${NC} %s\n" "ZZ" "Headless + Dashboard + Tunnel + Tor"
  echo ""
  echo -e "${BOLD}─── CONTROLS ────────────────────────────────${NC}"
  printf "  ${CYAN}%-8s${NC} %s\n" "K" "Kill all processes"
  printf "  ${CYAN}%-8s${NC} %s\n" "R" "Reset CSV, logs, screenshots"
  printf "  ${CYAN}%-8s${NC} %s\n" "S" "Setup / Install dependencies"
  printf "  ${CYAN}%-8s${NC} %s\n" "L" "View live logs"
  printf "  ${CYAN}%-8s${NC} %s\n" "0" "Exit"
  echo ""
  echo -e "  ${YELLOW}Kill password: Gcem${NC}"
  echo ""
  echo -n "Choice: "
  read -r choice

  case $choice in
    1|2|3|5|10|20)
      reset_csv
      set_target "$choice"
      echo -n "Parallel workers? [${choice}]: "; read -r workers
      workers=${workers:-$choice}
      log_step "$choice registrations, $workers parallel"
      $BOT $choice --parallel "$workers"
      ;;
    C|c)
      reset_csv
      echo -n "How many? [10]: "; read -r count
      count=${count:-10}
      set_target "$count"
      echo -n "Parallel workers? [5]: "; read -r workers
      workers=${workers:-5}
      log_step "$count registrations, $workers parallel"
      $BOT $count --parallel "$workers"
      ;;
    A|a)
      reset_csv
      set_target "$TOTAL_NAMES"
      echo -n "Parallel workers? [5]: "; read -r workers
      workers=${workers:-5}
      log_step "ALL $TOTAL_NAMES names, $workers parallel"
      $BOT --parallel "$workers"
      ;;
    I|i)
      reset_csv
      set_target "INF"
      echo -n "Parallel workers? [5]: "; read -r workers
      workers=${workers:-5}
      log_step "INFINITE loop, $workers parallel"
      $BOT --parallel "$workers" --infinite
      ;;
    D|d)
      log_step "Dashboard: http://localhost:4000"
      $DASHBOARD &
      DASH_PID=$!
      echo "Press Enter to stop..."; read -r
      kill $DASH_PID 2>/dev/null
      ;;
    T|t)
      log_step "Dashboard + Cloudflare Tunnel"
      $DASHBOARD &
      DASH_PID=$!
      sleep 1
      echo -e "  ${YELLOW}Public URL at *.trycloudflare.com${NC}"
      cloudflared tunnel --url http://localhost:4000 2>/dev/null &
      CF_PID=$!
      echo "Press Enter to stop..."; read -r
      kill $DASH_PID $CF_PID 2>/dev/null; wait $CF_PID 2>/dev/null
      ;;
    B|b)
      reset_csv
      echo -n "How many? [$TOTAL_NAMES]: "; read -r count
      count=${count:-$TOTAL_NAMES}
      set_target "$count"
      echo -n "Parallel workers? [5]: "; read -r workers
      workers=${workers:-5}
      echo -n "Infinite? (y/n) [n]: "; read -r inf
      extra=""; [[ "$inf" == "y" || "$inf" == "Y" ]] && extra="--infinite" && set_target "INF"
      log_step "Starting Dashboard + Tunnel + Bot (visible)..."
      $DASHBOARD &
      DASH_PID=$!
      sleep 1
      cloudflared tunnel --url http://localhost:4000 2>/dev/null &
      CF_PID=$!
      sleep 2
      $BOT $count --parallel "$workers" --headful $extra
      kill $DASH_PID $CF_PID 2>/dev/null; wait $CF_PID 2>/dev/null
      log_step "Done"
      ;;
    H|h)
      reset_csv
      echo -n "How many? [$TOTAL_NAMES]: "; read -r count
      count=${count:-$TOTAL_NAMES}
      set_target "$count"
      echo -n "Parallel workers? [10]: "; read -r workers
      workers=${workers:-10}
      echo -n "Infinite? (y/n) [n]: "; read -r inf
      extra=""; [[ "$inf" == "y" || "$inf" == "Y" ]] && extra="--infinite" && set_target "INF"
      log_step "Starting HEADLESS Bot + Dashboard + Tunnel..."
      $DASHBOARD &
      DASH_PID=$!
      sleep 1
      cloudflared tunnel --url http://localhost:4000 2>/dev/null &
      CF_PID=$!
      sleep 2
      echo -e "  ${CYAN}Dashboard:${NC} http://localhost:4000"
      echo -e "  ${YELLOW}Public URL in cloudflared output above${NC}"
      $BOT $count --parallel "$workers" $extra
      kill $DASH_PID $CF_PID 2>/dev/null; wait $CF_PID 2>/dev/null
      log_step "Done"
      ;;
    ZZ|zz)
      setup_tor
      reset_csv
      echo -n "How many? [$TOTAL_NAMES]: "; read -r count
      count=${count:-$TOTAL_NAMES}
      set_target "$count"
      echo -n "Parallel workers? [10]: "; read -r workers
      workers=${workers:-10}
      echo -n "Infinite? (y/n) [n]: "; read -r inf
      extra=""; [[ "$inf" == "y" || "$inf" == "Y" ]] && extra="--infinite" && set_target "INF"
      TOR_BASE=9050
      TOR_PORTS=""
      TOR_COUNT=$(( workers > 5 ? 5 : workers ))
      for i in $(seq 0 $((TOR_COUNT - 1))); do
        p=$((TOR_BASE + i))
        tor_instance "$p"
        TOR_PORTS="${TOR_PORTS}${p},"
      done
      TOR_PORTS="${TOR_PORTS%,}"
      log_step "$TOR_COUNT Tor instances on ports $TOR_PORTS (sharing among $workers workers)"
      log_step "Starting HEADLESS Bot + Dashboard + Tunnel + Tor..."
      $DASHBOARD &
      DASH_PID=$!
      sleep 1
      cloudflared tunnel --url http://localhost:4000 2>/dev/null &
      CF_PID=$!
      sleep 2
      echo -e "  ${CYAN}Dashboard:${NC} http://localhost:4000"
      echo -e "  ${YELLOW}Public URL in cloudflared output above${NC}"
      $BOT $count --parallel "$workers" $extra --tor-ports="$TOR_PORTS"
      kill $DASH_PID $CF_PID 2>/dev/null; wait $CF_PID 2>/dev/null
      log_step "Done"
      ;;
    K|k) kill_all ;;
    R|r) reset_csv ;;
    S|s) install_deps ;;
    L|l)
      LATEST=$(ls -t "$SCRIPT_DIR/logs/"*.log 2>/dev/null | head -1)
      if [ -n "$LATEST" ]; then tail -f "$LATEST"
      else log_warn "No logs"; fi
      ;;
    0) echo -e "${GREEN}Bye!${NC}"; exit 0 ;;
    *) log_err "Invalid choice" ;;
  esac
  echo ""
done
