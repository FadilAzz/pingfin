const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/db');
const { ok, fail } = require('../utils/response');
const { authRequired } = require('../middleware/auth');
const { generatePOs } = require('../services/poGenerator');
const { isValidIBAN, isValidBIC, isValidAmount, nowDatetime } = require('../utils/validators');
const ob = require('../services/obProcessor');
const bb = require('../services/bbProcessor');

router.use(authRequired);

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return fail(res, { status: 403, message: 'Admin only' });
  next();
}

// ── OB: ORIGINATING BANK ──────────────────────────────────────────────────────

router.get('/po_new_generate', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count || '10', 10), 100);
    const list  = await generatePOs(count, req.query.errors !== 'false');
    return ok(res, { data: list, message: `Generated ${list.length} PO's` });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.post('/po_new_add', async (req, res) => {
  try {
    const list     = req.body?.data || [];
    const inserted = await ob.addToPoNew(list);
    return ok(res, { data: { inserted_count: inserted.length, inserted } });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.get('/po_new_process', async (req, res) => {
  try {
    return ok(res, { data: await ob.processPoNew() });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.get('/po_out_send', async (req, res) => {
  try {
    return ok(res, { data: await ob.sendPoOutToCB() });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.get('/ack_pull', async (req, res) => {
  try {
    return ok(res, { data: await ob.pullAcksFromCB() });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

// ── BB: BENEFICIARY BANK ──────────────────────────────────────────────────────

router.get('/po_pull', async (req, res) => {
  try {
    return ok(res, { data: await bb.pullPoFromCB() });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.get('/po_in_process', async (req, res) => {
  try {
    return ok(res, { data: await bb.processPoIn() });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.get('/ack_out_send', async (req, res) => {
  try {
    return ok(res, { data: await bb.sendAckOutToCB() });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

// ── FULL CYCLE ────────────────────────────────────────────────────────────────

router.get('/cycle', async (req, res) => {
  try {
    const results = {
      po_new_process: await ob.processPoNew(),
      po_out_send:    await ob.sendPoOutToCB(),
      ack_pull:       await ob.pullAcksFromCB(),
      po_pull:        await bb.pullPoFromCB(),
      po_in_process:  await bb.processPoIn(),
      ack_out_send:   await bb.sendAckOutToCB(),
    };
    return ok(res, { data: results, message: 'Cycle complete' });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

// ── PAYMENTS (create + process + send in one step) ────────────────────────────

router.post('/payments', async (req, res) => {
  try {
    const { from_iban, to_iban, to_bic, amount, message } = req.body || {};
    if (!from_iban || !to_iban || !to_bic || amount == null || !message)
      return fail(res, { status: 400, message: 'Missing required fields: from_iban, to_iban, to_bic, amount, message' });
    if (!isValidIBAN(from_iban))       return fail(res, { status: 400, code: '3003', message: 'Invalid from_iban (IBAN check failed)' });
    if (!isValidIBAN(to_iban))         return fail(res, { status: 400, code: '3003', message: 'Invalid to_iban (IBAN check failed)' });
    if (!isValidBIC(to_bic))           return fail(res, { status: 400, code: '3003', message: 'Invalid to_bic' });
    if (!isValidAmount(Number(amount))) return fail(res, { status: 400, code: '4003', message: 'Invalid amount (must be positive, max 2 decimals)' });
    if (Number(amount) > 500)          return fail(res, { status: 400, code: '4002', message: 'Amount exceeds €500' });

    const OWN_BIC = process.env.BANK_BIC;
    const po_id   = `${OWN_BIC}_${Date.now()}-${uuidv4().slice(0, 8)}`;
    const po = {
      po_id,
      po_amount:   Number(amount),
      po_message:  message,
      po_datetime: nowDatetime(),
      ob_id: OWN_BIC,
      oa_id: from_iban,
      bb_id: to_bic,
      ba_id: to_iban,
    };

    const inserted = await ob.addToPoNew([po]);
    if (!inserted.length) return fail(res, { status: 500, message: 'Failed to queue payment' });

    const processResult = await ob.processPoNew();
    const sendResult    = await ob.sendPoOutToCB();

    return ok(res, { data: { po_id, process: processResult, send: sendResult }, message: 'Payment initiated' });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

// ── VIEWERS ───────────────────────────────────────────────────────────────────

router.get('/po_new', async (req, res) => {
  try { return ok(res, { data: await query('SELECT * FROM po_new  ORDER BY po_datetime DESC LIMIT 200') }); }
  catch (err) { return fail(res, { status: 500, message: err.message }); }
});
router.get('/po_out', async (req, res) => {
  try { return ok(res, { data: await query('SELECT * FROM po_out  ORDER BY po_datetime DESC LIMIT 200') }); }
  catch (err) { return fail(res, { status: 500, message: err.message }); }
});
router.get('/po_in', async (req, res) => {
  try { return ok(res, { data: await query('SELECT * FROM po_in   ORDER BY po_datetime DESC LIMIT 200') }); }
  catch (err) { return fail(res, { status: 500, message: err.message }); }
});
router.get('/ack_in', async (req, res) => {
  try { return ok(res, { data: await query('SELECT * FROM ack_in  ORDER BY received_at DESC LIMIT 200') }); }
  catch (err) { return fail(res, { status: 500, message: err.message }); }
});
router.get('/ack_out', async (req, res) => {
  try { return ok(res, { data: await query('SELECT * FROM ack_out ORDER BY bb_datetime DESC LIMIT 200') }); }
  catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.get('/transactions', async (req, res) => {
  try {
    const accountId = req.query.account;
    if (accountId) {
      return ok(res, { data: await query('SELECT * FROM transactions WHERE account_id=? ORDER BY datetime DESC LIMIT 200', [accountId]) });
    }
    return ok(res, { data: await query('SELECT * FROM transactions ORDER BY datetime DESC LIMIT 200') });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.get('/log', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    return ok(res, { data: await query('SELECT * FROM logs ORDER BY datetime DESC LIMIT ?', [limit]) });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const [
      [accRow],
      [poNewRow],
      [poOutPendingRow],
      [poInRow],
      [ackInRow],
      [ackOutPendingRow],
      [txOkRow],
      [txFailRow],
      [outstandingRow],
    ] = await Promise.all([
      query('SELECT COUNT(*) as accounts, COALESCE(SUM(balance),0) as total_balance FROM accounts'),
      query("SELECT COUNT(*) as cnt FROM po_new WHERE status='pending'"),
      query('SELECT COUNT(*) as cnt FROM po_out WHERE sent_to_cb=0'),
      query("SELECT COUNT(*) as cnt FROM po_in WHERE status='received'"),
      query('SELECT COUNT(*) as cnt FROM ack_in'),
      query('SELECT COUNT(*) as cnt FROM ack_out WHERE sent_to_cb=0'),
      query('SELECT COUNT(*) as cnt FROM transactions WHERE isvalid=1'),
      query('SELECT COUNT(*) as cnt FROM transactions WHERE isvalid=0'),
      query(`SELECT COUNT(*) as cnt FROM po_out
             WHERE sent_to_cb=1
               AND po_id NOT IN (SELECT po_id FROM ack_in)`),
    ]);
    return ok(res, {
      data: {
        accounts:            accRow.accounts,
        total_balance:       Number(accRow.total_balance),
        po_new:              poNewRow.cnt,
        po_out:              poOutPendingRow.cnt,
        po_in:               poInRow.cnt,
        ack_in:              ackInRow.cnt,
        ack_out:             ackOutPendingRow.cnt,
        tx_valid:            txOkRow.cnt,
        tx_failed:           txFailRow.cnt,
        outstanding_payments: outstandingRow.cnt,
      },
    });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

// ── ADMIN: ACCOUNTS CRUD ──────────────────────────────────────────────────────

router.post('/accounts', adminOnly, async (req, res) => {
  try {
    const { id, balance = 5000 } = req.body || {};
    if (!id || !isValidIBAN(id)) return fail(res, { status: 400, message: 'Invalid IBAN' });
    const bal = Number(balance);
    if (isNaN(bal) || bal < 0 || Math.round(bal * 100) !== bal * 100)
      return fail(res, { status: 400, message: 'Invalid balance' });
    await query('INSERT INTO accounts (id, balance) VALUES (?, ?)', [id, bal]);
    return ok(res, { data: { id, balance: bal }, message: 'Account created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, { status: 409, message: 'Account already exists' });
    return fail(res, { status: 500, message: err.message });
  }
});

router.put('/accounts/:iban/balance', adminOnly, async (req, res) => {
  try {
    const { iban } = req.params;
    const delta = Number(req.body?.amount);
    if (isNaN(delta) || !isFinite(delta) || Math.round(delta * 100) !== delta * 100)
      return fail(res, { status: 400, message: 'Invalid amount' });
    const [acc] = await query('SELECT balance FROM accounts WHERE id=?', [iban]);
    if (!acc) return fail(res, { status: 404, message: 'Account not found' });
    const newBalance = Number(acc.balance) + delta;
    if (newBalance < 0) return fail(res, { status: 400, message: 'Balance cannot go negative' });
    await query('UPDATE accounts SET balance=? WHERE id=?', [newBalance, iban]);
    return ok(res, { data: { id: iban, balance: newBalance } });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.delete('/accounts/:iban', adminOnly, async (req, res) => {
  try {
    const { iban } = req.params;
    const [acc] = await query('SELECT balance FROM accounts WHERE id=?', [iban]);
    if (!acc) return fail(res, { status: 404, message: 'Account not found' });
    if (Number(acc.balance) !== 0) return fail(res, { status: 400, message: 'Balance must be 0 before deletion' });
    const [pending] = await query(
      `SELECT COUNT(*) as cnt FROM po_out
       WHERE oa_id=? AND sent_to_cb=1 AND po_id NOT IN (SELECT po_id FROM ack_in)`,
      [iban]
    );
    if (pending.cnt > 0) return fail(res, { status: 400, message: 'Account has outstanding payments' });
    await query('DELETE FROM accounts WHERE id=?', [iban]);
    return ok(res, { message: 'Account deleted' });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

// ── ADMIN: USERS CRUD ─────────────────────────────────────────────────────────

router.get('/users', adminOnly, async (req, res) => {
  try {
    return ok(res, { data: await query('SELECT id, username, role, created_at FROM users ORDER BY id') });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.post('/users', adminOnly, async (req, res) => {
  try {
    const { username, password, role = 'user' } = req.body || {};
    if (!username || !password) return fail(res, { status: 400, message: 'username and password required' });
    if (!['admin', 'user'].includes(role)) return fail(res, { status: 400, message: "role must be 'admin' or 'user'" });
    const hash   = await bcrypt.hash(password, 10);
    const result = await query('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, hash, role]);
    return ok(res, { data: { id: result.insertId, username, role }, message: 'User created' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, { status: 409, message: 'Username already exists' });
    return fail(res, { status: 500, message: err.message });
  }
});

router.delete('/users/:id', adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.user.id) return fail(res, { status: 400, message: 'Cannot delete your own account' });
    const [user] = await query('SELECT id FROM users WHERE id=?', [id]);
    if (!user) return fail(res, { status: 404, message: 'User not found' });
    await query('DELETE FROM users WHERE id=?', [id]);
    return ok(res, { message: 'User deleted' });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

module.exports = router;
