const express = require('express');
const router = express.Router();
const { query } = require('../db/db'); // Zorg dat dit pad klopt met jouw bestandsstructuur
const { success, fail } = require('../utils/response'); // Als je deze helpers gebruikt

// GET /api/info/ (Deze had je al werkend!)
router.get('/info/', (req, res) => {
 const express = require('express');
const router  = express.Router();
const { query } = require('../db/db');
const { ok, fail } = require('../utils/response');
const { CODES } = require('../utils/codes');
const cb = require('../services/cbClient');

router.get('/help', (req, res) => ok(res, {
  data: {
    bank_type: 'Regular Bank (OB/BB)',
    endpoints: {
      public: ['GET /api/help', 'GET /api/info', 'GET /api/accounts',
               'GET /api/banks', 'GET /api/errorcodes', 'POST /api/auth/login'],
      protected: ['GET /api/po_new_generate?count=10', 'POST /api/po_new_add',
                  'GET /api/po_new_process', 'GET /api/po_out_send',
                  'GET /api/po_pull', 'GET /api/po_in_process', 'GET /api/ack_out_send',
                  'GET /api/ack_pull', 'GET /api/cycle', 'GET /api/stats',
                  'GET /api/po_new|po_out|po_in|ack_in|ack_out|transactions|log'],
    },
    response_format: { ok: 'bool', status: 'HTTP code', code: 'message code', message: 'string', data: 'payload' },
  },
}));

router.get('/info', (req, res) => ok(res, {
  data: {
    bic: process.env.BANK_BIC, name: process.env.BANK_NAME,
    members: process.env.BANK_MEMBERS, type: 'regular',
  },
}));

router.get('/accounts', async (req, res) => {
  try {
    const rows = await query('SELECT id, balance FROM accounts ORDER BY id');
    return ok(res, { data: rows });
  } catch (err) { return fail(res, { status: 500, message: err.message }); }
});

router.get('/banks', async (req, res) => {
  try {
    const resp = await cb.listBanks();
    return ok(res, { data: resp?.data || resp });
  } catch (err) { return fail(res, { status: 502, code: '9001', message: 'CB unreachable: ' + err.message }); }
});

router.get('/errorcodes', async (req, res) => {
  let cbCodes = null;
  try { const r = await cb.getErrorCodes(); cbCodes = r?.data || r; }
  catch (err) { cbCodes = { error: err.message }; }
  return ok(res, { data: { local: CODES, clearing_bank: cbCodes } });
});
});

// GET /api/accounts/ - Haalt alle rekeningen op
router.get('/accounts/', async (req, res) => {
  try {
    // Haal alle rekeningen op uit de database
    const sql = 'SELECT id, balance FROM accounts';
    const accounts = await query(sql);

    // Stuur ze terug in het verplichte formaat
    res.json({
      ok: true,
      status: 200,
      code: '2000',
      message: 'Lijst van alle accounts succesvol opgehaald',
      data: accounts
    });
  } catch (error) {
    console.error('Fout bij ophalen accounts:', error);
    res.status(500).json({
      ok: false,
      status: 500,
      code: '5000',
      message: 'Interne serverfout bij ophalen rekeningen',
      data: null
    });
  }
});

module.exports = router;