import assert from 'node:assert/strict';
import handler from '../api/admin-auth.js';

const call = async ({ method = 'POST', password, ip = `test-${Math.random()}` } = {}) => {
  let statusCode = 200; let body;
  const req = { method, body: { password }, headers: { 'x-forwarded-for': ip }, socket: {} };
  const res = { status(code) { statusCode = code; return this; }, json(value) { body = value; return value; } };
  await handler(req, res); return { statusCode, body };
};
process.env.ADMIN_PASSWORD = 'correct-test-password';
assert.deepEqual(await call({ method: 'GET' }), { statusCode: 405, body: { ok: false, error: 'Metodo non consentito' } });
assert.deepEqual(await call({ password: 'random-wrong-password' }), { statusCode: 401, body: { ok: false, error: 'Credenziali non valide' } });
assert.deepEqual(await call({ password: 'correct-test-password' }), { statusCode: 200, body: { ok: true } });
console.log('Admin authentication endpoint test passed');
