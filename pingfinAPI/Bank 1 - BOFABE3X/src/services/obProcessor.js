const { query, transaction } = require('../db/db');
const { validatePO, nowDatetime, isValidAmount } = require('../utils/validators');
const cb      = require('./cbClient');
const Logger  = require('./logger');

const OWN_BIC = process.env.BANK_BIC;

async function addToPoNew(poList) {
  const inserted = [];
  for (const po of poList) {
    try {
      await query(
        `INSERT IGNORE INTO po_new
           (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, bb_id, ba_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [po.po_id, po.po_amount, po.po_message, po.po_datetime, po.ob_id, po.oa_id, po.bb_id, po.ba_id]
      );
      inserted.push(po.po_id);
      await Logger.po_out('PO added to PO_NEW', po);
    } catch (err) {
      await Logger.error(`Failed to insert PO_NEW: ${err.message}`, po);
    }
  }
  return inserted;
}

async function processPoNew() {
  const pending = await query("SELECT * FROM po_new WHERE status = 'pending'");
  const results = { passed: [], failed: [] };

  for (const po of pending) {
    const errors = validatePO({
      po_id: po.po_id, po_amount: Number(po.po_amount),
      po_message: po.po_message, po_datetime: po.po_datetime,
      ob_id: po.ob_id, oa_id: po.oa_id, bb_id: po.bb_id, ba_id: po.ba_id,
    });

    let code = '2000', failReason = null;

    if (Number(po.po_amount) > 500) {
      code = '4002'; failReason = 'Transaction amount exceeds 500 EUR limit';
    } else if (Number(po.po_amount) <= 0 || !isValidAmount(Number(po.po_amount))) {
      code = '4003'; failReason = 'Transaction amount cannot be negative or invalid';
    } else if (errors.filter(e => !e.includes('amount')).length > 0) {
      code = '3003'; failReason = errors.filter(e => !e.includes('amount')).join('; ');
    } else if (po.bb_id === OWN_BIC) {
      code = '3007'; failReason = 'Internal payment (OB == BB)';
    } else {
      const accs = await query('SELECT balance FROM accounts WHERE id = ?', [po.oa_id]);
      if (accs.length === 0) {
        code = '3001'; failReason = 'OA not found';
      } else if (Number(accs[0].balance) < Number(po.po_amount)) {
        code = '3002'; failReason = 'Insufficient balance';
      }
    }

    const ob_datetime = nowDatetime();

    if (code !== '2000') {
      await query("UPDATE po_new SET status = 'failed', ob_code = ?, ob_datetime = ? WHERE po_id = ?",
        [code, ob_datetime, po.po_id]);
      await Logger.error(`Validation failed (${code}): ${failReason}`, { ...po, ob_code: code });
      results.failed.push({ po_id: po.po_id, code, reason: failReason });
      continue;
    }

    try {
      await transaction(async (conn) => {
        await conn.execute(
          `INSERT INTO po_out
             (po_id, po_amount, po_message, po_datetime, ob_id, oa_id, ob_code, ob_datetime, bb_id, ba_id, sent_to_cb)
           VALUES (?, ?, ?, ?, ?, ?, '2000', ?, ?, ?, 0)`,
          [po.po_id, po.po_amount, po.po_message, po.po_datetime, po.ob_id, po.oa_id, ob_datetime, po.bb_id, po.ba_id]
        );
        await conn.execute("UPDATE po_new SET status = 'processed', ob_code = '2000', ob_datetime = ? WHERE po_id = ?",
          [ob_datetime, po.po_id]);
      });
      await Logger.po_out('PO moved to PO_OUT', { ...po, ob_code: '2000', ob_datetime });
      results.passed.push(po.po_id);
    } catch (err) {
      await Logger.error(`Failed to move PO to PO_OUT: ${err.message}`, po);
      results.failed.push({ po_id: po.po_id, code: '9999', reason: err.message });
    }
  }
  return results;
}

async function sendPoOutToCB() {
  const pending = await query('SELECT * FROM po_out WHERE sent_to_cb = 0');
  if (pending.length === 0) return { sent: 0, message: 'Nothing to send' };

  const payload = pending.map((p) => ({
    po_id: p.po_id, po_amount: Number(p.po_amount), po_message: p.po_message,
    po_datetime: p.po_datetime, ob_id: p.ob_id, oa_id: p.oa_id,
    ob_code: p.ob_code, ob_datetime: p.ob_datetime, bb_id: p.bb_id, ba_id: p.ba_id,
  }));

  try {
    const resp = await cb.postPoIn(payload);
    for (const p of pending) {
      await query('UPDATE po_out SET sent_to_cb = 1 WHERE po_id = ?', [p.po_id]);
      await Logger.po_out('PO sent to CB', p);
    }
    return { sent: pending.length, response: resp };
  } catch (err) {
    await Logger.error(`Failed to send PO_OUT to CB: ${err.message}`);
    return { sent: 0, error: err.message };
  }
}

async function pullAcksFromCB() {
  let resp;
  try { resp = await cb.getAckOut(); }
  catch (err) {
    await Logger.error(`Failed to pull ACK_OUT from CB: ${err.message}`);
    return { received: 0, error: err.message };
  }

  const acks = resp?.data || [];
  if (!Array.isArray(acks) || acks.length === 0) return { received: 0, message: 'No ACKs available' };

  let processed = 0;
  for (const ack of acks) {
    try {
      await transaction(async (conn) => {
        await conn.execute(
          `INSERT IGNORE INTO ack_in
             (po_id, po_amount, po_message, po_datetime,
              ob_id, oa_id, ob_code, ob_datetime,
              cb_code, cb_datetime, bb_id, ba_id, bb_code, bb_datetime)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ack.po_id, ack.po_amount, ack.po_message, ack.po_datetime,
           ack.ob_id, ack.oa_id, ack.ob_code, ack.ob_datetime,
           ack.cb_code, ack.cb_datetime, ack.bb_id, ack.ba_id, ack.bb_code, ack.bb_datetime]
        );

        if (String(ack.bb_code) === '2000' && String(ack.cb_code) === '2000') {
          const [existing] = await conn.execute(
            'SELECT id FROM transactions WHERE po_id = ? AND account_id = ?', [ack.po_id, ack.oa_id]);
          if (existing.length === 0) {
            await conn.execute('UPDATE accounts SET balance = balance - ? WHERE id = ?', [ack.po_amount, ack.oa_id]);
            await conn.execute(
              'INSERT INTO transactions (amount, datetime, po_id, account_id, isvalid, iscomplete) VALUES (?, ?, ?, ?, 1, 1)',
              [-Math.abs(Number(ack.po_amount)), nowDatetime(), ack.po_id, ack.oa_id]);
          }
        } else {
          await conn.execute(
            'INSERT INTO transactions (amount, datetime, po_id, account_id, isvalid, iscomplete) VALUES (?, ?, ?, ?, 0, 1)',
            [-Math.abs(Number(ack.po_amount)), nowDatetime(), ack.po_id, ack.oa_id]);
        }
      });
      await Logger.ack_in(`ACK processed (cb=${ack.cb_code}, bb=${ack.bb_code})`, ack);
      processed++;
    } catch (err) {
      await Logger.error(`Failed to process ACK: ${err.message}`, ack);
    }
  }
  return { received: acks.length, processed };
}

module.exports = { addToPoNew, processPoNew, sendPoOutToCB, pullAcksFromCB };
