import { RewardRule, RULE_KEYS } from './models.js';
import { getSetting, setSetting } from '../settings/settings.js';
import { istDateString, istToUtc } from '../appointments/slots.js';

// Everything an admin can change lives in the database (RewardRule rows + the 'rewardsProgram' setting).
// These defaults only mean "off": no amounts are assumed until the business owner chooses them.
export const RULE_LABELS = {
  REGISTRATION: 'Verified registration',
  PURCHASE: 'Package purchase',
  CONSULTATION: 'Completed paid consultation',
  REFERRAL: 'Successful referral',
};

export async function getProgram() {
  return getSetting('rewardsProgram');
}

export async function saveProgram(value) {
  return setSetting('rewardsProgram', value);
}

export async function getRules() {
  const rows = await RewardRule.find().lean();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const key of RULE_KEYS) {
    if (!byKey.has(key)) {
      // upsert so two requests creating the first rows at once cannot collide
      await RewardRule.updateOne({ key }, { $setOnInsert: { key, enabled: false, points: 0, minPurchasePaise: 0 } }, { upsert: true });
      byKey.set(key, await RewardRule.findOne({ key }).lean());
    }
  }
  return Object.fromEntries(RULE_KEYS.map((k) => [k, byKey.get(k)]));
}

// ---------------- Asia/Kolkata calendar helpers (timestamps are always stored in UTC)
export const monthKey = (d) => istDateString(d).slice(0, 7);

/** First instant of the next IST month: points earned now are valid strictly before this moment. */
export function endOfIstMonth(d) {
  const [y, m] = istDateString(d).split('-').map(Number); // m is 1-12
  return istToUtc(y, m, 1, 0, 0); // JS months are 0-based, so passing m means "the month after"
}

export function startOfIstMonth(d) {
  const [y, m] = istDateString(d).split('-').map(Number);
  return istToUtc(y, m - 1, 1, 0, 0);
}

/** Points at the given conversion that are worth at most `paise`. */
export const pointsWorth = (points, paisePer100Points) => Math.floor((points * paisePer100Points) / 100);
export const maxPointsForDiscount = (paise, paisePer100Points) => Math.max(0, Math.ceil(((paise + 1) * 100) / paisePer100Points) - 1);
