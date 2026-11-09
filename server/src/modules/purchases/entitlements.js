import { Purchase } from './purchase.model.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const expiryFrom = (paidAt, durationDays) => new Date(paidAt.getTime() + durationDays * DAY_MS);

export const remaining = (p) => Math.max(0, p.consultationsTotal - p.consultationsUsed);

export function describe(p, now = new Date()) {
  const expired = !p.expiresAt || p.expiresAt <= now;
  return {
    id: String(p._id),
    packageName: p.snapshot?.name,
    kind: p.kind || 'PACKAGE',
    mode: p.mode,
    status: p.status,
    pricePaise: p.snapshot?.pricePaise,
    referencePaise: p.snapshot?.referencePaise,
    savingsPaise: p.snapshot?.savingsPaise,
    discountPaise: p.discountPaise || 0,
    rewardPointsUsed: p.rewardPointsUsed || 0,
    amountPaidPaise: p.amountPaidPaise ?? p.snapshot?.pricePaise,
    consultationsTotal: p.consultationsTotal,
    consultationsUsed: p.consultationsUsed,
    consultationsRemaining: p.status === 'PAID' ? remaining(p) : 0,
    paidAt: p.paidAt,
    expiresAt: p.expiresAt,
    active: p.status === 'PAID' && !expired && remaining(p) > 0, // has consultations to book with
    valid: p.status === 'PAID' && !expired, // the package itself is still running, even if every consultation is used
    expired: p.status === 'PAID' && expired,
  };
}

// Atomically uses one consultation from the customer's soonest-expiring valid package.
// The single conditional update means two parallel bookings can never exceed the entitlement.
// Returns the updated purchase, or null when the customer has nothing left to book.
export function consumeConsultation(userId, now = new Date(), mode = 'ONLINE') {
  return Purchase.findOneAndUpdate(
    {
      user: userId,
      status: 'PAID',
      expiresAt: { $gt: now },
      // a pay-as-you-go consultation can only be used for the mode that was paid for; packages cover either
      $or: [{ kind: { $ne: 'CONSULTATION' } }, { mode }],
      $expr: { $lt: ['$consultationsUsed', '$consultationsTotal'] },
    },
    { $inc: { consultationsUsed: 1 } },
    { sort: { expiresAt: 1 }, new: true },
  );
}

// Gives a consultation back (e.g. a booking is cancelled in time). Never goes below zero used.
export function releaseConsultation(purchaseId) {
  return Purchase.findOneAndUpdate(
    { _id: purchaseId, consultationsUsed: { $gt: 0 } },
    { $inc: { consultationsUsed: -1 } },
    { new: true },
  );
}
