// Creates sample dietitians (the "coaches") and customers so a fresh database can be tested with a team. Existing e-mails are skipped,
// never changed. All accounts get the SAME password, so use this for testing only, never for real customers.
//
//   docker compose exec -e ALLOW_TEST_USERS=yes -e USERS_PASSWORD='Test@12345' backend node src/seeds/create-users.js
//
// Optional: -e DIETITIANS=5 -e CUSTOMERS=10 -e EMAIL_DOMAIN=anaa.test
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { User } from '../modules/users/user.model.js';
import { passwordField } from '../modules/auth/auth.routes.js';

const { ALLOW_TEST_USERS, USERS_PASSWORD } = process.env;
const DIETITIANS = Math.min(50, Math.max(0, Number(process.env.DIETITIANS ?? 5)));
const CUSTOMERS = Math.min(200, Math.max(0, Number(process.env.CUSTOMERS ?? 10)));
const DOMAIN = (process.env.EMAIL_DOMAIN || 'anaa.test').trim().toLowerCase();

if (ALLOW_TEST_USERS !== 'yes') {
  console.error('This creates accounts that share one password. Add -e ALLOW_TEST_USERS=yes to confirm it is for testing.');
  process.exit(1);
}
const check = passwordField.safeParse(USERS_PASSWORD);
if (!check.success) {
  console.error(`Set USERS_PASSWORD (${check.error?.issues?.[0]?.message || 'at least 8 characters with a letter and a number'}).`);
  process.exit(1);
}

const dietitianNames = ['Asha Rao', 'Ravi Kumar', 'Meera Nair', 'Kiran Shetty', 'Divya Menon', 'Arjun Patil', 'Sneha Iyer', 'Vikram Reddy', 'Pooja Desai', 'Rohan Gupta'];
const customerNames = ['Anita Sharma', 'Rahul Verma', 'Priya Singh', 'Suresh Babu', 'Lakshmi Devi', 'Amit Joshi', 'Neha Kulkarni', 'Manoj Pillai', 'Kavya Hegde', 'Sanjay Mehta', 'Deepa Nambiar', 'Naveen Gowda'];
const pick = (list, i) => (i < list.length ? list[i] : `${list[i % list.length].split(' ')[0]} ${String.fromCharCode(65 + Math.floor(i / list.length))}.`);

await connectDb();
const passwordHash = await bcrypt.hash(USERS_PASSWORD, 12);
const made = { DIETITIAN: [], CUSTOMER: [] };
let skipped = 0;

async function add(role, label, count, names) {
  for (let i = 0; i < count; i += 1) {
    const email = `${label}${i + 1}@${DOMAIN}`;
    if (await User.exists({ email })) { skipped += 1; continue; }
    await User.create({
      name: pick(names, i), email, role, passwordHash, emailVerifiedAt: new Date(),
      phone: `98765${String(role === 'DIETITIAN' ? 10 + i : 100 + i).padStart(5, '0')}`.slice(0, 10),
      ...(role === 'CUSTOMER' && { city: 'Bengaluru' }),
    });
    made[role].push(email);
  }
}
await add('DIETITIAN', 'dietitian', DIETITIANS, dietitianNames);
await add('CUSTOMER', 'customer', CUSTOMERS, customerNames);

console.log(`Created ${made.DIETITIAN.length} dietitians and ${made.CUSTOMER.length} customers (${skipped} already existed, left unchanged).`);
if (made.DIETITIAN.length) console.log('Dietitians (coaches):', made.DIETITIAN.join(', '));
if (made.CUSTOMER.length) console.log('Customers:', made.CUSTOMER.join(', '));
await mongoose.disconnect();
