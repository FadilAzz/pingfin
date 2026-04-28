// Message codes — based on the Pingfin manual + own additions.
// Also fetchable from the CB API configured through CB_BASE_URL

const CODES = {
  // General
  '2000': { type: 'general',  description: 'OK' },

  // OB validation errors (own)
  '3001': { type: 'ob_error', description: 'Originating account (OA) not found in this bank' },
  '3002': { type: 'ob_error', description: 'Insufficient balance on OA' },
  '3003': { type: 'ob_error', description: 'PO format invalid (validation failed)' },
  '3004': { type: 'ob_error', description: 'Amount exceeds 500 EUR limit' },
  '3005': { type: 'ob_error', description: 'Amount must be positive' },
  '3006': { type: 'ob_error', description: 'Duplicate po_id' },
  '3007': { type: 'ob_error', description: 'Internal payment (OB == BB)' },

  // CB errors (mirrored from manual)
  '4001': { type: 'cb_error', description: 'This is an internal transaction and should not be sent to CB' },
  '4002': { type: 'cb_error', description: 'Transaction amount exceeds 500 EUR limit' },
  '4003': { type: 'cb_error', description: 'Transaction amount cannot be negative' },
  '4004': { type: 'cb_error', description: 'bb_id does not exist in CB system' },
  '4005': { type: 'cb_error', description: 'PO already received by Clearing Bank' },

  // BB errors (own)
  '5001': { type: 'bb_error', description: 'Beneficiary account (BA) not found in this bank' },
  '5002': { type: 'bb_error', description: 'PO format invalid on BB side' },
  '5003': { type: 'bb_error', description: 'Duplicate PO received' },

  // Network / API errors
  '9001': { type: 'net_error', description: 'CB API unreachable / timeout' },
  '9002': { type: 'net_error', description: 'Invalid response from CB' },
  '9003': { type: 'net_error', description: 'Authentication with CB failed' },
};

function describe(code) {
  const c = CODES[code];
  return c ? c.description : 'Unknown code';
}

module.exports = { CODES, describe };
