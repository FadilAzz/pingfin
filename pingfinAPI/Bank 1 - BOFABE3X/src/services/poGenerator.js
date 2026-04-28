const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/db');
const { nowDatetime } = require('../utils/validators');

const OWN_BIC = process.env.BANK_BIC;

// Vervang op dag 3 met echte BIC's via GET /api/banks
const SAMPLE_BBS = ['GKCCBEBB', 'BBRUBEBB', 'KREDBEBB', 'CRLYBEBB', OWN_BIC];

// Externe IBAN's (Geldige mod-97, o.a. van Bank 2)
const SAMPLE_BAS = [
  'BE72599632030243', 'BE47902229270183', 'BE87204679047275',
  'BE29989287756318', 'BE07278498715924', 'BE91076002915577',
  'BE83449104739265', 'BE95630165785956'
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function randomAmount(includeErrors) {
  const r = Math.random();
  if (includeErrors && r < 0.05) return -25.00;   // negatief (error)
  if (includeErrors && r < 0.10) return 750.00;   // > 500 (error)
  return Math.round((Math.random() * 499 + 1) * 100) / 100;
}

async function generatePOs(count = 10, includeErrors = true) {
  const accounts = await query('SELECT id FROM accounts ORDER BY RAND() LIMIT ?', [count]);
  if (accounts.length === 0) throw new Error('Geen accounts in de database');

  const list = [];
  for (let i = 0; i < count; i++) {
    const oa  = accounts[i % accounts.length].id;
    const bb  = pick(SAMPLE_BBS);
    const ba  = pick(SAMPLE_BAS);
    const poId = `${OWN_BIC}_${Date.now()}-${i}-${uuidv4().slice(0, 4)}`;
    list.push({
      po_id: poId,
      po_amount: randomAmount(includeErrors),
      po_message: `Test run ${new Date().toISOString().slice(0, 16)} - tx ${i + 1}`,
      po_datetime: nowDatetime(),
      ob_id: OWN_BIC,
      oa_id: oa,
      bb_id: bb,
      ba_id: ba,
    });
  }
  return list;
}

module.exports = { generatePOs };
