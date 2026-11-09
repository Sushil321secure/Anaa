import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { User } from '../modules/users/user.model.js';
import { Service, Package } from '../modules/catalog/catalog.model.js';
import { Testimonial } from '../modules/testimonials/testimonial.model.js';
import fs from 'node:fs';
import path from 'node:path';
import { Purchase } from '../modules/purchases/purchase.model.js';
import { DietPlan } from '../modules/dietplans/dietplan.model.js';
import { ProgressEntry } from '../modules/progress/progress.model.js';
import { Appointment } from '../modules/appointments/appointment.model.js';
import { computePricing, totalConsultations } from '../modules/catalog/pricing.js';
import { expiryFrom } from '../modules/purchases/entitlements.js';
import { RewardRule, RewardWallet, RewardTransaction, RewardRedemption, ReferralInvitation } from '../modules/rewards/models.js';
import { saveProgram, getRules } from '../modules/rewards/config.js';
import { earn } from '../modules/rewards/service.js';
import { istDateString, slotsForDate } from '../modules/appointments/slots.js';
import { getSetting } from '../modules/settings/settings.js';
import { originalTestimonials } from './testimonials.data.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo users in production.');
  process.exit(1);
}

// Development-only demo accounts.
const DEMO_PASSWORD = 'Demo@12345';
const demo = [
  { name: 'Demo Owner', email: 'owner@anaa.test', role: 'OWNER' },
  { name: 'Demo Admin', email: 'admin@anaa.test', role: 'ADMIN' },
  { name: 'Demo Dietitian', email: 'dietitian@anaa.test', role: 'DIETITIAN' },
  { name: 'Demo Operations', email: 'ops@anaa.test', role: 'OPERATIONS' },
  { name: 'Demo Customer', email: 'customer@anaa.test', role: 'CUSTOMER' },
];

await connectDb();
const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
for (const u of demo) {
  await User.updateOne({ email: u.email }, { $set: { ...u, passwordHash, emailVerifiedAt: new Date() } }, { upsert: true });
}
console.log(`Seeded ${demo.length} demo users (password: ${DEMO_PASSWORD})`);

// Placeholder catalogue. pricePaise is null (= "pricing on request") until the owner sets real prices in admin.
const services = [
  { name: 'One-to-one Diet Consultation', slug: 'one-to-one-diet-consultation', summary: 'Personalized diet planning with a certified nutritionist, tailored to your lifestyle and goals.', durationMinutes: 45, sortOrder: 1 },
  { name: 'Weight Management', slug: 'weight-management', summary: 'Practical, sustainable guidance for healthy weight goals.', durationMinutes: 45, sortOrder: 2 },
  { name: 'PCOD / PCOS & Thyroid Nutrition', slug: 'pcod-pcos-thyroid-nutrition', summary: 'Nutrition support alongside your medical care for hormonal health.', durationMinutes: 45, sortOrder: 3 },
  { name: 'Diabetes Diet Support', slug: 'diabetes-diet-support', summary: 'Meal guidance to complement your doctor\'s treatment plan.', durationMinutes: 45, sortOrder: 4 },
];
// PROPOSED package terms, pending confirmation from the Anaa Nutricare owner and dietitian.
// Reference rate is Rs 12,500 per month; savings are derived from it in catalog/pricing.js.
const MONTHLY = 1250000;
const packages = [
  {
    name: 'Anaa Essential', slug: 'anaa-essential', sortOrder: 1, durationDays: 30,
    pricePaise: 1250000, referenceMonthlyPaise: MONTHLY, badge: null,
    tagline: 'Start your wellness journey',
    summary: 'A full initial assessment and your first personalised nutrition programme.',
    bestFor: 'First-time clients who want a clear starting point and a plan they can follow.',
    initialConsultMinutes: 45, followUpConsults: 1, dietPlans: 1, dietRevisionsLabel: '1 diet-plan revision',
    features: ['Food and activity diary', 'Monthly progress assessment', 'Email support during working hours'],
  },
  {
    name: 'Anaa Transformation', slug: 'anaa-transformation', sortOrder: 2, durationDays: 60,
    pricePaise: 2440000, referenceMonthlyPaise: MONTHLY, badge: 'MOST_POPULAR',
    tagline: 'Consistency and measurable progress',
    summary: 'Regular accountability, weekly reviews, meal guidance and adjustments over two months.',
    bestFor: 'Busy professionals, working couples and PG residents who need steady guidance and course corrections.',
    initialConsultMinutes: 45, followUpConsults: 2, dietPlans: 2, dietRevisionsLabel: 'Up to 2 diet-plan revisions',
    features: [
      'Weekly food and activity tracking reviews', 'Eating-out and office meal guidance',
      'Personalised grocery guidance', 'Monthly progress comparison', 'Email support during working hours',
    ],
  },
  {
    name: 'Anaa Complete Wellness', slug: 'anaa-complete-wellness', sortOrder: 3, durationDays: 90,
    pricePaise: 3200000, referenceMonthlyPaise: MONTHLY, badge: 'BEST_VALUE',
    tagline: 'Comprehensive long-term nutrition support',
    summary: 'More frequent consultations, deeper progress reviews, broader lifestyle guidance and a maintenance plan.',
    bestFor: 'Clients who want lasting change, including regular travellers and those who often eat out.',
    initialConsultMinutes: 60, followUpConsults: 4, dietPlans: 3, dietRevisionsLabel: 'Regular revisions based on progress',
    features: [
      'Weekly progress reviews', 'Detailed food diary review', 'Personalised grocery and meal-preparation guidance',
      'Restaurant, travel and working-day meal guidance', 'Final wellness assessment and maintenance plan', 'Priority email support',
    ],
  },
];
// Older placeholder packages (no prices) are hidden, not deleted.
await Package.updateMany({ slug: { $in: ['starter-wellness', 'transformation'] } }, { $set: { isActive: false } });
for (const s of services) await Service.updateOne({ slug: s.slug }, { $setOnInsert: s }, { upsert: true });
for (const p of packages) await Package.updateOne({ slug: p.slug }, { $setOnInsert: p }, { upsert: true });
console.log('Seeded placeholder services and the three proposed wellness packages.');
// Original client feedback from the previous website, stored word for word.
for (const [i, t] of originalTestimonials.entries()) {
  await Testimonial.updateOne({ name: t.name }, { $setOnInsert: { ...t, sortOrder: i + 1, isPublished: true } }, { upsert: true });
}
console.log(`Seeded ${originalTestimonials.length} original testimonials.`);
// Demo customer data (development only): a package with consultations, a few check-ins and one upcoming appointment.
const demoCustomer = await User.findOne({ email: 'customer@anaa.test' });
if (demoCustomer) {
  // DEVELOPMENT DEMO VALUES ONLY. The business owner has not approved any reward amounts or the conversion rate yet:
  // in production they are set in Admin > Rewards, and the programme stays OFF until then.
  await saveProgram({ enabled: true, paisePer100Points: 5000, maxDiscountPaise: 10000, minRedeemPoints: 0, expiryEnabled: true, inviteValidDays: 14, expiringSoonDays: 5 });
  await getRules();
  for (const [key, points, minPurchasePaise] of [['REGISTRATION', 20, 0], ['PURCHASE', 50, 0], ['CONSULTATION', 20, 0], ['REFERRAL', 100, 0]]) {
    await RewardRule.updateOne({ key }, { $set: { enabled: true, points, minPurchasePaise } });
  }
  await Promise.all([
    RewardTransaction.deleteMany({ user: demoCustomer._id }), RewardWallet.deleteMany({ user: demoCustomer._id }),
    RewardRedemption.deleteMany({ user: demoCustomer._id }), ReferralInvitation.deleteMany({ referrer: demoCustomer._id }),
  ]);
  await User.updateOne({ _id: demoCustomer._id }, { $set: { phone: '9876500001', city: 'Bengaluru', heightCm: 165, gender: 'FEMALE', healthGoal: 'Weight management' } });
  // Rebuilt on every seed so the demo account always starts from the same clean state.
  for (const plan of await DietPlan.find({ customer: demoCustomer._id })) fs.promises.unlink(path.resolve(process.cwd(), 'storage', 'diet-plans', plan.file.storedName)).catch(() => {});
  await Promise.all([DietPlan.deleteMany({ customer: demoCustomer._id }), Purchase.deleteMany({ user: demoCustomer._id }), Appointment.deleteMany({ customer: demoCustomer._id }), ProgressEntry.deleteMany({ customer: demoCustomer._id })]);
  {
    const pkg = await Package.findOne({ slug: 'anaa-transformation' }).lean();
    const pricing = computePricing(pkg);
    const paidAt = new Date(Date.now() - 5 * 24 * 3600 * 1000);
    const purchase = await Purchase.create({
      user: demoCustomer._id, package: pkg._id, status: 'PAID', source: 'MANUAL', note: 'Demo data',
      snapshot: { name: pkg.name, durationDays: pkg.durationDays, pricePaise: pricing.pricePaise, referenceMonthlyPaise: pkg.referenceMonthlyPaise, referencePaise: pricing.referencePaise, savingsPaise: pricing.savingsPaise, effectiveMonthlyPaise: pricing.effectiveMonthlyPaise },
      consultationsTotal: totalConsultations(pkg), consultationsUsed: 1, paidAt, expiresAt: expiryFrom(paidAt, pkg.durationDays),
    });
    const weights = [68.4, 67.9, 67.2, 66.8, 66.1];
    for (const [i, w] of weights.entries()) {
      const day = new Date(Date.now() - (weights.length - i) * 7 * 24 * 3600 * 1000);
      await ProgressEntry.create({ customer: demoCustomer._id, date: new Date(istDateString(day) + 'T00:00:00.000Z'), weightKg: w, waistCm: 82 - i * 0.6 });
    }
    const cfg = await getSetting('availability');
    for (let d = 2; d < 9; d += 1) {
      const slots = slotsForDate(istDateString(new Date(Date.now() + d * 24 * 3600 * 1000)), cfg);
      if (slots.length) {
        await Appointment.create({ customer: demoCustomer._id, purchase: purchase._id, startsAt: slots[2] || slots[0], durationMinutes: cfg.slotMinutes, slotNo: 1 });
        break;
      }
    }
    await earn({ userId: demoCustomer._id, ruleKey: 'REGISTRATION', refId: demoCustomer._id, key: `registration:${demoCustomer._id}` });
    await earn({ userId: demoCustomer._id, ruleKey: 'PURCHASE', refId: purchase._id, key: `purchase:${purchase._id}`, amountPaise: pricing.pricePaise });
    console.log('Seeded demo package, progress, appointment and reward points for customer@anaa.test');
  }
}
await mongoose.disconnect();
