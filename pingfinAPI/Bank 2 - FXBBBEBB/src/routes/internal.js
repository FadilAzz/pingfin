const express = require('express');
const router  = express.Router();
const { query } = require('../db/db');
const { ok, fail } = require('../utils/response');
const { authRequired } = require('../middleware/auth');
const { generatePOs } = require('../services/poGenerator');
const ob = require('../services/obProcessor');
const bb = require('../services/bbProcessor');

router.use(authRequired);

// ==========================================
// 1. ORIGINATING BANK (OB) - VERZENDEN
// ==========================================

router.get('/po_new_generate', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count || '10', 10), 100);
    const list  = await generatePOs(count, req.query.errors !== 'false');
    return ok(res, { data: list, message: `Generated ${list.length} PO's` });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.post('/po_new_add', async (req, res) => {
  try {
    const list = req.body?.data || [];
    const inserted = await ob.addToPoNew(list);
    return ok(res, { data: { inserted_count: inserted.length, inserted } });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.get('/po_new_process', async (req, res) => {
  try {
    const pos = await query("SELECT * FROM po_new WHERE status = 'pending'");
    if (pos.length === 0) return res.json({ ok: true, message: "Geen nieuwe PO's." });
    let processedCount = 0;
    for (const po of pos) {
      let ob_code = '2000'; 
      let status = 'validated';
      let isInternal = (po.bb_id === process.env.BANK_BIC);
      const [account] = await query("SELECT balance FROM accounts WHERE id = ?", [po.oa_id]);
      if (!account) { ob_code = '4004'; status = 'failed'; }
      else if (parseFloat(account.balance) < parseFloat(po.po_amount)) { ob_code = '4005'; status = 'failed'; }
      const ob_datetime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await query("UPDATE po_new SET ob_code = ?, ob_datetime = ?, status = ? WHERE po_id = ?", [ob_code, ob_datetime, status, po.po_id]);
      if (ob_code === '2000') {
        await query("UPDATE accounts SET balance = balance - ? WHERE id = ?", [po.po_amount, po.oa_id]);
        if (isInternal) {
          await query("UPDATE accounts SET balance = balance + ? WHERE id = ?", [po.po_amount, po.ba_id]);
          await query("UPDATE po_new SET status = 'processed_internally' WHERE po_id = ?", [po.po_id]);
        } else {
          await query(`INSERT IGNORE INTO po_out (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, bb_id, ba_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [po.po_id, po.po_amount, po.po_message, po.po_datetime, po.ob_id, po.oa_id, ob_code, ob_datetime, po.bb_id, po.ba_id]);
        }
      }
      processedCount++;
    }
    res.json({ ok: true, message: `${processedCount} PO's verwerkt.` });
  } catch (err) { res.status(500).json({ ok: false, message: err.message }); }
});

router.get('/po_out_send', async (req, res) => {
  try {
    const posToProcess = await query("SELECT * FROM po_out WHERE sent_to_cb = 0");
    if (posToProcess.length === 0) return res.json({ ok: true, message: "Niets om te versturen." });
    const tokenResponse = await fetch(`${process.env.CB_BASE_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bic: process.env.BANK_BIC, secret_key: process.env.CB_SECRET_KEY })
    });
    const tokenData = await tokenResponse.json();
    const response = await fetch(`${process.env.CB_BASE_URL}/po_in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenData.token}` },
      body: JSON.stringify({ data: posToProcess })
    });
    const cbResult = await response.json();
    if (cbResult.ok) {
      const poIds = posToProcess.map(po => po.po_id);
      await query(`UPDATE po_out SET sent_to_cb = 1 WHERE po_id IN (${poIds.map(() => '?').join(',')})`, poIds);
      res.json({ ok: true, message: "Verzonden naar CB!" });
    } else { res.status(500).json({ ok: false, cb_error: cbResult }); }
  } catch (err) { res.status(500).json({ ok: false, message: err.message }); }
});

// ==========================================
// 2. BENEFICIARY BANK (BB) - ONTVANGEN & ACK STUREN
// ==========================================

router.get('/po_pull', async (req, res) => {
  try {
    const tokenRes = await fetch(`${process.env.CB_BASE_URL}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bic: process.env.BANK_BIC, secret_key: process.env.CB_SECRET_KEY })
    });
    const tokenData = await tokenRes.json();
    const pullResponse = await fetch(`${process.env.CB_BASE_URL}/po_out`, { headers: { 'Authorization': `Bearer ${tokenData.token}` } });
    const pullData = await pullResponse.json();
    let inserted = 0;
    if (pullData.data) {
      for (const po of pullData.data) {
        await query(`INSERT IGNORE INTO po_in (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, bb_id, ba_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [po.po_id, po.po_amount, po.po_message, po.po_datetime, po.ob_id, po.oa_id, po.ob_code, po.ob_datetime, po.bb_id, po.ba_id]);
        inserted++;
      }
    }
    res.json({ ok: true, message: `${inserted} PO's binnengehaald.` });
  } catch (err) { res.status(500).json({ ok: false, message: err.message }); }
});

router.get('/po_in_process', async (req, res) => {
  try {
    const pos = await query("SELECT * FROM po_in WHERE status = 'pending'");
    if (pos.length === 0) return res.json({ ok: true, message: "Geen inkomende PO's." });
    for (const po of pos) {
      let bb_code = '2000';
      const [account] = await query("SELECT balance FROM accounts WHERE id = ?", [po.ba_id]);
      if (!account) bb_code = '4004';
      const bb_datetime = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await query("UPDATE po_in SET bb_code = ?, bb_datetime = ?, status = 'processed' WHERE po_id = ?", [bb_code, bb_datetime, po.po_id]);
      if (bb_code === '2000') {
        await query("UPDATE accounts SET balance = balance + ? WHERE id = ?", [po.po_amount, po.ba_id]);
      }
      // NIEUW: Zet de ACK klaar in de database
      await query(`INSERT IGNORE INTO ack_out (po_id, ob_id, bb_id, ob_code, bb_code, bb_datetime, sent_to_cb) VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [po.po_id, po.ob_id, po.bb_id, po.ob_code, bb_code, bb_datetime]);
    }
    res.json({ ok: true, message: "Inkomende PO's verwerkt en ACKs klaargezet." });
  } catch (err) { res.status(500).json({ ok: false, message: err.message }); }
});

// NIEUW: Verstuur de ACK naar de docent API
router.get('/ack_out_send', async (req, res) => {
  try {
    const acks = await query("SELECT po_id, ob_id, bb_id, ob_code, bb_code, bb_datetime FROM ack_out WHERE sent_to_cb = 0");
    if (acks.length === 0) return res.json({ ok: true, message: "Geen ACKs om te verzenden." });
    const tokenRes = await fetch(`${process.env.CB_BASE_URL}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bic: process.env.BANK_BIC, secret_key: process.env.CB_SECRET_KEY })
    });
    const tokenData = await tokenRes.json();
    const response = await fetch(`${process.env.CB_BASE_URL}/ack_in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenData.token}` },
      body: JSON.stringify({ data: acks })
    });
    const result = await response.json();
    if (result.ok) {
      const ids = acks.map(a => a.po_id);
      await query(`UPDATE ack_out SET sent_to_cb = 1 WHERE po_id IN (${ids.map(() => '?').join(',')})`, ids);
      res.json({ ok: true, message: "ACKs verzonden naar CB!" });
    } else { res.status(500).json({ ok: false, error: result }); }
  } catch (err) { res.status(500).json({ ok: false, message: err.message }); }
});

// ==========================================
// 3. OB - BEVESTIGING ONTVANGEN
// ==========================================

// NIEUW: Haal ACKs op bij de docent API
router.get('/ack_pull', async (req, res) => {
  try {
    const tokenRes = await fetch(`${process.env.CB_BASE_URL}/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bic: process.env.BANK_BIC, secret_key: process.env.CB_SECRET_KEY })
    });
    const tokenData = await tokenRes.json();
    const pullResponse = await fetch(`${process.env.CB_BASE_URL}/ack_out`, { headers: { 'Authorization': `Bearer ${tokenData.token}` } });
    const pullData = await pullResponse.json();
    let updated = 0;
    if (pullData.data) {
      for (const ack of pullData.data) {
        await query(`INSERT IGNORE INTO ack_in (po_id, bb_code, bb_datetime) VALUES (?, ?, ?)`, [ack.po_id, ack.bb_code, ack.bb_datetime]);
        await query(`UPDATE po_new SET status = 'completed' WHERE po_id = ?`, [ack.po_id]);
        updated++;
      }
    }
    res.json({ ok: true, message: `${updated} bevestigingen binnengehaald.` });
  } catch (err) { res.status(500).json({ ok: false, message: err.message }); }
});

// ==========================================
// 4. VIEWERS
// ==========================================
router.get('/po_new', async (req, res) => ok(res, { data: await query('SELECT * FROM po_new ORDER BY po_datetime DESC LIMIT 100') }));
router.get('/po_out', async (req, res) => ok(res, { data: await query('SELECT * FROM po_out ORDER BY po_datetime DESC LIMIT 100') }));
router.get('/po_in',  async (req, res) => ok(res, { data: await query('SELECT * FROM po_in  ORDER BY po_datetime DESC LIMIT 100') }));
router.get('/ack_in', async (req, res) => ok(res, { data: await query('SELECT * FROM ack_in ORDER BY po_id DESC LIMIT 100') }));
router.get('/ack_out',async (req, res) => ok(res, { data: await query('SELECT * FROM ack_out ORDER BY po_id DESC LIMIT 100') }));

module.exports = router;