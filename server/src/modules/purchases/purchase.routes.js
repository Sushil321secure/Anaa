import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Package } from '../catalog/catalog.model.js';
import { computePricing, totalConsultations } from '../catalog/pricing.js';
import { Purchase } from './purchase.model.js';
import { describe, expiryFrom } from './entitlements.js';
import { checkoutPrefill, createOrder, verifyPaymentSignature } from '../payments/razorpay.js';
import { confirmRedemption, earn, quoteRedemption, releaseRedemption, reserveRedemption } from '../rewards/service.js';
import { ApiError, asyncHandler } from '../../utils/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import { audit } from '../audit/audit.model.js';
import { getSetting } from '../settings/settings.js';

const router = Router();
router.use(requireAuth, requireRole('CUSTOMER'));

// The body says which package and (optionally) how many reward points to use. Prices and discounts are always worked out
// on the server from the database: nothing monetary is ever taken from the browser.
const checkoutSchema = z.object({
  packageId: z.string().refine(mongoose.isValidObjectId, 'Invalid package'),
  redeemPoints: z.number().int().min(1).max(1000000).optional(),
});
const verifySchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(200),
});
const cancelSchema = z.object({ razorpay_order_id: z.string().min(1).max(100) });

router.post('/checkout', asyncHandler(async (req, res) => {
  const { packageId, redeemPoints } = checkoutSchema.parse(req.body);
  const pkg = await Package.findOne({ _id: packageId, isActive: true }).lean();
  if (!pkg) throw new ApiError(404, 'Package not found');
  const pricing = computePricing(pkg);
  if (!pricing.priced || pricing.pricePaise <= 0) throw new ApiError(400, 'This package is priced on request. Please enquire instead.');
  if (redeemPoints) await quoteRedemption({ user: req.user, points: redeemPoints, pricePaise: pricing.pricePaise }); // fail early, before anything is created

  const purchase = await Purchase.create({
    user: req.user._id,
    package: pkg._id,
    snapshot: {
      name: pkg.name,
      durationDays: pkg.durationDays,
      pricePaise: pricing.pricePaise,
      referenceMonthlyPaise: pkg.referenceMonthlyPaise ?? undefined,
      referencePaise: pricing.referencePaise,
      savingsPaise: pricing.savingsPaise,
      effectiveMonthlyPaise: pricing.effectiveMonthlyPaise,
    },
    consultationsTotal: totalConsultations(pkg),
    amountPaidPaise: pricing.pricePaise,
  });

  try {
    let discountPaise = 0;
    if (redeemPoints) {
      ({ discountPaise } = await reserveRedemption({ user: req.user, points: redeemPoints, purchaseId: purchase._id, pricePaise: pricing.pricePaise }));
      purchase.discountPaise = discountPaise;
      purchase.rewardPointsUsed = redeemPoints;
    }
    const payablePaise = pricing.pricePaise - discountPaise;
    purchase.amountPaidPaise = payablePaise;
    const order = await createOrder({
      amountPaise: payablePaise,
      receipt: `pur_${purchase._id}`,
      notes: { purchaseId: String(purchase._id), package: pkg.name },
    });
    purchase.razorpayOrderId = order.id;
    await purchase.save();
    res.status(201).json({
      keyId: env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amountPaise: payablePaise,
      pricePaise: pricing.pricePaise,
      discountPaise,
      pointsUsed: redeemPoints || 0,
      packageName: pkg.name,
      prefill: checkoutPrefill(req.user),
    });
  } catch (err) {
    // the order could not be started: nothing was paid, so any reserved points go straight back
    await releaseRedemption(purchase._id, 'ORDER_FAILED').catch((e) => console.error('release failed', e.message));
    purchase.status = 'FAILED';
    await purchase.save();
    throw err;
  }
}));

// Pay-as-you-go consultation: one online or offline consultation, priced from the server-side fee settings.
// It becomes a one-use entitlement (valid 30 days) when the payment is verified, then is spent by booking a slot.
router.post('/consultation-checkout', asyncHandler(async (req, res) => {
  const { mode } = z.object({ mode: z.enum(['ONLINE', 'OFFLINE']) }).parse(req.body);
  const fees = await getSetting('consultationFees');
  const pricePaise = mode === 'ONLINE' ? fees.onlinePaise : fees.offlinePaise;
  const name = mode === 'ONLINE' ? 'Online consultation' : 'Offline consultation';
  const purchase = await Purchase.create({ user: req.user._id, kind: 'CONSULTATION', mode, snapshot: { name, durationDays: 30, pricePaise }, consultationsTotal: 1, amountPaidPaise: pricePaise });
  try {
    const order = await createOrder({ amountPaise: pricePaise, receipt: `con_${purchase._id}`, notes: { purchaseId: String(purchase._id), consultation: mode } });
    purchase.razorpayOrderId = order.id;
    await purchase.save();
    res.status(201).json({ keyId: env.RAZORPAY_KEY_ID, orderId: order.id, amountPaise: pricePaise, pricePaise, discountPaise: 0, pointsUsed: 0, packageName: name, prefill: checkoutPrefill(req.user) });
  } catch (err) {
    purchase.status = 'FAILED';
    await purchase.save();
    throw err;
  }
}));

router.post('/verify', asyncHandler(async (req, res) => {
  const body = verifySchema.parse(req.body);
  const purchase = await Purchase.findOne({ razorpayOrderId: body.razorpay_order_id, user: req.user._id });
  if (!purchase) throw new ApiError(404, 'Order not found');
  if (purchase.status === 'PAID') return res.json({ purchase: describe(purchase) }); // idempotent retry
  if (purchase.status === 'FAILED') throw new ApiError(400, 'This order was cancelled. Please start a new checkout.');

  const valid = verifyPaymentSignature({
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });
  if (!valid) throw new ApiError(400, 'Payment could not be verified. No package was activated and no points were earned.');

  // Activate exactly once, only from CREATED, after the signature check above. Everything reward-related happens after this point
  // and is driven only by this backend-verified state, never by anything the browser claims.
  const paidAt = new Date();
  const activated = await Purchase.findOneAndUpdate(
    { _id: purchase._id, status: 'CREATED' },
    { $set: { status: 'PAID', razorpayPaymentId: body.razorpay_payment_id, paidAt, expiresAt: expiryFrom(paidAt, purchase.snapshot.durationDays || 30) } },
    { new: true },
  );
  const result = activated || (await Purchase.findById(purchase._id));
  if (activated) {
    await audit(req.user._id, 'purchase.paid', 'purchase', purchase._id, { package: purchase.snapshot.name, discountPaise: purchase.discountPaise });
    if (purchase.kind === 'CONSULTATION') return res.json({ purchase: describe(result) }); // no package points or redemption for a single consultation
    await confirmRedemption(purchase._id).catch((err) => console.error('redemption confirm failed', err.message));
    await earn({
      userId: req.user._id, ruleKey: 'PURCHASE', refId: purchase._id, key: `purchase:${purchase._id}`,
      amountPaise: purchase.amountPaidPaise ?? purchase.snapshot.pricePaise, metadata: { package: purchase.snapshot.name },
    }).catch((err) => console.error('purchase reward failed', err.message));
  }
  res.json({ purchase: describe(result) });
}));

// The customer closed the payment window, or the payment failed: the order is abandoned and reserved points are released.
router.post('/cancel', asyncHandler(async (req, res) => {
  const { razorpay_order_id: orderId } = cancelSchema.parse(req.body);
  const purchase = await Purchase.findOne({ razorpayOrderId: orderId, user: req.user._id });
  if (!purchase) throw new ApiError(404, 'Order not found');
  const closed = await Purchase.findOneAndUpdate({ _id: purchase._id, status: 'CREATED' }, { $set: { status: 'FAILED' } }, { new: true });
  if (!closed) return res.json({ ok: true, status: purchase.status }); // already paid or already cancelled: nothing to do
  const released = await releaseRedemption(purchase._id, 'PAYMENT_CANCELLED');
  res.json({ ok: true, status: 'FAILED', pointsReturned: released?.restored || 0 });
}));

router.get('/mine', asyncHandler(async (req, res) => {
  const items = await Purchase.find({ user: req.user._id, status: 'PAID' }).sort({ expiresAt: -1 }).lean();
  res.json({ items: items.map((p) => describe(p)) });
}));

export default router;
