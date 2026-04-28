const { query, transaction } = require('../db/db');
const { isValidIBAN, nowDatetime } = require('../utils/validators');
const cb     = require('./cbClient');
const Logger = require('./logger');

async function pullPoFromCB() {
  let resp;
  try { resp = await cb.getPoOut(); }
  catch (err) {
    await Logger.error(`Failed to pull PO_OUT from CB: ${err.message}`);
    return { received: 0, error: err.message };
  }

  const list = resp?.data || [];
  if (!Array.isArray(list) || list.length === 0) return { received: 0, message: 'No POs available' };

  let stored = 0;
  for (const po of list) {
    try {
      await query(
        `INSERT IGNORE INTO po_in
           (po_id, po_amount, po_message, po_datetime,
            ob_id, oa_id, ob_code, ob_datetime,
            cb_code, cb_datetime, bb_id, ba_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received')`,
        [po.po_id, po.po_amount, po.po_message, po.po_datetime,
         po.ob_id, po.oa_id, po.ob_code, po.ob_datetime,
         po.cb_code, po.cb_datetime, po.bb_id, po.ba_id]
      );
      await Logger.po_in('PO received from CB', po);
      stored++;
    } catch (err) {
      await Logger.error(`Failed to insert PO_IN: ${err.message}`, po);
    }
  }
  return { received: list.length, stored };
}

async function processPoIn() {
  const pending = await query("SELECT * FROM po_in WHERE status = 'received'");
  const results = { processed: [], failed: [] };

  for (const po of pending) {
    let bb_code = '2000', failReason = null;

    if (!isValidIBAN(po.ba_id)) {
      bb_code = '5002'; failReason = 'Invalid BA IBAN';
    } else {
      const accs = await query('SELECT id FROM accounts WHERE id = ?', [po.ba_id]);
      if (accs.length === 0) { bb_code = '5001'; failReason = 'BA not found'; }
    }

    const bb_datetime = nowDatetime();

    try {
      await transaction(async (conn) => {
        if (bb_code === '2000') {
          await conn.execute('UPDATE accounts SET balance = balance + ? WHERE id = ?', [po.po_amount, po.ba_id]);
          await conn.execute(
            'INSERT INTO transactions (amount, datetime, po_id, account_id, isvalid, iscomplete) VALUES (?, ?, ?, ?, 1, 1)',
            [Math.abs(Number(po.po_amount)), bb_datetime, po.po_id, po.ba_id]);
        } else {
          await conn.execute(
            'INSERT INTO transactions (amount, datetime, po_id, account_id, isvalid, iscomplete) VALUES (?, ?, ?, ?, 0, 1)',
            [Math.abs(Number(po.po_amount)), bb_datetime, po.po_id, po.ba_id]);
        }

        await conn.execute(
          `INSERT INTO ack_out
             (po_id, po_amount, po_message, po_datetime,
              ob_id, oa_id, ob_code, ob_datetime,
              cb_code, cb_datetime, bb_id, ba_id, bb_code, bb_datetime, sent_to_cb)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [po.po_id, po.po_amount, po.po_message, po.po_datetime,
           po.ob_id, po.oa_id, po.ob_code, po.ob_datetime,
           po.cb_code, po.cb_datetime, po.bb_id, po.ba_id, bb_code, bb_datetime]
        );

        await conn.execute(
          'UPDATE po_in SET status = ?, bb_code = ?, bb_datetime = ? WHERE po_id = ?',
          [bb_code === '2000' ? 'processed' : 'failed', bb_code, bb_datetime, po.po_id]
        );
      });

      if (bb_code === '2000') {
        await Logger.po_in('PO processed: BA credited', { ...po, bb_code, bb_datetime });
        results.processed.push(po.po_id);
      } else {
        await Logger.error(`PO_IN failed (${bb_code}): ${failReason}`, { ...po, bb_code });
        results.failed.push({ po_id: po.po_id, code: bb_code, reason: failReason });
      }
    } catch (err) {
      await Logger.error(`Failed to process PO_IN: ${err.message}`, po);
      results.failed.push({ po_id: po.po_id, code: '9999', reason: err.message });
    }
  }
  return results;
}

async function sendAckOutToCB() {
  const pending = await query('SELECT * FROM ack_out WHERE sent_to_cb = 0');
  if (pending.length === 0) return { sent: 0, message: 'Nothing to send' };

  const payload = pending.map((a) => ({
    po_id: a.po_id, po_amount: Number(a.po_amount), po_message: a.po_message,
    po_datetime: a.po_datetime, ob_id: a.ob_id, oa_id: a.oa_id,
    ob_code: a.ob_code, ob_datetime: a.ob_datetime, cb_code: a.cb_code,
    cb_datetime: a.cb_datetime, bb_id: a.bb_id, ba_id: a.ba_id,
    bb_code: a.bb_code, bb_datetime: a.bb_datetime,
  }));

  try {
    const resp = await cb.postAckIn(payload);
    for (const a of pending) {
      await query('UPDATE ack_out SET sent_to_cb = 1 WHERE po_id = ?', [a.po_id]);
      await Logger.ack_out('ACK sent to CB', a);
    }
    return { sent: pending.length, response: resp };
  } catch (err) {
    await Logger.error(`Failed to send ACK_OUT to CB: ${err.message}`);
    return { sent: 0, error: err.message };
  }
}

module.exports = { pullPoFromCB, processPoIn, sendAckOutToCB };
