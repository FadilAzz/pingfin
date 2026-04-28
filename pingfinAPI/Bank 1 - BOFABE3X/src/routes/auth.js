const express = require('express');
const bcrypt  = require('bcrypt');
const router  = express.Router();
const { query } = require('../db/db');
const { sign }  = require('../middleware/auth');
const { ok, fail } = require('../utils/response');

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return fail(res, { status: 400, message: 'username and password required' });
  try {
    const rows = await query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0)
      return fail(res, { status: 401, code: '9003', message: 'Invalid credentials' });
    const user = rows[0];
    if (!(await bcrypt.compare(password, user.password_hash)))
      return fail(res, { status: 401, code: '9003', message: 'Invalid credentials' });
    const token = sign({ id: user.id, username: user.username, role: user.role });
    return ok(res, { data: { token, user: { id: user.id, username: user.username, role: user.role } } });
  } catch (err) {
    return fail(res, { status: 500, message: err.message });
  }
});

module.exports = router;
