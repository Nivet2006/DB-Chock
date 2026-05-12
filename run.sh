#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)" || { echo "ERROR: Cannot find script directory"; exit 1; }
cd "$SCRIPT_DIR" 2>/dev/null || { echo "ERROR: Cannot access $SCRIPT_DIR"; exit 1; }

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

BOT="node $SCRIPT_DIR/index.js"
CSV="$SCRIPT_DIR/output.csv"
DASHBOARD="node $SCRIPT_DIR/dashboard/server.js"
TARGET_FLAG="$SCRIPT_DIR/logs/target.flag"

PID_DIR="$SCRIPT_DIR/logs"
DASH_PID_FILE="$PID_DIR/dashboard.pid"
TUNNEL_PID_FILE="$PID_DIR/tunnel.pid"

is_running() {
  local pid=$1
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

deploy_persistent() {
  # Start dashboard if not running
  local dpid=""
  if [ -f "$DASH_PID_FILE" ]; then
    dpid=$(cat "$DASH_PID_FILE")
    if is_running "$dpid"; then
      log_step "Dashboard already running (PID $dpid)"
    else
      dpid=""
    fi
  fi
  if [ -z "$dpid" ]; then
    $DASHBOARD &
    dpid=$!
    echo "$dpid" > "$DASH_PID_FILE"
    log_step "Dashboard started (PID $dpid) — http://localhost:4000"
  fi

  # Start tunnel if not running (skip if cloudflared missing)
  if ! command -v cloudflared &>/dev/null; then
    log_warn "cloudflared not found — dashboard only (install with S for tunnel)"
    return 0
  fi
  local tpid=""
  if [ -f "$TUNNEL_PID_FILE" ]; then
    tpid=$(cat "$TUNNEL_PID_FILE")
    if is_running "$tpid"; then
      log_step "Tunnel already running (PID $tpid)"
      return 0
    fi
  fi
  sleep 1
  cloudflared tunnel --url http://localhost:4000 &>/tmp/cloudflared.log &
  tpid=$!
  echo "$tpid" > "$TUNNEL_PID_FILE"
  sleep 4
  local url=$(grep -oP 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' /tmp/cloudflared.log 2>/dev/null | head -1)
  if [ -n "$url" ]; then
    echo -e "  ${CYAN}Tunnel URL:${NC} ${url}"
  else
    log_warn "Tunnel starting... check 'L' for logs"
  fi
  return 0
}

cleanup() {
  local dpid tpid
  [ -f "$DASH_PID_FILE" ] && dpid=$(cat "$DASH_PID_FILE") && is_running "$dpid" && kill "$dpid" 2>/dev/null
  [ -f "$TUNNEL_PID_FILE" ] && tpid=$(cat "$TUNNEL_PID_FILE") && is_running "$tpid" && kill "$tpid" 2>/dev/null
  pkill -9 -f "cloudflared" 2>/dev/null
  pkill -9 -f "estralis-bot/index.js" 2>/dev/null
  pkill -9 -f "dashboard/server.js" 2>/dev/null
  pkill -9 -f "tor.*--SocksPort" 2>/dev/null
  rm -f "$DASH_PID_FILE" "$TUNNEL_PID_FILE" 2>/dev/null
}
trap cleanup EXIT

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
  local total=$(tail -n +2 "$CSV" 2>/dev/null | grep -c . 2>/dev/null || echo 0)
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

check_resume() {
  local cp="$SCRIPT_DIR/logs/checkpoint.json"
  if [ -f "$cp" ]; then
    local done=$(grep -oP '"done":\s*\K\d+' "$cp" 2>/dev/null || echo 0)
    local total=$(grep -oP '"total":\s*\K\d+' "$cp" 2>/dev/null || echo 0)
    if [ "$done" -gt 0 ] && [ "$total" -gt 0 ]; then
      echo -n "Checkpoint found ($done/$total done). Resume? (y/N): "; read -r ans
      [[ "$ans" == "y" || "$ans" == "Y" ]] && echo "--resume" || echo ""
    fi
  fi
}

run_bot() {
  $BOT "$@"
  local rc=$?
  if [ $rc -ne 0 ]; then
    log_err "Bot exited with code $rc — check logs above for details"
  else
    log_step "Bot finished successfully"
  fi
  echo "" && show_stats
  return $rc
}

kill_all() {
  log_step "Killing all processes..."
  pkill -f "cloudflared" 2>/dev/null
  pkill -f "estralis-bot/index.js" 2>/dev/null
  pkill -f "dashboard/server.js" 2>/dev/null
  pkill -f "tor.*--SocksPort" 2>/dev/null
  sleep 1
  pkill -9 -f "cloudflared" 2>/dev/null
  pkill -9 -f "estralis-bot/index.js" 2>/dev/null
  pkill -9 -f "dashboard/server.js" 2>/dev/null
  pkill -9 -f "tor.*--SocksPort" 2>/dev/null
  log_step "All processes stopped"
}

reset_csv() {
  echo -e "\n  ${YELLOW}clearing previous cache data...${NC}"
  echo '"Timestamp","Event Name","Full Name","Email","Phone","College","Branch","Semester","UTR","Sender UPI","Payee UPI","Registration Reference Number","Status"' > "$CSV" 2>/dev/null
  rm -f "$SCRIPT_DIR/screenshots/"*.png "$SCRIPT_DIR/generated_receipts/"*.jpg "$SCRIPT_DIR/logs/"*.log 2>/dev/null
  log_step "Cache cleared — fresh start"
}

set_target() {
  mkdir -p "$SCRIPT_DIR/logs" 2>/dev/null
  echo "$1" > "$TARGET_FLAG" 2>/dev/null
}

install_deps() {
  log_step "Installing/checking npm packages..."
  cd "$SCRIPT_DIR" && npm install
  local rc=$?
  if [ $rc -ne 0 ]; then
    log_err "npm install failed (code $rc) — check network or run 'npm install' manually"
    return 1
  fi
  if ! npx playwright install chromium 2>/dev/null; then
    npx playwright install chromium 2>&1 || log_err "Playwright browser install failed — run 'npx playwright install chromium' manually"
  fi
  if ! command -v cloudflared &>/dev/null; then
    log_step "Installing cloudflared..."
    curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb 2>/dev/null
    if [ $? -ne 0 ]; then
      log_err "Failed to download cloudflared — install manually from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    else
      sudo dpkg -i /tmp/cloudflared.deb 2>/dev/null || sudo apt install -f -y 2>/dev/null
      rm -f /tmp/cloudflared.deb
      command -v cloudflared &>/dev/null && log_step "Cloudflared installed" || log_err "Cloudflared install failed"
    fi
  fi
  mkdir -p "$SCRIPT_DIR"/{uploads,logs,generated_receipts,screenshots,logos}
  log_step "All dependencies ready"
}

setup_tor() {
  if ! command -v tor &>/dev/null; then
    log_step "Installing Tor (sudo required)..."
    sudo apt install -y tor 2>/dev/null || { log_err "Tor install failed — run 'sudo apt install tor' manually"; return 1; }
  fi
  log_step "Tor installed"
}

get_ip() {
  local proxy="$1"
  if [ -n "$proxy" ]; then
    curl -s --max-time 5 --proxy "$proxy" https://ifconfig.me 2>/dev/null || echo "unreachable"
  else
    curl -s --max-time 5 https://ifconfig.me 2>/dev/null || echo "unreachable"
  fi
}

tor_instance() {
  local port=$1
  local data_dir="/tmp/tor_$port"
  mkdir -p "$data_dir" 2>/dev/null
  tor --SocksPort "$port" --DataDirectory "$data_dir" --RunAsDaemon 1 2>/dev/null
  local rc=$?
  if [ $rc -ne 0 ]; then
    log_err "Tor instance on port $port failed to start (code $rc)"
    return 1
  fi
}

# Check node and required files
check_prereqs() {
  if ! command -v node &>/dev/null; then
    log_err "Node.js is not installed. Install it first:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install -y nodejs"
    return 1
  fi
  if [ ! -f "$SCRIPT_DIR/NAMES.TXT" ]; then
    log_warn "NAMES.TXT not found — creating placeholder"
    echo "John Doe" > "$SCRIPT_DIR/NAMES.TXT"
  fi
  if [ ! -f "$SCRIPT_DIR/COLLEGES.TXT" ]; then
    log_warn "COLLEGES.TXT not found — creating placeholder"
    echo "Default College" > "$SCRIPT_DIR/COLLEGES.TXT"
  fi
  return 0
}

show_deploy_status() {
  local dash="stopped" tunnel="stopped"
  if [ -f "$DASH_PID_FILE" ]; then
    local p=$(cat "$DASH_PID_FILE")
    is_running "$p" && dash="active"
  fi
  if [ -f "$TUNNEL_PID_FILE" ]; then
    local p=$(cat "$TUNNEL_PID_FILE")
    is_running "$p" && tunnel="active"
  fi
  local url=""
  [ -f /tmp/cloudflared.log ] && url=$(grep -oP 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' /tmp/cloudflared.log 2>/dev/null | head -1)
  echo -e "  ${BOLD}DASH:${NC} ${GREEN}$dash${NC}  ${BOLD}TUNNEL:${NC} ${GREEN}$tunnel${NC}${url:+  ${CYAN}→${NC} ${url}}"
}

print_banner
check_prereqs || exit 1

if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo ""
  log_warn "Dependencies not installed. Run 'S' from menu or press Enter to auto-install..."
  read -r -t 5
  install_deps || true
fi

TOTAL_NAMES=$(count_names)

while true; do
  echo -e "${BOLD}─── RUN ─────────────────────────────────────${NC}"
  printf "  ${CYAN}%-8s${NC} %s\n" "1 2 3" "Quick parallel runs"
  printf "  ${CYAN}%-8s${NC} %s\n" "5 10 20" "Quick parallel runs"
  printf "  ${CYAN}%-8s${NC} %s\n" "C" "Custom count + parallel"
  printf "  ${CYAN}%-8s${NC} %s\n" "E" "Target a specific event only"
  printf "  ${CYAN}%-8s${NC} %s\n" "A" "Run ALL ($TOTAL_NAMES)"
  printf "  ${CYAN}%-8s${NC} %s\n" "I" "Infinite loop (Faker)"
  echo ""
  echo -e "${BOLD}─── DASHBOARD & TUNNEL ──────────────────────${NC}"
  show_deploy_status
  printf "  ${CYAN}%-8s${NC} %s\n" "D" "Dashboard only"
  printf "  ${CYAN}%-8s${NC} %s\n" "T" "Dashboard + Tunnel (foreground, press Enter to stop)"
  printf "  ${CYAN}%-8s${NC} %s\n" "B" "Bot + visible browser"
  printf "  ${CYAN}%-8s${NC} %s ${YELLOW}(no browser)${NC}\n" "H" "Headless bot"
  printf "  ${CYAN}%-8s${NC} %s\n" "ZZ" "Headless + Tor"
  echo ""
  echo -e "${BOLD}─── CONTROLS ────────────────────────────────${NC}"
  printf "  ${CYAN}%-8s${NC} %s\n" "K" "Kill all running processes"
  printf "  ${CYAN}%-8s${NC} %s\n" "R" "Reset CSV, logs, screenshots"
  printf "  ${CYAN}%-8s${NC} %s\n" "S" "Setup / Install dependencies"
  printf "  ${CYAN}%-8s${NC} %s\n" "L" "View live logs"
  printf "  ${CYAN}%-8s${NC} %s\n" "0" "Exit"
  echo ""
  echo -n "Choice: "
  read -r choice || { echo ""; exit 0; }

  case $choice in
     1|2|3|5|10|20)
      set_target "$choice"
      echo -n "Parallel workers? [${choice}]: "; read -r workers
      workers=${workers:-$choice}
      echo -n "Delay speed (fast/medium/slow) [medium]: "; read -r speed
      delay_opts=""; [[ "$speed" == "fast" ]] && delay_opts="--min-delay=20 --max-delay=80"; [[ "$speed" == "slow" ]] && delay_opts="--min-delay=200 --max-delay=500"
      deploy_persistent
      log_step "$choice registrations, $workers parallel"
      run_bot $choice --parallel "$workers" $delay_opts $(check_resume)
      ;;
    C|c)
      deploy_persistent
      echo -n "How many? [10]: "; read -r count
      count=${count:-10}
      set_target "$count"
      echo -n "Parallel workers? [5]: "; read -r workers
      workers=${workers:-5}
      echo -n "Delay speed (fast/medium/slow) [medium]: "; read -r speed
      delay_opts=""; [[ "$speed" == "fast" ]] && delay_opts="--min-delay=20 --max-delay=80"; [[ "$speed" == "slow" ]] && delay_opts="--min-delay=200 --max-delay=500"
      log_step "$count registrations, $workers parallel"
      run_bot $count --parallel "$workers" $delay_opts $(check_resume)
      ;;
    E|e)
      deploy_persistent
      log_step "Fetching event list from estralisfest..."
      OUTPUT=$(node "$SCRIPT_DIR/index.js" --list-events 2>/dev/null)
      echo "$OUTPUT"
      LAST_LINE=$(echo "$OUTPUT" | grep -oP 'Total:\s*\K\d+')
      echo ""
      echo -n "Select event number: "; read -r eventNum
      [[ -z "$eventNum" ]] && continue
      eventIdx=$((eventNum - 1))
      if [ $eventIdx -lt 0 ] 2>/dev/null; then continue; fi
      if [ -n "$LAST_LINE" ] && [ "$eventIdx" -ge "$LAST_LINE" ] 2>/dev/null; then
        log_err "Invalid event number — max is $LAST_LINE"
        continue
      fi
      echo -n "How many? [10]: "; read -r count
      count=${count:-10}
      set_target "$count"
      echo -n "Parallel workers? [5]: "; read -r workers
      workers=${workers:-5}
      echo -n "Delay speed (fast/medium/slow) [medium]: "; read -r speed
      delay_opts=""; [[ "$speed" == "fast" ]] && delay_opts="--min-delay=20 --max-delay=80"; [[ "$speed" == "slow" ]] && delay_opts="--min-delay=200 --max-delay=500"
      log_step "$count registrations for event #$eventNum, $workers parallel"
      run_bot $count --parallel "$workers" --event-idx "$eventIdx" $delay_opts $(check_resume)
      ;;
    A|a)
      deploy_persistent
      set_target "$TOTAL_NAMES"
      echo -n "Parallel workers? [5]: "; read -r workers
      workers=${workers:-5}
      echo -n "Delay speed (fast/medium/slow) [medium]: "; read -r speed
      delay_opts=""; [[ "$speed" == "fast" ]] && delay_opts="--min-delay=20 --max-delay=80"; [[ "$speed" == "slow" ]] && delay_opts="--min-delay=200 --max-delay=500"
      log_step "ALL $TOTAL_NAMES names, $workers parallel"
      run_bot --parallel "$workers" $delay_opts $(check_resume)
      ;;
    I|i)
      deploy_persistent
      set_target "INF"
      echo -n "Parallel workers? [5]: "; read -r workers
      workers=${workers:-5}
      echo -n "Delay speed (fast/medium/slow) [medium]: "; read -r speed
      delay_opts=""; [[ "$speed" == "fast" ]] && delay_opts="--min-delay=20 --max-delay=80"; [[ "$speed" == "slow" ]] && delay_opts="--min-delay=200 --max-delay=500"
      log_step "INFINITE loop, $workers parallel"
      run_bot --parallel "$workers" --infinite $delay_opts
      ;;
    D|d)
      log_step "Starting Dashboard at http://localhost:4000"
      $DASHBOARD &
      DASH_PID=$!
      echo "Press Enter to stop dashboard..."; read -r
      kill $DASH_PID 2>/dev/null; wait $DASH_PID 2>/dev/null
      log_step "Dashboard stopped"
      ;;
    T|t)
      log_step "Starting Dashboard + Cloudflare Tunnel"
      $DASHBOARD &
      DASH_PID=$!
      sleep 1
      if ! command -v cloudflared &>/dev/null; then
        log_err "cloudflared not found — install it (option S) or use D for dashboard only"
        kill $DASH_PID 2>/dev/null
        continue
      fi
      cloudflared tunnel --url http://localhost:4000 &
      CF_PID=$!
      sleep 3
      echo -e "  ${CYAN}Tunnel URL:${NC} https://<random>.trycloudflare.com (see above)"
      echo "Press Enter to stop..."; read -r
      kill $DASH_PID $CF_PID 2>/dev/null; wait $CF_PID 2>/dev/null
      log_step "Tunnel stopped"
      ;;
    B|b)
      deploy_persistent
      echo -n "How many? [$TOTAL_NAMES]: "; read -r count
      count=${count:-$TOTAL_NAMES}
      set_target "$count"
      echo -n "Parallel workers? [5]: "; read -r workers
      workers=${workers:-5}
      echo -n "Infinite? (y/n) [n]: "; read -r inf
      extra=""; [[ "$inf" == "y" || "$inf" == "Y" ]] && extra="--infinite" && set_target "INF"
      echo -n "Delay speed (fast/medium/slow) [medium]: "; read -r speed
      delay_opts=""; [[ "$speed" == "fast" ]] && delay_opts="--min-delay=20 --max-delay=80"; [[ "$speed" == "slow" ]] && delay_opts="--min-delay=200 --max-delay=500"
      sleep 1
      log_step "Running bot (visible browser) + dashboard"
      run_bot $count --parallel "$workers" --headful $extra $delay_opts $(check_resume)
      ;;
    H|h)
      deploy_persistent
      echo -n "How many? [$TOTAL_NAMES]: "; read -r count
      count=${count:-$TOTAL_NAMES}
      set_target "$count"
      echo -n "Parallel workers? [10]: "; read -r workers
      workers=${workers:-10}
      echo -n "Infinite? (y/n) [n]: "; read -r inf
      extra=""; [[ "$inf" == "y" || "$inf" == "Y" ]] && extra="--infinite" && set_target "INF"
      echo -n "Delay speed (fast/medium/slow) [medium]: "; read -r speed
      delay_opts=""; [[ "$speed" == "fast" ]] && delay_opts="--min-delay=20 --max-delay=80"; [[ "$speed" == "slow" ]] && delay_opts="--min-delay=200 --max-delay=500"
      echo -e "  ${CYAN}Dashboard:${NC} http://localhost:4000"
      log_step "Running headless bot + dashboard"
      run_bot $count --parallel "$workers" $extra $delay_opts $(check_resume)
      ;;
    ZZ|zz)
      setup_tor || continue
      echo -n "How many? [$TOTAL_NAMES]: "; read -r count
      count=${count:-$TOTAL_NAMES}
      echo -n "Parallel workers? [10]: "; read -r workers
      workers=${workers:-10}
      TOR_BASE=9050
      TOR_COUNT=$(( workers > 5 ? 5 : workers ))
      log_step "Starting $TOR_COUNT Tor instances..."
      tor_ok=0; TOR_PORTS=""
      for i in $(seq 0 $((TOR_COUNT - 1))); do
        p=$((TOR_BASE + i))
        if tor_instance "$p"; then
          TOR_PORTS="${TOR_PORTS}${p},"
          tor_ok=$((tor_ok + 1))
        fi
      done
      TOR_PORTS="${TOR_PORTS%,}"
      if [ $tor_ok -eq 0 ]; then
        log_err "No Tor instances started — check 'tor --version'"
        continue
      fi
      FIRST_PORT=$(echo "$TOR_PORTS" | cut -d',' -f1)
      echo ""
      echo -e "  ${BOLD}🌐 IP CHECK${NC}"
      echo -e "  ${YELLOW}Real IP:${NC}     $(get_ip)"
      echo -e "  ${YELLOW}Tor IP:${NC}      $(get_ip "socks5://127.0.0.1:$FIRST_PORT")"
      echo ""
      echo -n "Proceed with $workers workers using Tor? (y/N): "; read -r confirm
      [[ "$confirm" != "y" && "$confirm" != "Y" ]] && log_warn "Cancelled" && continue
      set_target "$count"
      echo -n "Infinite? (y/n) [n]: "; read -r inf
      extra=""; [[ "$inf" == "y" || "$inf" == "Y" ]] && extra="--infinite" && set_target "INF"
      echo -n "Delay speed (fast/medium/slow) [medium]: "; read -r speed
      delay_opts=""; [[ "$speed" == "fast" ]] && delay_opts="--min-delay=20 --max-delay=80"; [[ "$speed" == "slow" ]] && delay_opts="--min-delay=200 --max-delay=500"
      deploy_persistent
      log_warn "$tor_ok/$TOR_COUNT Tor instances on ports $TOR_PORTS"
      echo -e "  ${CYAN}Dashboard:${NC} http://localhost:4000"
      log_step "Running headless bot + dashboard + Tor"
      run_bot $count --parallel "$workers" $extra --tor-ports="$TOR_PORTS" $delay_opts $(check_resume)
      ;;
    K|k) kill_all ;;
    R|r) reset_csv ;;
    S|s) install_deps || log_warn "Setup had issues — check above";;
    L|l)
      LATEST=$(ls -t "$SCRIPT_DIR/logs/"*.log 2>/dev/null | head -1)
      if [ -n "$LATEST" ]; then
        log_step "Showing live logs (Ctrl+C to stop)"
        tail -f "$LATEST"
      else
        log_warn "No logs found in $SCRIPT_DIR/logs/"
      fi
      ;;
    0) kill_all; echo -e "${GREEN}Bye!${NC}"; exit 0 ;;
    *) log_err "Invalid choice — enter a number/letter from the menu" ;;
  esac
  echo ""
done
