import { test } from 'node:test';
import assert from 'node:assert/strict';
import { originalTestimonials } from '../src/seeds/testimonials.data.js';

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://localhost:27017/unused';
process.env.JWT_SECRET = 'test-secret-test-secret';
const { testimonialSchema } = await import('../src/modules/testimonials/testimonial.routes.js');

test('the four original testimonials are present with their original wording', () => {
  assert.equal(originalTestimonials.length, 4);
  assert.deepEqual(originalTestimonials.map((t) => t.name), ['Ms. Puneetha Nagendra', 'Ms. Kavya Lokesh', 'Ms. Sampriktha Chatterjee', 'Ms. Jyoti Kumar']);
  assert.ok(originalTestimonials[0].quote.includes("I'm very happy  to be part of this fitness plan"));
  assert.ok(originalTestimonials[1].quote.includes('Anaa My Nealth Nutricare'));
  assert.ok(originalTestimonials[3].quote.includes('consultaion'));
});

test('testimonials have no image fields; validation keeps the quote text untouched', () => {
  const parsed = testimonialSchema.parse({ name: ' Ms. A ', quote: 'Great  help..', photo: 'x.jpg', avatar: 'y.png' });
  assert.equal(parsed.quote, 'Great  help..');
  assert.equal(parsed.photo, undefined);
  assert.equal(parsed.avatar, undefined);
});

test('the frontend fallback copy matches the seeded originals word for word', async () => {
  const { fallbackTestimonials } = await import('../../client/src/content/testimonials.js');
  assert.deepEqual(fallbackTestimonials.map(({ name, quote }) => ({ name, quote })), originalTestimonials);
});
