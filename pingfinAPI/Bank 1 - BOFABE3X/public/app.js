const API = '/api';
let token = localStorage.getItem('pingfin_token');
let statsInterval = null;

function byId(id) {
  return document.getElementById(id);
}

// === Auth ===
async function login() {
  const username = byId('login-username').value;
  const password = byId('login-password').value;

  try {
    const resp = await fetch(API + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await resp.json();
    if (data.ok) {
      token = data.data.token;
      localStorage.setItem('pingfin_token', token);
      showApp();
    } else {
      byId('login-error').textContent = data.message || 'Login failed';
    }
  } catch (err) {
    byId('login-error').textContent = err.message;
  }
}

function logout() {
  localStorage.removeItem('pingfin_token');
  token = null;
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  location.reload();
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const resp = await fetch(API + path, { ...opts, headers });
  if (resp.status === 401) {
    logout();
    return null;
  }

  return resp.json();
}

// === UI ===
function toast(message, kind) {
  const el = byId('toast');
  el.textContent = message;
  el.className = 'toast ' + (kind || '');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

function showApp() {
  byId('login-screen').classList.add('hidden');
  byId('app').classList.remove('hidden');

  loadInfo();
  loadStats();
  switchTab('dashboard');

  if (!statsInterval) {
    statsInterval = setInterval(loadStats, 5000);
  }
}

async function loadInfo() {
  const data = await api('/info');
  if (data?.ok) {
    byId('bank-info').textContent =
      `${data.data.name} (${data.data.bic}) — ${data.data.members}`;
  }
}

async function loadStats() {
  const data = await api('/stats');
  if (!data?.ok) {
    return;
  }

  const s = data.data;
  const items = [
    { label: 'Accounts', value: s.accounts },
    { label: 'Total Balance', value: 'EUR ' + Number(s.total_balance).toFixed(2) },
    { label: 'PO_NEW', value: s.po_new },
    { label: 'PO_OUT', value: s.po_out },
    { label: 'PO_IN', value: s.po_in },
    { label: 'ACK_IN', value: s.ack_in },
    { label: 'ACK_OUT', value: s.ack_out },
    { label: 'TX OK', value: s.tx_valid },
    { label: 'TX Failed', value: s.tx_failed },
    { label: 'Outstanding', value: s.outstanding_payments },
  ];

  byId('stats').innerHTML = items
    .map((i) => `<div class="stat"><div class="label">${i.label}</div><div class="value">${i.value}</div></div>`)
    .join('');
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  document.querySelectorAll('.tab-content').forEach((c) => {
    c.classList.toggle('hidden', c.id !== 'tab-' + tab);
  });

  if (tab !== 'dashboard') {
    loadTab(tab);
  }
}

async function loadTab(tab) {
  const map = {
    accounts: { url: '/accounts', cols: ['id', 'balance'] },
    po_new: { url: '/po_new', cols: ['po_id', 'po_amount', 'po_message', 'oa_id', 'bb_id', 'ba_id', 'status'] },
    po_out: { url: '/po_out', cols: ['po_id', 'po_amount', 'oa_id', 'bb_id', 'ba_id', 'ob_code', 'cb_code', 'sent_to_cb'] },
    po_in: { url: '/po_in', cols: ['po_id', 'po_amount', 'ob_id', 'oa_id', 'ba_id', 'bb_code', 'status'] },
    ack_out: { url: '/ack_out', cols: ['po_id', 'po_amount', 'ob_id', 'bb_code', 'sent_to_cb'] },
    ack_in: { url: '/ack_in', cols: ['po_id', 'po_amount', 'ob_code', 'cb_code', 'bb_code', 'status'] },
    transactions: { url: '/transactions', cols: ['id', 'po_id', 'account_id', 'amount', 'datetime', 'isvalid'] },
    log: { url: '/log', cols: ['datetime', 'type', 'message', 'po_id'] },
    banks: { url: '/banks', cols: ['id', 'name', 'members'] },
  };

  const cfg = map[tab];
  if (!cfg) {
    return;
  }

  const data = await api(cfg.url);
  if (!data?.ok) {
    toast('Failed to load: ' + (data?.message || 'Unknown error'), 'error');
    return;
  }

  renderTable('tbl-' + tab, cfg.cols, data.data || []);
}

function renderTable(tableId, cols, rows) {
  const tbl = byId(tableId);
  const safeRows = Array.isArray(rows) ? rows : [];

  tbl.innerHTML =
    '<thead><tr>' + cols.map((c) => `<th>${c}</th>`).join('') + '</tr></thead>' +
    '<tbody>' +
    safeRows
      .map((r) => '<tr>' + cols.map((c) => `<td class="code">${formatCell(c, r[c])}</td>`).join('') + '</tr>')
      .join('') +
    '</tbody>';

  if (safeRows.length === 0) {
    tbl.innerHTML +=
      '<tfoot><tr><td colspan="' + cols.length +
      '" style="text-align:center;color:var(--muted);padding:2rem;">No data</td></tr></tfoot>';
  }
}

function formatCell(col, val) {
  if (val === null || val === undefined) {
    return '<span style="color:var(--muted)">-</span>';
  }

  if (col === 'sent_to_cb' || col === 'isvalid') {
    return val ? '<span class="badge ok">yes</span>' : '<span class="badge fail">no</span>';
  }

  if (col === 'status') {
    const cls = val === 'processed' ? 'ok' : val === 'failed' ? 'fail' : 'pending';
    return `<span class="badge ${cls}">${val}</span>`;
  }

  if (col === 'po_amount' || col === 'balance' || col === 'amount') {
    return Number(val).toFixed(2);
  }

  if (typeof val === 'object') {
    return JSON.stringify(val);
  }

  return String(val);
}

// === Action wrappers ===
async function action(path, method, body) {
  const opts = { method: method || 'GET' };
  if (body) {
    opts.body = JSON.stringify(body);
  }

  const resp = await api(path, opts);
  const lastResponse = byId('last-response');
  if (lastResponse) {
    lastResponse.textContent = JSON.stringify(resp, null, 2);
  }

  if (resp?.ok) {
    toast(resp.message || 'OK', 'success');
  } else {
    toast(resp?.message || 'Error', 'error');
  }

  loadStats();
  return resp;
}

async function generatePOs(count) {
  const list = await action('/po_new_generate?count=' + (count || 10));
  if (list?.ok && list.data?.length) {
    await action('/po_new_add', 'POST', { data: list.data });
  }
}

function processPoNew() {
  return action('/po_new_process');
}

function sendPoOut() {
  return action('/po_out_send');
}

function pullAcks() {
  return action('/ack_pull');
}

function pullPo() {
  return action('/po_pull');
}

function processPoIn() {
  return action('/po_in_process');
}

function sendAckOut() {
  return action('/ack_out_send');
}

function runCycle() {
  return action('/cycle');
}

function init() {
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });

  fetch(API + '/info')
    .then((r) => r.json())
    .then((d) => {
      if (d?.ok) {
        byId('login-bic').textContent = d.data.bic;
      }
    })
    .catch(() => {
      byId('login-bic').textContent = '...';
    });

  if (token) {
    fetch(API + '/info', { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          showApp();
        } else {
          logout();
        }
      })
      .catch(() => logout());
  }
}

window.login = login;
window.logout = logout;
window.generatePOs = generatePOs;
window.processPoNew = processPoNew;
window.sendPoOut = sendPoOut;
window.pullAcks = pullAcks;
window.pullPo = pullPo;
window.processPoIn = processPoIn;
window.sendAckOut = sendAckOut;
window.runCycle = runCycle;

document.addEventListener('DOMContentLoaded', init);
