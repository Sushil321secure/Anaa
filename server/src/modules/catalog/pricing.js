// All discount and effective-price maths lives here so the browser never decides what a customer pays.
// Money is integer paise. Savings are measured against `referenceMonthlyPaise` x months (the single-month rate).

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const monthsFor = (durationDays) => Math.max(1, Math.round((durationDays || 30) / 30));

export function computePricing(pkg) {
  const months = monthsFor(pkg.durationDays);
  if (pkg.pricePaise == null) return { priced: false, months, label: null };

  const referencePaise = pkg.referenceMonthlyPaise ? pkg.referenceMonthlyPaise * months : pkg.pricePaise;
  const savingsPaise = Math.max(0, referencePaise - pkg.pricePaise);
  const savingsPercent = referencePaise > 0 ? Math.round((savingsPaise / referencePaise) * 1000) / 10 : 0;

  let label = null;
  if (savingsPaise > 0) label = `SAVE ${rupees(savingsPaise)}`;
  else if (months === 1) label = 'START YOUR JOURNEY';
  if (label && savingsPaise > 0 && pkg.badge === 'BEST_VALUE') label += ' – BEST VALUE';

  return {
    priced: true,
    months,
    pricePaise: pkg.pricePaise,
    referencePaise,
    savingsPaise,
    savingsPercent,
    effectiveMonthlyPaise: Math.round(pkg.pricePaise / months),
    label,
  };
}

// Consultations a customer may book: the initial consultation plus follow-ups.
export const totalConsultations = (pkg) => 1 + (pkg.followUpConsults || 0);
