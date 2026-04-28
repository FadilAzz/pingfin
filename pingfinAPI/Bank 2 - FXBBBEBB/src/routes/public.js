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

module.exports = router;
