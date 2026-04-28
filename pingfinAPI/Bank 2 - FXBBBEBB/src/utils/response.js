// Standard response format from the manual:
// { ok, status, code, message, data }

function ok(res, { data = null, code = '2000', message = 'OK', status = 200 } = {}) {
  return res.status(status).json({
    ok: true,
    status,
    code,
    message,
    data,
  });
}

function fail(res, { status = 400, code = null, message = 'Error', data = null } = {}) {
  return res.status(status).json({
    ok: false,
    status,
    code,
    message,
    data,
  });
}

module.exports = { ok, fail };
