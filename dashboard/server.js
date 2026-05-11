const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2], 10) || 4000;
const CSV_PATH = path.join(__dirname, '..', 'output.csv');
const NAMES_PATH = path.join(__dirname, '..', 'NAMES.TXT');
const LOG_DIR = path.join(__dirname, '..', 'logs');

/** Parse CSV file into array of objects */
function parseCSV() {
  if (!fs.existsSync(CSV_PATH)) return { headers: [], rows: [], raw: '' };
  const content = fs.readFileSync(CSV_PATH, 'utf-8').trim();
  if (!content) return { headers: [], rows: [], raw: '' };
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].match(/(".*?"|[^,]+)/g) || [];
    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').replace(/"/g, '').trim(); });
    rows.push(row);
  }
  return { headers, rows, raw: content };
}

/** Count names in NAMES.TXT */
function getTotalTarget() {
  if (!fs.existsSync(NAMES_PATH)) return 0;
  return fs.readFileSync(NAMES_PATH, 'utf-8').split('\n').filter(l => l.trim()).length;
}

/** Get latest log tail */
function getLatestLog(lines = 30) {
  if (!fs.existsSync(LOG_DIR)) return 'No logs yet';
  const logs = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log')).sort().reverse();
  if (logs.length === 0) return 'No logs yet';
  const content = fs.readFileSync(path.join(LOG_DIR, logs[0]), 'utf-8');
  return content.split('\n').slice(-lines).join('\n');
}

/** Build dashboard HTML */
function buildDashboard() {
  const { rows } = parseCSV();
  const total = getTotalTarget();
  const success = rows.filter(r => r.Status === 'SUCCESS').length;
  const failed = rows.filter(r => r.Status && r.Status.startsWith('FAILED')).length;
  const completed = rows.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const logTail = getLatestLog(25);

  // Event breakdown
  const events = {};
  rows.forEach(r => { const e = r['Event Name'] || 'Unknown'; events[e] = (events[e] || 0) + 1; });

  // College breakdown
  const colleges = {};
  rows.forEach(r => { const c = r.College || 'Unknown'; colleges[c] = (colleges[c] || 0) + 1; });

  // Recent 50 rows for table
  const recent = rows.slice(-50).reverse();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="5">
<title>Estralis Bot — Live Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', sans-serif;
    background: #0a0a0f;
    color: #e0e0e0;
    min-height: 100vh;
  }
  .header {
    background: linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0a1628 100%);
    border-bottom: 1px solid rgba(139, 92, 246, 0.2);
    padding: 24px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header h1 {
    font-size: 22px;
    font-weight: 800;
    background: linear-gradient(135deg, #a78bfa, #60a5fa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.5px;
  }
  .header .live {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: #86efac;
  }
  .header .live::before {
    content: ''; width: 8px; height: 8px;
    background: #22c55e; border-radius: 50%;
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  .container { max-width: 1400px; margin: 0 auto; padding: 24px; }

  /* Stats cards */
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat {
    background: linear-gradient(135deg, rgba(30, 30, 50, 0.8), rgba(20, 20, 40, 0.9));
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 16px;
    padding: 24px;
    position: relative;
    overflow: hidden;
  }
  .stat::after {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    border-radius: 16px 16px 0 0;
  }
  .stat:nth-child(1)::after { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
  .stat:nth-child(2)::after { background: linear-gradient(90deg, #22c55e, #86efac); }
  .stat:nth-child(3)::after { background: linear-gradient(90deg, #ef4444, #fca5a5); }
  .stat:nth-child(4)::after { background: linear-gradient(90deg, #3b82f6, #93c5fd); }
  .stat:nth-child(5)::after { background: linear-gradient(90deg, #f59e0b, #fcd34d); }
  .stat .label { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
  .stat .value { font-size: 36px; font-weight: 800; }
  .stat:nth-child(1) .value { color: #a78bfa; }
  .stat:nth-child(2) .value { color: #86efac; }
  .stat:nth-child(3) .value { color: #fca5a5; }
  .stat:nth-child(4) .value { color: #93c5fd; }
  .stat:nth-child(5) .value { color: #fcd34d; }

  /* Progress bar */
  .progress-wrap {
    background: rgba(30, 30, 50, 0.8);
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
  }
  .progress-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
  .progress-header .title { font-weight: 600; font-size: 14px; }
  .progress-header .pct { font-weight: 700; color: #a78bfa; }
  .progress-bar {
    width: 100%; height: 16px;
    background: rgba(139, 92, 246, 0.1);
    border-radius: 8px; overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b5cf6, #60a5fa, #22d3ee);
    border-radius: 8px;
    transition: width 0.5s ease;
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
  }

  /* Two-column layout */
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  @media (max-width: 900px) { .grid2 { grid-template-columns: 1fr; } }

  .card {
    background: rgba(30, 30, 50, 0.8);
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 16px;
    padding: 20px;
  }
  .card h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 16px; }
  .breakdown-item {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 13px;
  }
  .breakdown-item:last-child { border: none; }
  .breakdown-item .name { color: #d1d5db; }
  .breakdown-item .count {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
    padding: 2px 10px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 12px;
  }

  /* Table */
  .table-wrap {
    background: rgba(30, 30, 50, 0.8);
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
    overflow-x: auto;
  }
  .table-wrap h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th {
    text-align: left; padding: 10px 12px;
    background: rgba(139, 92, 246, 0.1);
    color: #a78bfa; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.5px;
    font-size: 11px;
    border-bottom: 1px solid rgba(139, 92, 246, 0.2);
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    color: #d1d5db;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  tr:hover td { background: rgba(139, 92, 246, 0.05); }
  .badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 11px;
  }
  .badge.success { background: rgba(34, 197, 94, 0.15); color: #86efac; }
  .badge.failed { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }

  /* Log viewer */
  .log-card {
    background: rgba(10, 10, 20, 0.9);
    border: 1px solid rgba(139, 92, 246, 0.15);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
  }
  .log-card h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 16px; }
  .log-content {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #86efac;
    background: rgba(0,0,0,0.3);
    border-radius: 8px;
    padding: 16px;
    max-height: 300px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .footer { text-align: center; padding: 24px; color: #4b5563; font-size: 12px; }
</style>
</head>
<body>
<div class="header">
  <h1>⚡ ESTRALIS BOT — LIVE DASHBOARD</h1>
  <div class="live">Auto-refresh 5s • ${new Date().toLocaleString('en-IN')}</div>
</div>
<div class="container">

  <div class="stats">
    <div class="stat"><div class="label">Target Total</div><div class="value">${total}</div></div>
    <div class="stat"><div class="label">Success</div><div class="value">${success}</div></div>
    <div class="stat"><div class="label">Failed</div><div class="value">${failed}</div></div>
    <div class="stat"><div class="label">Completed</div><div class="value">${completed}</div></div>
    <div class="stat"><div class="label">Remaining</div><div class="value">${Math.max(0, total - completed)}</div></div>
  </div>

  <div class="progress-wrap">
    <div class="progress-header">
      <span class="title">Overall Progress</span>
      <span class="pct">${pct}% (${completed}/${total})</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(pct, 100)}%"></div></div>
  </div>

  <div class="grid2">
    <div class="card">
      <h3>Events Breakdown</h3>
      ${Object.entries(events).sort((a,b) => b[1]-a[1]).slice(0,10).map(([name, count]) =>
        `<div class="breakdown-item"><span class="name">${name}</span><span class="count">${count}</span></div>`
      ).join('') || '<div style="color:#6b7280">No data yet</div>'}
    </div>
    <div class="card">
      <h3>Top Colleges</h3>
      ${Object.entries(colleges).sort((a,b) => b[1]-a[1]).slice(0,10).map(([name, count]) =>
        `<div class="breakdown-item"><span class="name">${name}</span><span class="count">${count}</span></div>`
      ).join('') || '<div style="color:#6b7280">No data yet</div>'}
    </div>
  </div>

  <div class="table-wrap">
    <h3>Recent Registrations (${rows.length} total)</h3>
    <table>
      <thead><tr>
        <th>#</th><th>Time</th><th>Name</th><th>Email</th><th>Phone</th>
        <th>College</th><th>Branch</th><th>UTR</th><th>Ref#</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${recent.map((r, i) => `<tr>
          <td>${rows.length - i}</td>
          <td>${r.Timestamp ? new Date(r.Timestamp).toLocaleTimeString('en-IN') : '-'}</td>
          <td>${r['Full Name'] || '-'}</td>
          <td>${r.Email || '-'}</td>
          <td>${r.Phone || '-'}</td>
          <td title="${r.College || ''}">${(r.College || '-').slice(0, 25)}</td>
          <td>${r.Branch || '-'}</td>
          <td>${r.UTR || '-'}</td>
          <td>${r['Registration Reference Number'] || '-'}</td>
          <td><span class="badge ${r.Status === 'SUCCESS' ? 'success' : 'failed'}">${(r.Status || '-').slice(0, 20)}</span></td>
        </tr>`).join('')}
        ${recent.length === 0 ? '<tr><td colspan="10" style="text-align:center;color:#6b7280;padding:40px">Waiting for registrations...</td></tr>' : ''}
      </tbody>
    </table>
  </div>

  <div class="log-card">
    <h3>Live Logs (latest)</h3>
    <div class="log-content">${logTail.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
  </div>

  <div class="footer">Estralis Bot Dashboard • Page auto-refreshes every 5 seconds</div>
</div>
</body>
</html>`;
}

/** API endpoint: return CSV data as JSON */
function apiData() {
  const { rows } = parseCSV();
  const total = getTotalTarget();
  const success = rows.filter(r => r.Status === 'SUCCESS').length;
  const failed = rows.filter(r => r.Status && r.Status.startsWith('FAILED')).length;
  return JSON.stringify({ total, success, failed, completed: rows.length, rows });
}

// ── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  if (req.url === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(apiData());
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildDashboard());
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔═══════════════════════════════════════════════════╗`);
  console.log(`║  Dashboard running at http://localhost:${PORT}      ║`);
  console.log(`╚═══════════════════════════════════════════════════╝`);
  console.log(`\nTo expose publicly via Cloudflare Tunnel:`);
  console.log(`  cloudflared tunnel --url http://localhost:${PORT}`);
  console.log(`\nDashboard auto-reads output.csv every 5 seconds.`);
});
