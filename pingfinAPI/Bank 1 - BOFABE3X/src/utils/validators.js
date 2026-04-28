// Validators following the business rules in the manual.

function isValidBIC(bic) {
  if (typeof bic !== 'string') return false;
  // 8 or 11 chars, no spaces, A-Z and 0-9
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic);
}

function isValidIBAN(iban) {
  if (typeof iban !== 'string') return false;
  // Basic check: 15-34 chars, A-Z and 0-9, no spaces
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  // Mod-97 check
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged
    .split('')
    .map((c) => (/[A-Z]/.test(c) ? (c.charCodeAt(0) - 55).toString() : c))
    .join('');
  // Use BigInt-style mod by chunking
  let remainder = '';
  for (const ch of numeric) {
    remainder = (remainder + ch);
    if (remainder.length >= 9) {
      remainder = (parseInt(remainder, 10) % 97).toString();
    }
  }
  return parseInt(remainder, 10) % 97 === 1;
}

function isValidAmount(amount) {
  if (typeof amount !== 'number' || !isFinite(amount)) return false;
  if (amount <= 0) return false;
  // max 2 decimals
  return Math.round(amount * 100) === amount * 100;
}

function isValidPoId(poId, obBic) {
  if (typeof poId !== 'string') return false;
  if (poId.length > 50) return false;
  if (!poId.startsWith(`${obBic}_`)) return false;
  return true;
}

function isValidDatetime(dt) {
  if (typeof dt !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dt);
}

function nowDatetime() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return (
    d.getFullYear() + '-' +
    pad(d.getMonth() + 1) + '-' +
    pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' +
    pad(d.getMinutes()) + ':' +
    pad(d.getSeconds())
  );
}

// Validate full PO message structure
function validatePO(po, ownBic) {
  const errors = [];
  if (!isValidPoId(po.po_id, po.ob_id)) errors.push('Invalid po_id');
  if (!isValidAmount(Number(po.po_amount))) errors.push('Invalid po_amount');
  if (Number(po.po_amount) > 500) errors.push('Amount exceeds 500 EUR limit');
  if (!po.po_message || typeof po.po_message !== 'string') errors.push('Missing po_message');
  if (!isValidDatetime(po.po_datetime)) errors.push('Invalid po_datetime format (YYYY-MM-DD HH:MM:SS)');
  if (!isValidBIC(po.ob_id)) errors.push('Invalid ob_id (BIC)');
  if (!isValidIBAN(po.oa_id)) errors.push('Invalid oa_id (IBAN)');
  if (!isValidBIC(po.bb_id)) errors.push('Invalid bb_id (BIC)');
  if (!isValidIBAN(po.ba_id)) errors.push('Invalid ba_id (IBAN)');
  return errors;
}

module.exports = {
  isValidBIC,
  isValidIBAN,
  isValidAmount,
  isValidPoId,
  isValidDatetime,
  nowDatetime,
  validatePO,
};
