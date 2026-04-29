const express = require('express');
const router = express.Router();
const { query } = require('../db/db');
const { ok, fail } = require('../utils/response');
const { CODES } = require('../utils/codes');
const cb = require('../services/cbClient');

router.get('/help', (req, res) => ok(res, {
  data: {
    bank_type: 'Regular Bank (OB/BB)',
    endpoints: {
      public: [
        'GET /api/help',
        'GET /api/info',
        'GET /api/accounts',
        'GET /api/banks',
        'GET /api/errorcodes',
        'POST /api/auth/login',
      ],
      protected: [
        'GET /api/po_new_generate?count=10',
        'POST /api/po_new_add',
        'GET /api/po_new_process',
        'GET /api/po_out_send',
        'GET /api/po_pull',
        'GET /api/po_in_process',
        'GET /api/ack_out_send',
        'GET /api/ack_pull',
        'GET /api/cycle',
        'GET /api/stats',
        'GET /api/po_new|po_out|po_in|ack_in|ack_out|transactions|log',
      ],
    },
    response_format: {
      ok: 'bool',
      status: 'HTTP code',
      code: 'message code',
      message: 'string',
      data: 'payload',
    },
  },
}));

router.get('/info', (req, res) => ok(res, {
  data: {
    bic: process.env.BANK_BIC,
    name: process.env.BANK_NAME,
    members: process.env.BANK_MEMBERS,
    type: 'regular',
  },
}));

router.get('/accounts', async (req, res) => {
  try {
    const rows = await query('SELECT id, balance FROM accounts ORDER BY id');
    return ok(res, { data: rows });
  } catch (err) {
    return fail(res, { status: 500, message: err.message });
  }
});

router.get('/banks', async (req, res) => {
  try {
    const resp = await cb.listBanks();
    return ok(res, { data: resp?.data || resp });
  } catch (err) {
    return fail(res, { status: 502, code: '9001', message: 'CB unreachable: ' + err.message });
  }
});

router.get('/errorcodes', async (req, res) => {
  let cbCodes = null;
  try {
    const resp = await cb.getErrorCodes();
    cbCodes = resp?.data || resp;
  } catch (err) {
    cbCodes = { error: err.message };
  }

  return ok(res, {
    data: {
      local: CODES,
      clearing_bank: cbCodes,
    },
  });
});

// === Webhooks (Ontvangen van CB) ===

router.post('/po_in', async (req, res) => {
  try {
    const list = req.body.data || req.body || [];
    if (!Array.isArray(list)) return fail(res, { status: 400, message: 'Expected array of POs' });
    
    let stored = 0;
    for (const po of list) {
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
      stored++;
    }
    return ok(res, { message: `Received ${list.length} POs, stored ${stored}` });
  } catch (err) {
    return fail(res, { status: 500, message: err.message });
  }
});

router.post('/ack_in', async (req, res) => {
  try {
    const list = req.body.data || req.body || [];
    if (!Array.isArray(list)) return fail(res, { status: 400, message: 'Expected array of ACKs' });

    let stored = 0;
    for (const ack of list) {
      await query(
        `INSERT IGNORE INTO ack_in
           (po_id, po_amount, po_message, po_datetime,
            ob_id, oa_id, ob_code, ob_datetime,
            cb_code, cb_datetime, bb_id, ba_id, bb_code, bb_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ack.po_id, ack.po_amount, ack.po_message, ack.po_datetime,
         ack.ob_id, ack.oa_id, ack.ob_code, ack.ob_datetime,
         ack.cb_code, ack.cb_datetime, ack.bb_id, ack.ba_id, ack.bb_code, ack.bb_datetime]
      );
      stored++;
    }
    return ok(res, { message: `Received ${list.length} ACKs, stored ${stored}` });
  } catch (err) {
    return fail(res, { status: 500, message: err.message });
  }
});

module.exports = router;
