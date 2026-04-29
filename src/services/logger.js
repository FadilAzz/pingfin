const { query } = require('../db/db');
const { nowDatetime } = require('../utils/validators');

async function log(type, message, po = null) {
  const datetime = nowDatetime();
  console.log(`[${datetime}] [${type}] ${message}${po?.po_id ? ` (${po.po_id})` : ''}`);
  try {
    await query(
      `INSERT INTO logs
        (datetime, message, type,
         po_id, po_amount, po_message, po_datetime,
         ob_id, oa_id, ob_code, ob_datetime,
         cb_code, cb_datetime,
         bb_id, ba_id, bb_code, bb_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datetime, message, type,
        po?.po_id    ?? null, po?.po_amount   ?? null,
        po?.po_message ?? null, po?.po_datetime ?? null,
        po?.ob_id    ?? null, po?.oa_id       ?? null,
        po?.ob_code  ?? null, po?.ob_datetime ?? null,
        po?.cb_code  ?? null, po?.cb_datetime ?? null,
        po?.bb_id    ?? null, po?.ba_id       ?? null,
        po?.bb_code  ?? null, po?.bb_datetime ?? null,
      ]
    );
  } catch (err) {
    console.error('Failed to write log:', err.message);
  }
}

const Logger = {
  general: (msg, po) => log('general', msg, po),
  po_in:   (msg, po) => log('po_in',   msg, po),
  po_out:  (msg, po) => log('po_out',  msg, po),
  ack_in:  (msg, po) => log('ack_in',  msg, po),
  ack_out: (msg, po) => log('ack_out', msg, po),
  error:   (msg, po) => log('error',   msg, po),
  api:     (msg, po) => log('api',     msg, po),
};

module.exports = Logger;
