const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');

const SECRET = process.env.JWT_SECRET || 'change-me';

function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '4h' });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return fail(res, { status: 401, code: '9003', message: 'Missing Bearer token' });
  }
  try {
    const decoded = jwt.verify(m[1], SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return fail(res, { status: 401, code: '9003', message: 'Invalid or expired token' });
  }
}

module.exports = { sign, authRequired };
