const axios = require('axios');
require('dotenv').config();

let BASE_URL = process.env.CB_BASE_URL || 'https://stevenop.be/pingfin/api/v2';
if (BASE_URL.endsWith('/')) BASE_URL = BASE_URL.slice(0, -1);

const BIC = process.env.CB_BIC;
const SECRET = process.env.CB_SECRET_KEY;

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken(force = false) {
  const now = Date.now();
  if (!force && cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }
  const resp = await axios.post(`${BASE_URL}/token`, {
    bic: BIC,
    secret_key: SECRET,
  }, { timeout: 10_000 });

  // The API returns something like { token: "..." } — be flexible
  const token = resp.data?.token || resp.data?.data?.token;
  if (!token) throw new Error('No token returned from CB');

  cachedToken = token;
  tokenExpiresAt = now + (4 * 60 * 60 * 1000); // 4h
  return token;
}

async function authedRequest(method, path, body = null) {
  let token = await getToken();
  try {
    const resp = await axios({
      method,
      url: `${BASE_URL}${path}`,
      data: body,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15_000,
    });
    return resp.data;
  } catch (err) {
    // On 401: retry once with a fresh token
    if (err.response?.status === 401) {
      token = await getToken(true);
      const retry = await axios({
        method,
        url: `${BASE_URL}${path}`,
        data: body,
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15_000,
      });
      return retry.data;
    }
    throw err;
  }
}

// === Public CB endpoints ===

async function listBanks() {
  return authedRequest('GET', '/banks');
}

async function updateOwnBank({ name, members }) {
  return authedRequest('POST', '/banks', { name, members });
}

async function postPoIn(poList) {
  // OB sends a list of PO's to the CB (= CB.PO_IN)
  return authedRequest('POST', '/po_in', { data: poList });
}

async function getPoOut(testMode = false) {
  // BB pulls PO's from CB outbox.
  // testMode=true -> /po_out/test/true (does not delete or log)
  const path = testMode ? '/po_out/test/true' : '/po_out';
  return authedRequest('GET', path);
}

async function postAckIn(ackList) {
  // BB sends ACKs back to CB
  return authedRequest('POST', '/ack_in', { data: ackList });
}

async function getAckOut(testMode = false) {
  // OB pulls ACKs from CB
  const path = testMode ? '/ack_out/test/true' : '/ack_out';
  return authedRequest('GET', path);
}

async function getErrorCodes() {
  // No auth required for this endpoint
  const resp = await axios.get(`${BASE_URL}/errorcodes`, { timeout: 10_000 });
  return resp.data;
}

module.exports = {
  getToken,
  listBanks,
  updateOwnBank,
  postPoIn,
  getPoOut,
  postAckIn,
  getAckOut,
  getErrorCodes,
};
