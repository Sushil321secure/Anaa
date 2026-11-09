// Display copy of the proposed wellness packages, used when the API has no packages to show (e.g. the
// database is not seeded yet). It only affects what is displayed: real checkout always uses the prices
// stored on the server, so these fallback cards link to a discovery call instead of taking payment.
// Package terms are proposed and pending confirmation from the Anaa Nutricare owner and dietitian.

const MONTHLY_PAISE = 1250000; // Rs 12,500, the single-month reference rate for savings

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function pricingFor({ durationDays, pricePaise, badge }) {
  const months = Math.max(1, Math.round(durationDays / 30));
  const referencePaise = MONTHLY_PAISE * months;
  const savingsPaise = Math.max(0, referencePaise - pricePaise);
  let label = null;
  if (savingsPaise > 0) label = `SAVE ${rupees(savingsPaise)}${badge === 'BEST_VALUE' ? ' – BEST VALUE' : ''}`;
  else if (months === 1) label = 'START YOUR JOURNEY';
  return {
    priced: true,
    months,
    pricePaise,
    referencePaise,
    savingsPaise,
    savingsPercent: Math.round((savingsPaise / referencePaise) * 1000) / 10,
    effectiveMonthlyPaise: Math.round(pricePaise / months),
    label,
  };
}

const raw = [
  {
    _id: 'fallback-essential', name: 'Anaa Essential', durationDays: 30, pricePaise: 1250000, badge: null,
    tagline: 'Start your wellness journey',
    summary: 'A full initial assessment and your first personalised nutrition programme.',
    bestFor: 'First-time clients who want a clear starting point and a plan they can follow.',
    initialConsultMinutes: 45, followUpConsults: 1, dietPlans: 1, dietRevisionsLabel: '1 diet-plan revision',
    features: ['Food and activity diary', 'Monthly progress assessment', 'Email support during working hours'],
  },
  {
    _id: 'fallback-transformation', name: 'Anaa Transformation', durationDays: 60, pricePaise: 2440000, badge: 'MOST_POPULAR',
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
    _id: 'fallback-complete', name: 'Anaa Complete Wellness', durationDays: 90, pricePaise: 3200000, badge: 'BEST_VALUE',
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

export const fallbackPackages = raw.map((p) => ({
  ...p,
  fallback: true,
  referenceMonthlyPaise: MONTHLY_PAISE,
  pricing: pricingFor(p),
}));
