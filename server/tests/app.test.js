import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/unused';
process.env.JWT_SECRET = 'test-secret-test-secret';

const { createApp } = await import('../src/app.js');
const app = createApp();
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => server.close());

test('health reports degraded without a DB connection', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 503);
});

test('protected route rejects anonymous requests', async () => {
  const res = await fetch(`${base}/api/auth/me`);
  assert.equal(res.status, 401);
});

test('register validates input before touching the database', async () => {
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'A', email: 'not-an-email', password: 'short' }),
  });
  assert.equal(res.status, 400);
});

test('cross-origin state-changing requests are rejected', async () => {
  const res = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
});
