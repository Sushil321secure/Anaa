import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/unused';
process.env.JWT_SECRET = 'test-secret-test-secret';

const { createApp } = await import('../src/app.js');
const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

const post = (path, body) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('discovery call rejects invalid input (validation runs before the database)', async () => {
  const res = await post('/api/enquiries', { name: 'A', email: 'bad', phone: 'x', goal: '' });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.details.email && body.details.phone);
});

test('discovery call rejects a past preferred time', async () => {
  const res = await post('/api/enquiries', {
    name: 'Asha', email: 'asha@example.com', phone: '9876543210', goal: 'Weight loss', preferredAt: '2020-01-01T10:00:00.000Z',
  });
  assert.equal(res.status, 400);
});

test('enquiry list and update require staff authentication', async () => {
  assert.equal((await fetch(`${base}/api/enquiries`)).status, 401);
  const res = await fetch(`${base}/api/enquiries/507f1f77bcf86cd799439011`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 401);
});

test('catalog management endpoints require authentication', async () => {
  assert.equal((await fetch(`${base}/api/services/all`)).status, 401);
  assert.equal((await post('/api/packages', { name: 'X', summary: 'Y' })).status, 401);
});

test('purchase endpoints require a logged-in customer', async () => {
  assert.equal((await post('/api/purchases/checkout', { packageId: '507f1f77bcf86cd799439011' })).status, 401);
  assert.equal((await post('/api/purchases/verify', {})).status, 401);
  assert.equal((await fetch(`${base}/api/purchases/mine`)).status, 401);
});

test('testimonial management requires authentication; the public list is open', async () => {
  assert.equal((await fetch(`${base}/api/testimonials/all`)).status, 401);
  assert.equal((await post('/api/testimonials', { name: 'X', quote: 'Y' })).status, 401);
  const res = await fetch(`${base}/api/testimonials/507f1f77bcf86cd799439011`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 401);
});
