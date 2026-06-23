import assert from 'node:assert/strict';
import handler from '../api/admin-auth.js';

const INVALID_CREDENTIALS = { ok: false, error: 'Credenziali non valide' };
const METHOD_NOT_ALLOWED = { ok: false, error: 'Metodo non consentito' };
const RATE_LIMITED = { ok: false, error: 'Troppe richieste. Riprova tra un minuto.' };

const call = async ({ method = 'POST', password, body, omitBody = false, ip = `test-${crypto.randomUUID()}` } = {}) => {
  let statusCode = 200;
  let responseBody;
  const req = {
    method,
    headers: { 'x-forwarded-for': ip },
    socket: {}
  };
  if (!omitBody) req.body = body === undefined ? { password } : body;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { responseBody = value; return value; }
  };

  await handler(req, res);
  return { statusCode, body: responseBody };
};

process.env.ADMIN_PASSWORD = 'correct-test-password';

assert.deepEqual(await call({ method: 'GET' }), { statusCode: 405, body: METHOD_NOT_ALLOWED });
assert.deepEqual(await call({ method: 'PUT' }), { statusCode: 405, body: METHOD_NOT_ALLOWED });
assert.deepEqual(await call({ omitBody: true }), { statusCode: 401, body: INVALID_CREDENTIALS });
assert.deepEqual(await call({ password: undefined }), { statusCode: 401, body: INVALID_CREDENTIALS });
assert.deepEqual(await call({ password: '' }), { statusCode: 401, body: INVALID_CREDENTIALS });
assert.deepEqual(await call({ password: 'random-wrong-password' }), { statusCode: 401, body: INVALID_CREDENTIALS });
assert.deepEqual(await call({ password: 'correct-test-password' }), { statusCode: 200, body: { ok: true } });

const limitedIp = 'rate-limit-test-ip';
for (let attempt = 0; attempt < 10; attempt += 1) {
  assert.deepEqual(await call({ ip: limitedIp, password: 'wrong-password' }), { statusCode: 401, body: INVALID_CREDENTIALS });
}
assert.deepEqual(await call({ ip: limitedIp, password: 'correct-test-password' }), { statusCode: 429, body: RATE_LIMITED });

delete process.env.ADMIN_PASSWORD;
assert.deepEqual(await call({ password: 'correct-test-password' }), { statusCode: 401, body: INVALID_CREDENTIALS });

console.log('Admin authentication endpoint test passed');
