// Creates (or resets the password of) the first OWNER account. Safe for production, unlike seed.js which refuses to run there.
//   docker compose exec -e OWNER_NAME="Full Name" -e OWNER_EMAIL=you@example.com -e OWNER_PASSWORD='...' backend node src/seeds/create-owner.js
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { User } from '../modules/users/user.model.js';
import { passwordField } from '../modules/auth/auth.routes.js';
import { normalizeEmail } from '../utils/http.js';

const { OWNER_NAME, OWNER_EMAIL, OWNER_PASSWORD } = process.env;
if (!OWNER_NAME || !OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error('Set OWNER_NAME, OWNER_EMAIL and OWNER_PASSWORD.');
  process.exit(1);
}
const check = passwordField.safeParse(OWNER_PASSWORD);
if (!check.success) {
  console.error(`Password rejected: ${check.error.issues[0].message}`);
  process.exit(1);
}

await connectDb();
const email = normalizeEmail(OWNER_EMAIL);
const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);
const existing = await User.findOne({ email });
if (existing) {
  if (existing.role !== 'OWNER') { console.error(`${email} already exists with role ${existing.role}. Refusing to change it.`); process.exit(1); }
  existing.passwordHash = passwordHash;
  await existing.save();
  console.log(`Password reset for owner ${email}.`);
} else {
  await User.create({ name: OWNER_NAME, email, role: 'OWNER', passwordHash, emailVerifiedAt: new Date() });
  console.log(`Owner ${email} created.`);
}
await mongoose.disconnect();
