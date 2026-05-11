const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = parseInt(process.argv[2], 10) || 4000;
const CSV_PATH = path.join(__dirname, '..', 'output.csv');
const LOG_DIR = path.join(__dirname, '..', 'logs');
const TARGET_PATH = path.join(__dirname, '..', 'logs', 'target.flag');

function parseCSV() {
  if (!fs.existsSync(CSV_PATH)) return { headers: [], rows: [], raw: '' };
  const content = fs.readFileSync(CSV_PATH, 'utf-8').trim();
  if (!content) return { headers: [], rows: [], raw: '' };
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').replace(/"/g, '').trim(); });
    rows.push(row);
  }
  return { headers, rows, raw: content };
}

function getTotalTarget() {
  if (fs.existsSync(TARGET_PATH)) {
    const val = fs.readFileSync(TARGET_PATH, 'utf-8').trim();
    if (val === 'INF') return 999999;
    const n = parseInt(val, 10);
    if (!isNaN(n)) return n;
  }
  return 0;
}

function getLatestLog(lines = 50) {
  if (!fs.existsSync(LOG_DIR)) return 'No logs yet';
  const logs = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log')).sort().reverse();
  if (logs.length === 0) return 'No logs yet';
  const content = fs.readFileSync(path.join(LOG_DIR, logs[0]), 'utf-8');
  return content.split('\n').slice(-lines).join('\n');
}

function apiData() {
  const { rows } = parseCSV();
  const total = getTotalTarget();
  const success = rows.filter(r => r.Status === 'SUCCESS').length;
  const failed = rows.filter(r => r.Status === 'FAILURE').length;
  const logTail = getLatestLog(50);
  let ongoing = [];
  try {
    const p = path.join(__dirname, '..', 'logs', 'ongoing.json');
    if (fs.existsSync(p)) ongoing = JSON.parse(fs.readFileSync(p, 'utf-8') || '[]');
  } catch {}
  return JSON.stringify({ total, success, failed, completed: rows.length, rows, logTail, ongoing });
}

function buildDashboard() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DATABASE CHOCKE ft. SNAKEKING</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #0d1117;
    color: #e6edf3;
    min-height: 100vh;
  }
  .header {
    border-bottom: 1px solid #30363d;
    padding: 16px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #161b22;
  }
  .brand h1 {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.3px;
    color: #e6edf3;
  }
  .brand span {
    font-size: 11px;
    color: #8b949e;
    font-weight: 500;
    margin-left: 8px;
  }
  .kill-btn {
    background: #21262d;
    color: #f85149;
    border: 1px solid #30363d;
    padding: 8px 18px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .kill-btn:hover {
    background: #f85149;
    color: #fff;
    border-color: #f85149;
  }
  .container { max-width: 1400px; margin: 0 auto; padding: 24px 32px; }
  .stats-row {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .stat {
    flex: 1;
    min-width: 120px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 10px;
    padding: 16px 20px;
  }
  .stat-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #8b949e;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .stat-val {
    font-size: 28px;
    font-weight: 700;
    color: #e6edf3;
    letter-spacing: -0.5px;
  }
  .stat-val.green { color: #3fb950; }
  .stat-val.red { color: #f85149; }
  .stat-val.gray { color: #8b949e; }
  .progress-wrap {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 10px;
    padding: 16px 20px;
    margin-bottom: 24px;
  }
  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .progress-title {
    font-size: 12px;
    font-weight: 600;
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .progress-pct {
    font-size: 13px;
    font-weight: 700;
    color: #e6edf3;
  }
  .progress-bar-bg {
    width: 100%;
    height: 6px;
    background: #21262d;
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%;
    background: #e6edf3;
    border-radius: 3px;
    width: 0%;
    transition: width 0.4s ease;
  }
  .main-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 24px;
  }
  @media (max-width: 900px) {
    .main-grid { grid-template-columns: 1fr; }
  }
  .card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 10px;
    padding: 20px;
    display: flex;
    flex-direction: column;
  }
  .card h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #8b949e;
    font-weight: 600;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid #21262d;
  }
  .search-input {
    width: 100%;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
    font-family: inherit;
    color: #e6edf3;
    margin-bottom: 12px;
    outline: none;
  }
  .search-input:focus { border-color: #8b949e; }
  .filter-row {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .filter-btn {
    background: #21262d;
    border: 1px solid #30363d;
    color: #8b949e;
    padding: 5px 14px;
    border-radius: 6px;
    font-weight: 500;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.1s;
    font-family: inherit;
  }
  .filter-btn:hover { border-color: #8b949e; color: #e6edf3; }
  .filter-btn.active {
    background: #e6edf3;
    border-color: #e6edf3;
    color: #0d1117;
  }
  .table-wrap { overflow-x: auto; max-height: 500px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th {
    text-align: left;
    padding: 10px 12px;
    color: #8b949e;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #30363d;
    position: sticky;
    top: 0;
    background: #161b22;
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid #21262d;
    color: #e6edf3;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  tr:hover td { background: #1c2333; }
  .badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .badge.success { background: #1b3a1b; color: #3fb950; }
  .badge.failure { background: #3a1b1b; color: #f85149; }
  .badge.ongoing {
    background: #3d2e00;
    color: #d29922;
    animation: blink 1s infinite;
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }
  @keyframes flashHighlight {
    0% { background: rgba(63, 185, 80, 0.25); }
    100% { background: transparent; }
  }
  .log-box {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    line-height: 1.5;
    color: #e6edf3;
    background: #0d1117;
    border: 1px solid #21262d;
    border-radius: 6px;
    padding: 12px;
    overflow-y: auto;
    flex: 1;
    min-height: 400px;
    max-height: 600px;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .log-search {
    width: 100%;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    color: #e6edf3;
    margin-bottom: 12px;
    outline: none;
  }
  .log-search:focus { border-color: #8b949e; }
  .footer {
    text-align: center;
    padding: 24px;
    color: #484f58;
    font-size: 11px;
    border-top: 1px solid #21262d;
    margin-top: 24px;
    letter-spacing: 0.3px;
  }
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  .modal-overlay.active { display: flex; }
  .modal {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    padding: 32px;
    max-width: 380px;
    width: 90%;
    text-align: center;
  }
  .modal h2 {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 6px;
    color: #e6edf3;
  }
  .modal p {
    color: #8b949e;
    font-size: 13px;
    margin-bottom: 20px;
    line-height: 1.4;
  }
  .modal-input {
    width: 100%;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 14px;
    text-align: center;
    letter-spacing: 4px;
    margin-bottom: 16px;
    font-family: 'JetBrains Mono', monospace;
    outline: none;
    color: #e6edf3;
  }
  .modal-input:focus { border-color: #f85149; }
  .modal-actions { display: flex; gap: 10px; }
  .modal-btn {
    flex: 1;
    padding: 10px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.1s;
    font-family: inherit;
  }
  .modal-btn.cancel {
    background: #21262d;
    border: 1px solid #30363d;
    color: #8b949e;
  }
  .modal-btn.cancel:hover { background: #30363d; }
  .modal-btn.confirm {
    background: #f85149;
    border: none;
    color: #fff;
  }
  .modal-btn.confirm:hover { background: #da3633; }
</style>
</head>
<body>
<div class="header">
  <div class="brand">
    <h1>DATABASE CHOCKE ft. SNAKEKING</h1>
    <span>LIVE</span>
  </div>
  <button class="kill-btn" onclick="openKillModal()">KILL</button>
</div>

<div class="container">
  <div class="stats-row">
    <div class="stat">
      <div class="stat-label">Target</div>
      <div class="stat-val" id="stat-total">0</div>
    </div>
    <div class="stat">
      <div class="stat-label">Success</div>
      <div class="stat-val green" id="stat-success">0</div>
    </div>
    <div class="stat">
      <div class="stat-label">Failed</div>
      <div class="stat-val red" id="stat-failed">0</div>
    </div>
    <div class="stat">
      <div class="stat-label">Completed</div>
      <div class="stat-val" id="stat-completed">0</div>
    </div>
    <div class="stat">
      <div class="stat-label">Remaining</div>
      <div class="stat-val gray" id="stat-remaining">0</div>
    </div>
  </div>

  <div class="progress-wrap">
    <div class="progress-header">
      <span class="progress-title">Progress</span>
      <span class="progress-pct" id="progress-pct">0%</span>
    </div>
    <div class="progress-bar-bg">
      <div class="progress-bar-fill" id="progress-fill"></div>
    </div>
  </div>

  <div class="main-grid">
    <div class="card">
      <h3>Records</h3>
      <input type="text" class="search-input" id="table-search" placeholder="Search name, email, college, status..." oninput="filterTable()">
      <div class="filter-row">
        <button class="filter-btn active" onclick="setFilter('ALL', this)">ALL</button>
        <button class="filter-btn" onclick="setFilter('SUCCESS', this)">SUCCESS</button>
        <button class="filter-btn" onclick="setFilter('FAILURE', this)">FAILURE</button>
        <button class="filter-btn" onclick="setFilter('ONGOING', this)">ONGOING</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Event</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="records-body"></tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3>Console</h3>
      <input type="text" class="log-search" id="log-search" placeholder="Filter..." oninput="filterLogs()">
      <div class="log-box" id="log-box"></div>
    </div>
  </div>

  <div class="footer">DATABASE CHOCKE CONSOLE</div>
</div>

<div class="modal-overlay" id="kill-modal">
  <div class="modal">
    <h2>TERMINATE</h2>
    <p>Kill all active bot workers and dashboard.</p>
    <input type="password" class="modal-input" id="kill-password" placeholder="password" autofocus>
    <div class="modal-actions">
      <button class="modal-btn cancel" onclick="closeKillModal()">CANCEL</button>
      <button class="modal-btn confirm" onclick="submitKill()">KILL</button>
    </div>
  </div>
</div>

<script>
  let allRows = [];
  let ongoingList = [];
  let statusFilter = 'ALL';
  let activeLogText = '';

  async function update() {
    try {
      const res = await fetch('/api/data');
      const data = await res.json();
      allRows = data.rows || [];
      ongoingList = data.ongoing || [];

      const inf = data.total === 999999;
      document.getElementById('stat-total').innerText = inf ? '∞' : data.total;
      document.getElementById('stat-success').innerText = data.success;
      document.getElementById('stat-failed').innerText = data.failed;
      document.getElementById('stat-completed').innerText = data.completed;
      document.getElementById('stat-remaining').innerText = inf ? '∞' : Math.max(0, data.total - data.completed);

      const pct = data.total > 0 ? (inf ? 0 : Math.min(100, Math.round(data.completed / data.total * 100))) : 0;
      document.getElementById('progress-pct').innerText = inf ? (data.completed + ' done') : (pct + '% (' + data.completed + '/' + data.total + ')');
      document.getElementById('progress-fill').style.width = inf ? '0%' : pct + '%';

      filterTable();
      activeLogText = data.logTail || '';
      filterLogs();
    } catch(e) {}
  }

  function setFilter(f, el) {
    statusFilter = f;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    filterTable();
  }

  let prevOngoingKeys = {};

  function filterTable() {
    const q = document.getElementById('table-search').value.toLowerCase();
    const body = document.getElementById('records-body');
    body.innerHTML = '';

    const currentKeys = {};
    ongoingList.forEach(r => { currentKeys[(r.name + '|' + r.email).toLowerCase()] = 1; });

    const combined = [];
    allRows.forEach(r => {
      const key = (r['Full Name'] + '|' + r.Email).toLowerCase();
      const ts = r.Timestamp ? new Date(r.Timestamp).getTime() : 0;
      combined.push({ _key: key, _sort: ts, _status: r.Status, _name: r['Full Name'] || '-', _email: r.Email || '-', _event: r['Event Name'] || '-', _isNew: !prevOngoingKeys[key] && prevOngoingKeys[key] !== undefined ? 1 : 0 });
    });
    ongoingList.forEach(r => {
      const key = (r.name + '|' + r.email).toLowerCase();
      const ts = r.startedAt ? new Date(r.startedAt).getTime() : Date.now();
      combined.push({ _key: key, _sort: ts, _status: 'ONGOING', _name: r.name || '-', _email: r.email || '-', _event: r.event || '-', _isNew: 0 });
    });

    combined.sort((a, b) => b._sort - a._sort);

    const filtered = combined.filter(r => {
      const s = (r._name + ' ' + r._email + ' ' + r._status).toLowerCase();
      if (!s.includes(q)) return false;
      if (statusFilter === 'SUCCESS') return r._status === 'SUCCESS';
      if (statusFilter === 'FAILURE') return r._status === 'FAILURE';
      if (statusFilter === 'ONGOING') return r._status === 'ONGOING';
      return true;
    });

    prevOngoingKeys = currentKeys;

    filtered.slice(0, 100).forEach((r, i) => {
      const cls = r._status === 'SUCCESS' ? 'success' : r._status === 'FAILURE' ? 'failure' : 'ongoing';
      const tr = document.createElement('tr');
      if (r._isNew) tr.style.animation = 'flashHighlight 1s ease';
      tr.innerHTML = '<td>' + (i + 1) + '</td>' +
        '<td>' + r._name + '</td>' +
        '<td>' + r._email + '</td>' +
        '<td>' + r._event.slice(0, 25) + '</td>' +
        '<td><span class="badge ' + cls + '">' + r._status + '</span></td>';
      body.appendChild(tr);
    });
    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#484f58;padding:32px;font-size:13px">No records</td></tr>';
    }
  }

  function filterLogs() {
    const q = document.getElementById('log-search').value.toLowerCase();
    const box = document.getElementById('log-box');
    const lines = activeLogText.split('\\n').filter(l => l.toLowerCase().includes(q));
    box.textContent = lines.join('\\n');
    box.scrollTop = box.scrollHeight;
  }

  function openKillModal() {
    document.getElementById('kill-modal').classList.add('active');
    document.getElementById('kill-password').focus();
  }

  function closeKillModal() {
    document.getElementById('kill-modal').classList.remove('active');
    document.getElementById('kill-password').value = '';
  }

  async function submitKill() {
    const pwd = document.getElementById('kill-password').value;
    if (!pwd) return;
    try {
      const res = await fetch('/api/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd })
      });
      if (res.ok) {
        document.querySelector('.modal').innerHTML = '<h2 style="color:#090">TERMINATED</h2><p>All processes killed.</p>';
        setTimeout(() => window.close(), 2000);
      } else {
        document.getElementById('kill-password').value = '';
        document.getElementById('kill-password').focus();
      }
    } catch(e) {}
  }

  window.onload = () => { update(); setInterval(update, 2000); };
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/kill') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.password === 'Gcem') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          exec('pkill -f "cloudflared" 2>/dev/null; pkill -f "estralis-bot/index.js" 2>/dev/null', () => {
            process.exit(0);
          });
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Wrong password' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid' }));
      }
    });
  } else if (req.url === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(apiData());
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildDashboard());
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Dashboard: http://localhost:${PORT}`);
});
