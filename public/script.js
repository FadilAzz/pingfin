// ════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════
const TOKEN_KEY = 'pingfin_token';
let currentUser = null;
let statsInterval = null;
let logInterval   = null;
let logAutoRefresh = true;
let knownBanks = [];
let ownAccounts = [];
let lockedIban = null;

// ════════════════════════════════════════════════════
// API
// ════════════════════════════════════════════════════
async function api(path, opts = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const baseUrl = localStorage.getItem('BANK_API_URL') || '';
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(baseUrl + '/api' + path, { ...opts, headers });
  if (res.status === 401) { doLogout(); throw new Error('Session verlopen'); }
  const json = await res.json().catch(() => ({ ok: false, message: 'Invalid JSON' }));
  return json;
}

// ════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'fade-out .3s ease forwards';
    el.addEventListener('animationend', () => el.remove());
  }, 3500);
}

// ════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════
async function doLogin() {
  const btn = document.getElementById('btn-login');
  const errEl = document.getElementById('login-error');
  const bankSel = window.location.origin;
  const username = document.getElementById('inp-user').value.trim();
  const password = document.getElementById('inp-pass').value;
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Vul gebruikersnaam en wachtwoord in.'; return; }
  btn.disabled = true; btn.textContent = 'Bezig…';
  try {
    const r = await fetch(bankSel + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json();
    if (!data.ok) { errEl.textContent = data.message || 'Inloggen mislukt.'; return; }
    localStorage.setItem(TOKEN_KEY, data.data.token);
    localStorage.setItem('BANK_API_URL', bankSel);
    currentUser = data.data.user;
    initApp();
  } catch (e) {
    errEl.textContent = 'Verbindingsfout: ' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Inloggen';
  }
}

document.getElementById('inp-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('inp-user').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('inp-iban').addEventListener('keydown', e => { if (e.key === 'Enter') doIbanLogin(); });
document.getElementById('inp-iban').addEventListener('input', function() { validateIbanField(this, 'iban-login-hint'); });

async function doIbanLogin() {
  const btn = document.getElementById('btn-iban-login');
  const errEl = document.getElementById('iban-login-error');
  const iban = document.getElementById('inp-iban').value.trim().replace(/\s/g, '').toUpperCase();
  errEl.textContent = '';
  if (!iban) { errEl.textContent = 'Voer een IBAN in.'; return; }
  if (!isValidIban(iban)) { errEl.textContent = 'Ongeldig IBAN-formaat.'; return; }
  
  let bankUrl = window.location.origin;

  btn.disabled = true; btn.textContent = 'Bezig…';
  try {
    // Check if account exists via public endpoint
    const accts = await fetch(bankUrl + '/api/accounts').then(r => r.json());
    const found = (accts.data || []).find(a => a.id === iban);
    if (!found) { errEl.textContent = 'IBAN niet gevonden in deze bank.'; return; }
    // Auto-login with default credentials
    const loginResp = await fetch(bankUrl + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    }).then(r => r.json());
    if (!loginResp.ok) { errEl.textContent = 'Authenticatie mislukt.'; return; }
    localStorage.setItem(TOKEN_KEY, loginResp.data.token);
    localStorage.setItem('BANK_API_URL', bankUrl);
    lockedIban = iban;
    currentUser = { id: 0, username: iban, role: 'user' };
    initApp();
  } catch (e) {
    errEl.textContent = 'Verbindingsfout: ' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Inloggen met IBAN';
  }
}

function doLogout() {
  localStorage.removeItem(TOKEN_KEY);
  currentUser = null;
  lockedIban = null;
  clearInterval(statsInterval);
  clearInterval(logInterval);
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-error').textContent = '';
  document.getElementById('iban-login-error').textContent = '';
  document.getElementById('inp-pass').value = '';
  document.getElementById('inp-iban').value = '';
  document.getElementById('iban-login-hint').textContent = '';
}

// ════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════
async function initApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  // Fetch bank info
  try {
    const info = await api('/info');
    const d = info.data || {};
    document.getElementById('hdr-bank').textContent = d.name || 'Pingfin Bank';
    document.getElementById('hdr-bic').textContent  = d.bic  || '';
  } catch (_) {}

  document.getElementById('hdr-user').textContent = currentUser.username;
  const roleBadge = document.getElementById('hdr-role-badge');
  roleBadge.innerHTML = currentUser.role === 'admin'
    ? '<span class="badge badge-blue">Admin</span>'
    : '<span class="badge badge-grey">User</span>';

  if (currentUser.role === 'admin') {
    document.getElementById('admin-view').classList.remove('hidden');
    document.getElementById('user-view').classList.add('hidden');
    setupAdminTabs();
    loadStats();
    statsInterval = setInterval(loadStats, 5000);
    loadAccounts();
    loadBanks();
  } else {
    document.getElementById('user-view').classList.remove('hidden');
    document.getElementById('admin-view').classList.add('hidden');
    setupUserTabs();
    await loadOwnAccounts();
    loadUserAccount();
    loadUserHistory();
    populateBankDropdowns();
  }
}

// ════════════════════════════════════════════════════
// TAB SWITCHING
// ════════════════════════════════════════════════════
function setupAdminTabs() {
  document.querySelectorAll('#admin-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#admin-tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#admin-view .tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      onTabActivate(btn.dataset.tab);
    });
  });

  document.querySelectorAll('#tab-po-monitor .sub-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tab-po-monitor .sub-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#tab-po-monitor .sub-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.sub).classList.add('active');
      onSubTabActivate(btn.dataset.sub);
    });
  });
}

function setupUserTabs() {
  document.querySelectorAll('#user-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#user-tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#user-view .tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      onUserTabActivate(btn.dataset.tab);
    });
  });
}

function onTabActivate(tab) {
  if (tab === 'accounts')     loadAccounts();
  if (tab === 'payments')     { loadPaymentAccounts(); loadPaymentOut(); }
  if (tab === 'po-monitor')   loadPoMonitor();
  if (tab === 'transactions') { loadTxAccounts(); loadTransactions(); }
  if (tab === 'logs')         { loadLogs(); if (logAutoRefresh) startLogInterval(); }
  if (tab === 'banks')        loadBanks();
  if (tab === 'users')        loadUsers();
}

function onSubTabActivate(sub) {
  if (sub === 'sub-po-new')  loadPoTable('po_new',  'tbl-po-new');
  if (sub === 'sub-po-out')  loadPoTable('po_out',  'tbl-po-out');
  if (sub === 'sub-po-in')   loadPoTable('po_in',   'tbl-po-in');
  if (sub === 'sub-ack-in')  loadPoTable('ack_in',  'tbl-ack-in');
  if (sub === 'sub-ack-out') loadPoTable('ack_out', 'tbl-ack-out');
}

function onUserTabActivate(tab) {
  if (tab === 'u-account') loadUserAccount();
  if (tab === 'u-payment') { populateBankDropdowns(); }
  if (tab === 'u-history') loadUserHistory();
}

// ════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════
function fmt(v, decimals = 2) {
  const n = Number(v);
  return isNaN(n) ? '–' : n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function fmtDate(s) { return s ? s.replace('T', ' ').slice(0, 19) : '–'; }

function statusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (['processed','completed','validated','2000'].includes(s)) return `<span class="badge badge-ok">${status}</span>`;
  if (['pending','received','sent'].includes(s)) return `<span class="badge badge-warn">${status}</span>`;
  if (['failed','error'].includes(s)) return `<span class="badge badge-err">${status}</span>`;
  return `<span class="badge badge-grey">${status || '–'}</span>`;
}

function codeBadge(code) {
  if (!code) return '<span class="badge badge-grey">–</span>';
  if (String(code) === '2000') return `<span class="badge badge-ok">${code}</span>`;
  return `<span class="badge badge-err">${code}</span>`;
}

function sentBadge(v) {
  return v ? '<span class="badge badge-ok">✓ verstuurd</span>' : '<span class="badge badge-warn">wachtend</span>';
}

function tbodyOrEmpty(tbody, rows, colspan, emptyMsg = 'Geen gegevens') {
  if (!rows || !rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${colspan}">${emptyMsg}</td></tr>`;
    return;
  }
}

function setBtn(id, loading, label) {
  const b = document.getElementById(id);
  if (!b) return;
  b.disabled = loading;
  b.textContent = loading ? '⏳ ' + label + '…' : label;
}

function showLastResp(data) {
  document.getElementById('last-resp-card').style.display = '';
  document.getElementById('last-resp').textContent = JSON.stringify(data, null, 2);
}

// ════════════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════════════
async function loadStats() {
  try {
    const r = await api('/stats');
    if (!r.ok) return;
    const d = r.data;
    document.getElementById('st-accounts').textContent    = d.accounts;
    document.getElementById('st-balance').textContent     = '€ ' + fmt(d.total_balance);
    document.getElementById('st-po-new').textContent      = d.po_new;
    document.getElementById('st-po-out').textContent      = d.po_out;
    document.getElementById('st-po-in').textContent       = d.po_in;
    document.getElementById('st-ack-in').textContent      = d.ack_in;
    document.getElementById('st-ack-out').textContent     = d.ack_out;
    document.getElementById('st-tx-ok').textContent       = d.tx_valid;
    document.getElementById('st-tx-fail').textContent     = d.tx_failed;
    document.getElementById('st-outstanding').textContent = d.outstanding_payments;
  } catch (_) {}
}

// ════════════════════════════════════════════════════
// ACTIONS (DASHBOARD)
// ════════════════════════════════════════════════════
async function runAction(endpoint, label, btnId) {
  if (btnId) setBtn(btnId, true, label);
  toast('Bezig: ' + label + '…', 'info');
  try {
    const r = await api('/' + endpoint);
    showLastResp(r);
    toast(label + ': ' + (r.data ? JSON.stringify(r.data).slice(0, 80) : r.message), r.ok ? 'ok' : 'err');
    loadStats();
  } catch (e) { toast('Fout: ' + e.message, 'err'); }
  finally { if (btnId) setBtn(btnId, false, label); }
}

async function runCycle() {
  setBtn('btn-cycle', true, 'Run full cycle (OB + BB)');
  toast('Cyclus starten…', 'info');
  try {
    const r = await api('/cycle');
    showLastResp(r);
    toast('Cyclus klaar', r.ok ? 'ok' : 'err');
    loadStats();
  } catch (e) { toast('Fout: ' + e.message, 'err'); }
  finally { setBtn('btn-cycle', false, 'Run full cycle (OB + BB)'); }
}

async function genPOs() {
  setBtn('btn-gen10', true, "Generate 10 PO's");
  toast("PO's genereren…", 'info');
  try {
    const gen = await api('/po_new_generate?count=10&errors=false');
    if (!gen.ok) throw new Error(gen.message);
    const add = await api('/po_new_add', { method: 'POST', body: JSON.stringify({ data: gen.data }) });
    if (!add.ok) throw new Error(add.message);
    showLastResp({ generated: gen.data?.length, added: add.data });
    toast(`${gen.data?.length || 0} PO's gegenereerd en toegevoegd`, 'ok');
    loadStats();
  } catch (e) { toast('Fout: ' + e.message, 'err'); }
  finally { setBtn('btn-gen10', false, "Generate 10 PO's"); }
}

// ════════════════════════════════════════════════════
// ACCOUNTS
// ════════════════════════════════════════════════════
async function loadAccounts() {
  try {
    const r = await api('/accounts'); // public route returns all accounts
    if (!r.ok) return;
    ownAccounts = r.data || [];
    const tbody = document.querySelector('#tbl-accounts tbody');
    if (!ownAccounts.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="3">Geen accounts</td></tr>';
      return;
    }
    tbody.innerHTML = ownAccounts.map(a => `
      <tr>
        <td class="mono">${a.id}</td>
        <td>€ ${fmt(a.balance)}</td>
        <td>
          <button type="button"class="btn btn-ghost btn-sm" onclick="openAdjustBalance('${a.id}',${a.balance})">Aanpassen</button>
          <button type="button"class="btn btn-danger btn-sm" onclick="deleteAccount('${a.id}',${a.balance})" style="margin-left:.25rem">Verwijderen</button>
        </td>
      </tr>`).join('');
  } catch (e) { toast('Fout bij laden accounts: ' + e.message, 'err'); }
}

async function deleteAccount(iban, balance) {
  if (balance !== 0) { toast('Saldo moet €0 zijn om te verwijderen', 'err'); return; }
  if (!confirm('Account ' + iban + ' verwijderen?')) return;
  const r = await api('/accounts/' + iban, { method: 'DELETE' });
  toast(r.message, r.ok ? 'ok' : 'err');
  if (r.ok) loadAccounts();
}

function openAdjustBalance(iban, current) {
  document.getElementById('modal-title').textContent = 'Saldo aanpassen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Rekening</label>
      <input type="text" value="${iban}" disabled>
    </div>
    <div class="form-group" style="margin-top:.75rem">
      <label>Huidig saldo</label>
      <input type="text" value="€ ${fmt(current)}" disabled>
    </div>
    <div class="form-group" style="margin-top:.75rem">
      <label>Aanpassing (positief of negatief)</label>
      <input id="adj-amount" type="number" step="0.01" placeholder="-100 of +500">
    </div>`;
  document.getElementById('modal-footer').innerHTML = `
    <button type="button"class="btn btn-ghost" onclick="closeModal()">Annuleren</button>
    <button type="button"class="btn btn-primary" onclick="doAdjustBalance('${iban}')">Opslaan</button>`;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

async function doAdjustBalance(iban) {
  const amount = parseFloat(document.getElementById('adj-amount').value);
  if (isNaN(amount)) { toast('Voer een geldig bedrag in', 'err'); return; }
  const r = await api('/accounts/' + iban + '/balance', { method: 'PUT', body: JSON.stringify({ amount }) });
  toast(r.ok ? `Saldo bijgewerkt: € ${fmt(r.data?.balance)}` : r.message, r.ok ? 'ok' : 'err');
  if (r.ok) { closeModal(); loadAccounts(); loadStats(); }
}

// ════════════════════════════════════════════════════
// PAYMENTS (ADMIN)
// ════════════════════════════════════════════════════
async function loadPaymentAccounts() {
  const r = await api('/accounts');
  const opts = (r.data || []).map(a => `<option value="${a.id}">${a.id} (€ ${fmt(a.balance)})</option>`).join('');
  document.getElementById('pay-from').innerHTML = opts;
}

async function loadPaymentOut() {
  const r = await api('/po_out');
  const tbody = document.querySelector('#tbl-pay-out tbody');
  const rows = r.data || [];
  if (!rows.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Geen betalingen</td></tr>'; return; }
  tbody.innerHTML = rows.map(p => `<tr>
    <td class="mono" style="max-width:180px;overflow:hidden;text-overflow:ellipsis" title="${p.po_id}">${p.po_id.slice(-20)}</td>
    <td>€ ${fmt(p.po_amount)}</td>
    <td class="mono">${p.oa_id}</td>
    <td class="mono">${p.ba_id}</td>
    <td>${p.bb_id || '–'}</td>
    <td>${fmtDate(p.po_datetime)}</td>
    <td>${sentBadge(p.sent_to_cb)}</td>
  </tr>`).join('');
}

async function sendPayment() {
  const from_iban = document.getElementById('pay-from').value;
  const to_iban   = document.getElementById('pay-to-iban').value.trim().replace(/\s/g, '').toUpperCase();
  const to_bic    = (document.getElementById('pay-to-bic').value.trim() || document.getElementById('pay-to-bic-sel').value).toUpperCase();
  const amount    = parseFloat(document.getElementById('pay-amount').value);
  const message   = document.getElementById('pay-msg').value.trim();

  if (!from_iban || !to_iban || !to_bic || isNaN(amount) || !message) {
    toast('Vul alle velden in', 'err'); return;
  }
  setBtn('btn-send-pay', true, 'Betaling versturen');
  try {
    const r = await api('/payments', { method: 'POST', body: JSON.stringify({ from_iban, to_iban, to_bic, amount, message }) });
    showLastResp(r);
    toast(r.ok ? 'Betaling verstuurd! PO: ' + r.data?.po_id?.slice(-16) : (r.message || 'Fout'), r.ok ? 'ok' : 'err');
    if (r.ok) { loadPaymentOut(); loadStats(); }
  } catch (e) { toast('Fout: ' + e.message, 'err'); }
  finally { setBtn('btn-send-pay', false, 'Betaling versturen'); }
}

// ════════════════════════════════════════════════════
// PO MONITOR
// ════════════════════════════════════════════════════
function loadPoMonitor() {
  loadPoTable('po_new', 'tbl-po-new');
}

async function loadPoTable(endpoint, tblId) {
  const r = await api('/' + endpoint);
  const rows = r.data || [];
  const tbody = document.querySelector('#' + tblId + ' tbody');
  if (!rows.length) {
    const cols = document.querySelectorAll('#' + tblId + ' thead th').length;
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${cols}">Geen gegevens</td></tr>`;
    return;
  }
  if (tblId === 'tbl-po-new') {
    tbody.innerHTML = rows.map(p => `<tr>
      <td class="mono" title="${p.po_id}">${p.po_id.slice(-20)}</td>
      <td>€ ${fmt(p.po_amount)}</td>
      <td class="mono">${p.oa_id}</td>
      <td class="mono">${p.ba_id}</td>
      <td>${p.bb_id || '–'}</td>
      <td>${statusBadge(p.status)}</td>
      <td>${codeBadge(p.ob_code)}</td>
      <td>${fmtDate(p.po_datetime)}</td>
    </tr>`).join('');
  } else if (tblId === 'tbl-po-out') {
    tbody.innerHTML = rows.map(p => `<tr>
      <td class="mono" title="${p.po_id}">${p.po_id.slice(-20)}</td>
      <td>€ ${fmt(p.po_amount)}</td>
      <td class="mono">${p.oa_id}</td>
      <td class="mono">${p.ba_id}</td>
      <td>${p.bb_id || '–'}</td>
      <td>${codeBadge(p.ob_code)}</td>
      <td>${sentBadge(p.sent_to_cb)}</td>
      <td>${fmtDate(p.po_datetime)}</td>
    </tr>`).join('');
  } else if (tblId === 'tbl-po-in') {
    tbody.innerHTML = rows.map(p => `<tr>
      <td class="mono" title="${p.po_id}">${p.po_id.slice(-20)}</td>
      <td>€ ${fmt(p.po_amount)}</td>
      <td class="mono">${p.oa_id}</td>
      <td class="mono">${p.ba_id}</td>
      <td>${p.ob_id || '–'}</td>
      <td>${statusBadge(p.status)}</td>
      <td>${codeBadge(p.bb_code)}</td>
      <td>${fmtDate(p.po_datetime)}</td>
    </tr>`).join('');
  } else if (tblId === 'tbl-ack-in') {
    tbody.innerHTML = rows.map(p => `<tr>
      <td class="mono" title="${p.po_id}">${p.po_id.slice(-20)}</td>
      <td>€ ${fmt(p.po_amount)}</td>
      <td>${codeBadge(p.ob_code)}</td>
      <td>${codeBadge(p.cb_code)}</td>
      <td>${codeBadge(p.bb_code)}</td>
      <td>${fmtDate(p.received_at)}</td>
    </tr>`).join('');
  } else if (tblId === 'tbl-ack-out') {
    tbody.innerHTML = rows.map(p => `<tr>
      <td class="mono" title="${p.po_id}">${p.po_id.slice(-20)}</td>
      <td>€ ${fmt(p.po_amount)}</td>
      <td>${p.ob_id || '–'}</td>
      <td>${codeBadge(p.bb_code)}</td>
      <td>${sentBadge(p.sent_to_cb)}</td>
      <td>${fmtDate(p.bb_datetime)}</td>
    </tr>`).join('');
  }
}

// ════════════════════════════════════════════════════
// TRANSACTIONS
// ════════════════════════════════════════════════════
async function loadTxAccounts() {
  const r = await api('/accounts');
  const sel = document.getElementById('tx-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Alle accounts</option>' +
    (r.data || []).map(a => `<option value="${a.id}">${a.id}</option>`).join('');
  if (cur) sel.value = cur;
}

async function loadTransactions() {
  const acct = document.getElementById('tx-filter').value;
  const r = await api('/transactions' + (acct ? '?account=' + acct : ''));
  const tbody = document.querySelector('#tbl-tx tbody');
  const rows = r.data || [];
  if (!rows.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Geen transacties</td></tr>'; return; }
  tbody.innerHTML = rows.map(t => `<tr>
    <td>${t.id}</td>
    <td style="color:${Number(t.amount)>=0?'var(--ok)':'var(--err)'}">€ ${Number(t.amount) >= 0 ? '+' : ''}${fmt(t.amount)}</td>
    <td class="mono">${t.account_id || '–'}</td>
    <td class="mono" title="${t.po_id}">${(t.po_id||'–').slice(-20)}</td>
    <td>${t.isvalid ? '<span class="badge badge-ok">ja</span>' : '<span class="badge badge-err">nee</span>'}</td>
    <td>${t.iscomplete ? '<span class="badge badge-ok">ja</span>' : '<span class="badge badge-warn">nee</span>'}</td>
    <td>${fmtDate(t.datetime)}</td>
  </tr>`).join('');
}

// ════════════════════════════════════════════════════
// LOGS
// ════════════════════════════════════════════════════
function startLogInterval() {
  clearInterval(logInterval);
  logInterval = setInterval(loadLogs, 8000);
}

function toggleLogRefresh() {
  logAutoRefresh = !logAutoRefresh;
  const btn = document.getElementById('btn-log-refresh');
  if (logAutoRefresh) {
    startLogInterval();
    btn.textContent = '⏸ Pauzeer';
  } else {
    clearInterval(logInterval);
    btn.textContent = '▶ Hervatten';
  }
}

async function loadLogs() {
  const r = await api('/log?limit=200');
  const tbody = document.querySelector('#tbl-logs tbody');
  const rows = r.data || [];
  if (!rows.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Geen logs</td></tr>'; return; }

  const typeColor = { error: 'var(--err)', po_in: 'var(--ok)', po_out: '#7c3aed', ack_in: '#0891b2', ack_out: '#0891b2', general: 'var(--grey)' };

  tbody.innerHTML = rows.map(l => {
    const color = typeColor[l.type] || 'var(--grey)';
    return `<tr>
      <td style="white-space:nowrap">${fmtDate(l.datetime)}</td>
      <td><span class="badge" style="background:${color}20;color:${color}">${l.type || '–'}</span></td>
      <td style="max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${l.message||''}">${l.message || '–'}</td>
      <td class="mono">${l.po_id ? l.po_id.slice(-20) : '–'}</td>
      <td>${l.po_amount != null ? '€ ' + fmt(l.po_amount) : '–'}</td>
    </tr>`;
  }).join('');
}

// ════════════════════════════════════════════════════
// BANKS
// ════════════════════════════════════════════════════
async function loadBanks() {
  try {
    const r = await api('/banks');
    const banks = Array.isArray(r.data) ? r.data : (r.data?.banks || r.data?.data || []);
    knownBanks = banks;
    const tbody = document.querySelector('#tbl-banks tbody');
    if (!banks.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Geen banken</td></tr>'; return; }
    tbody.innerHTML = banks.map(b => `<tr>
      <td class="mono"><b>${b.id || b.bic || b.bank_bic || '–'}</b></td>
      <td>${b.name || b.bank_name || '–'}</td>
      <td>${b.type || b.bank_type || '–'}</td>
      <td style="font-size:.75rem;color:var(--muted)">${b.base_url || b.url || ''}</td>
    </tr>`).join('');
    populateBankDropdowns();
  } catch (e) { toast('Banken laden mislukt: ' + e.message, 'err'); }
}

function populateBankDropdowns() {
  const opts = knownBanks.map(b => {
    const bic = b.id || b.bic || b.bank_bic || '';
    const name = b.name || b.bank_name || bic;
    return `<option value="${bic}">${bic} – ${name}</option>`;
  }).join('');
  ['pay-to-bic-sel', 'u-pay-bic-sel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">Selecteer bank…</option>' + opts;
  });
}

function syncBicField() {
  const v = document.getElementById('pay-to-bic-sel').value;
  if (v) document.getElementById('pay-to-bic').value = v;
}
function syncUserBicField() {
  const v = document.getElementById('u-pay-bic-sel').value;
  if (v) document.getElementById('input-bic').value = v;
}

// ════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════
async function loadUsers() {
  const r = await api('/users');
  const tbody = document.querySelector('#tbl-users tbody');
  const rows = r.data || [];
  if (!rows.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Geen gebruikers</td></tr>'; return; }
  tbody.innerHTML = rows.map(u => `<tr>
    <td>${u.id}</td>
    <td><b>${u.username}</b></td>
    <td>${u.role === 'admin' ? '<span class="badge badge-blue">admin</span>' : '<span class="badge badge-grey">user</span>'}</td>
    <td>${fmtDate(u.created_at)}</td>
    <td>${u.id !== currentUser.id
      ? `<button type="button"class="btn btn-danger btn-sm" onclick="deleteUser(${u.id},'${u.username}')">Verwijderen</button>`
      : '<span style="color:var(--muted);font-size:.78rem">jij</span>'}</td>
  </tr>`).join('');
}

async function deleteUser(id, username) {
  if (!confirm(`Gebruiker "${username}" verwijderen?`)) return;
  const r = await api('/users/' + id, { method: 'DELETE' });
  toast(r.message, r.ok ? 'ok' : 'err');
  if (r.ok) loadUsers();
}

// ════════════════════════════════════════════════════
// MODALS
// ════════════════════════════════════════════════════
function openModal(type) {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  if (type === 'account-create') {
    document.getElementById('modal-title').textContent = 'Nieuw account aanmaken';
    document.getElementById('modal-body').innerHTML = `
      <div class="form-group">
        <label>IBAN</label>
        <div style="display:flex;gap:.5rem">
          <input id="new-acc-iban" type="text" placeholder="BE51233543472462" style="flex:1">
          <button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('new-acc-iban').value = generateRandomIban(); validateIbanField(document.getElementById('new-acc-iban'), 'new-acc-hint')">Genereer</button>
        </div>
        <span id="new-acc-hint" class="hint"></span>
      </div>
      <div class="form-group" style="margin-top:.75rem">
        <label>Beginbedrag (€)</label>
        <input id="new-acc-balance" type="number" min="0" step="0.01" value="5000">
      </div>`;
    document.getElementById('modal-footer').innerHTML = `
      <button type="button"class="btn btn-ghost" onclick="closeModal()">Annuleren</button>
      <button type="button"class="btn btn-primary" onclick="doCreateAccount()">Aanmaken</button>`;
    document.getElementById('new-acc-iban').addEventListener('input', function() {
      validateIbanField(this, 'new-acc-hint');
    });
  } else if (type === 'user-create') {
    document.getElementById('modal-title').textContent = 'Gebruiker toevoegen';
    document.getElementById('modal-body').innerHTML = `
      <div class="form-group">
        <label>Gebruikersnaam</label>
        <input id="new-user-name" type="text" placeholder="jan.janssen">
      </div>
      <div class="form-group" style="margin-top:.75rem">
        <label>Wachtwoord</label>
        <input id="new-user-pass" type="password" placeholder="••••••••">
      </div>
      <div class="form-group" style="margin-top:.75rem">
        <label>Rol</label>
        <select id="new-user-role">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>`;
    document.getElementById('modal-footer').innerHTML = `
      <button type="button"class="btn btn-ghost" onclick="closeModal()">Annuleren</button>
      <button type="button"class="btn btn-primary" onclick="doCreateUser()">Aanmaken</button>`;
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
function closeModalOverlay(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

function generateRandomIban() {
  const bbanStr = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
  const numericStr = bbanStr + '111400';
  let remainder = '';
  for (const ch of numericStr) {
    remainder = (remainder + ch);
    if (remainder.length >= 9) remainder = (parseInt(remainder, 10) % 97).toString();
  }
  let checkDigit = 98 - (parseInt(remainder, 10) % 97);
  return 'BE' + checkDigit.toString().padStart(2, '0') + bbanStr;
}

async function doCreateAccount() {
  const iban    = document.getElementById('new-acc-iban').value.trim().replace(/\s/g,'').toUpperCase();
  const balance = parseFloat(document.getElementById('new-acc-balance').value);
  if (!iban) { toast('Voer een IBAN in', 'err'); return; }
  const r = await api('/accounts', { method: 'POST', body: JSON.stringify({ id: iban, balance: isNaN(balance) ? 5000 : balance }) });
  toast(r.ok ? 'Account aangemaakt: ' + iban : r.message, r.ok ? 'ok' : 'err');
  if (r.ok) { closeModal(); loadAccounts(); loadStats(); }
}

async function doCreateUser() {
  const username = document.getElementById('new-user-name').value.trim();
  const password = document.getElementById('new-user-pass').value;
  const role     = document.getElementById('new-user-role').value;
  if (!username || !password) { toast('Vul alle velden in', 'err'); return; }
  const r = await api('/users', { method: 'POST', body: JSON.stringify({ username, password, role }) });
  toast(r.ok ? 'Gebruiker aangemaakt: ' + username : r.message, r.ok ? 'ok' : 'err');
  if (r.ok) { closeModal(); loadUsers(); }
}

// ════════════════════════════════════════════════════
// IBAN VALIDATOR (client-side)
// ════════════════════════════════════════════════════
function isValidIban(iban) {
  if (typeof iban !== 'string' || !/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const r = iban.slice(4) + iban.slice(0, 4);
  const n = r.split('').map(c => /[A-Z]/.test(c) ? (c.charCodeAt(0) - 55).toString() : c).join('');
  let rem = '';
  for (const ch of n) { rem += ch; if (rem.length >= 9) rem = (parseInt(rem, 10) % 97).toString(); }
  return parseInt(rem, 10) % 97 === 1;
}

function validateIbanField(input, hintId) {
  const val = input.value.trim().replace(/\s/g, '').toUpperCase();
  const hint = document.getElementById(hintId);
  if (!val) { hint.textContent = ''; hint.className = 'hint'; return; }
  if (isValidIban(val)) {
    hint.textContent = '✓ Geldig IBAN';
    hint.className = 'hint iban-val';
  } else {
    hint.textContent = '✗ Ongeldig IBAN (mod-97 check mislukt)';
    hint.className = 'hint iban-err';
  }
}

// ════════════════════════════════════════════════════
// USER VIEW
// ════════════════════════════════════════════════════
async function loadOwnAccounts() {
  const r = await api('/accounts');
  let allAccounts = r.data || [];
  // If logged in via IBAN, only show that one account
  if (lockedIban) {
    allAccounts = allAccounts.filter(a => a.id === lockedIban);
  }
  ownAccounts = allAccounts;
  const opts = ownAccounts.map(a => `<option value="${a.id}">${a.id}</option>`).join('');
  ['u-iban-sel', 'u-pay-from'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
}

async function loadUserAccount() {
  const iban = document.getElementById('u-iban-sel').value;
  if (!iban) return;
  const acc = ownAccounts.find(a => a.id === iban);
  document.getElementById('u-balance').textContent = acc ? '€ ' + fmt(acc.balance) : '–';
  document.getElementById('u-iban-display').textContent = iban;

  const r = await api('/transactions?account=' + iban);
  const tbody = document.querySelector('#tbl-u-tx tbody');
  const rows = (r.data || []).slice(0, 20);
  if (!rows.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Geen transacties</td></tr>'; return; }
  tbody.innerHTML = rows.map(t => `<tr>
    <td>${fmtDate(t.datetime)}</td>
    <td style="color:${Number(t.amount)>=0?'var(--ok)':'var(--err)'}"><b>€ ${Number(t.amount)>=0?'+':''}${fmt(t.amount)}</b></td>
    <td class="mono">${(t.po_id||'–').slice(-20)}</td>
    <td>${t.isvalid ? '<span class="badge badge-ok">ok</span>' : '<span class="badge badge-err">mislukt</span>'}</td>
  </tr>`).join('');
}

async function sendUserPayment() {
  const from_iban = document.getElementById('u-pay-from').value;
  const to_iban   = document.getElementById('u-pay-to-iban').value.trim().replace(/\s/g,'').toUpperCase();
  const to_bic    = (document.getElementById('input-bic').value.trim() || document.getElementById('u-pay-bic-sel').value).toUpperCase();
  const amount    = parseFloat(document.getElementById('u-pay-amount').value);
  const message   = document.getElementById('u-pay-msg').value.trim();
  const resEl     = document.getElementById('u-pay-result');

  if (!from_iban || !to_iban || !to_bic || isNaN(amount) || !message) {
    resEl.innerHTML = '<span style="color:var(--err)">Vul alle velden correct in.</span>';
    return;
  }
  if (!isValidIban(to_iban)) {
    resEl.innerHTML = '<span style="color:var(--err)">Ongeldig doel-IBAN.</span>';
    return;
  }
  if (amount <= 0 || amount > 500) {
    resEl.innerHTML = '<span style="color:var(--err)">Bedrag moet tussen €0.01 en €500 zijn.</span>';
    return;
  }

  setBtn('btn-u-send', true, '💸 Betaling versturen');
  resEl.innerHTML = '';
  try {
    const r = await api('/payments', { method: 'POST', body: JSON.stringify({ from_iban, to_iban, to_bic, amount, message }) });
    if (r.ok) {
      resEl.innerHTML = `<div style="background:var(--okl);border-radius:6px;padding:.75rem 1rem;color:var(--ok)">
        ✓ Betaling verstuurd!<br><small>PO: ${r.data?.po_id || '–'}</small>
      </div>`;
      await loadOwnAccounts();
      loadUserHistory();
    } else {
      resEl.innerHTML = `<div style="background:var(--errl);border-radius:6px;padding:.75rem 1rem;color:var(--err)">
        ✗ ${r.message || 'Fout bij versturen'}${r.code ? ' (code ' + r.code + ')' : ''}
      </div>`;
    }
  } catch (e) {
    resEl.innerHTML = `<div style="background:var(--errl);border-radius:6px;padding:.75rem 1rem;color:var(--err)">Fout: ${e.message}</div>`;
  } finally {
    setBtn('btn-u-send', false, '💸 Betaling versturen');
  }
}

async function loadUserHistory() {
  const r = await api('/po_out');
  const tbody = document.querySelector('#tbl-u-history tbody');
  const myIbans = new Set(ownAccounts.map(a => a.id));
  const rows = (r.data || []).filter(p => myIbans.has(p.oa_id));
  if (!rows.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Geen betalingen gevonden</td></tr>'; return; }
  tbody.innerHTML = rows.map(p => `<tr>
    <td>${fmtDate(p.po_datetime)}</td>
    <td class="mono" title="${p.po_id}">${p.po_id.slice(-20)}</td>
    <td>€ ${fmt(p.po_amount)}</td>
    <td class="mono">${p.ba_id}</td>
    <td>${p.bb_id || '–'}</td>
    <td>${codeBadge(p.ob_code)}</td>
    <td>${codeBadge(p.cb_code)}</td>
    <td>${codeBadge(p.bb_code)}</td>
  </tr>`).join('');
}

// ════════════════════════════════════════════════════
// STARTUP
// ════════════════════════════════════════════════════
(async function init() {
  const token = localStorage.getItem(TOKEN_KEY);
  const baseUrl = localStorage.getItem('BANK_API_URL') || '';
  if (token) {
    // Try to restore session
    try {
      const r = await fetch(baseUrl + '/api/stats', { headers: { Authorization: 'Bearer ' + token } });
      if (r.status === 401) { localStorage.removeItem(TOKEN_KEY); return; }
      // Decode user from token (JWT payload is base64)
      const payload = JSON.parse(atob(token.split('.')[1]));
      currentUser = { id: payload.id, username: payload.username, role: payload.role };
      initApp();
    } catch (_) { localStorage.removeItem(TOKEN_KEY); }
  }
})();