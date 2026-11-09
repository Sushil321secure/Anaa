import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import CheckoutDialog from '../components/CheckoutDialog.jsx';
import PackageCard, { inr } from '../components/PackageCard.jsx';
import usePackages from '../hooks/usePackages.js';
import { selectUser } from '../features/auth/authSlice.js';
import { buyPackage, clearPurchaseMessage, selectPurchases } from '../features/purchases/purchaseSlice.js';
import { fetchPublicProgram, selectRewards } from '../features/rewards/rewardsSlice.js';
import { packageAudiences, packageMeals, packageSteps } from '../content/site.js';

export default function Packages() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const { packages } = usePackages();
  const { buying, error: buyError, lastPurchase } = useSelector(selectPurchases);
  const { program } = useSelector(selectRewards);
  const [checkout, setCheckout] = useState(null); // package being paid for, while the points dialog is open

  useEffect(() => { dispatch(fetchPublicProgram()); }, [dispatch]);
  useEffect(() => {
    document.title = 'Wellness Packages | Anaa Nutricare';
    return () => { dispatch(clearPurchaseMessage()); };
  }, [dispatch]);

  function onBuy(pkg) {
    if (!user) return navigate('/login', { state: { from: '/packages' } });
    if (user.role !== 'CUSTOMER') return undefined;
    if (program.data?.enabled && !pkg.fallback) return setCheckout(pkg); // offer reward points first
    return dispatch(buyPackage({ packageId: pkg._id }));
  }
  function confirmCheckout(points) {
    const pkgToBuy = checkout;
    setCheckout(null);
    dispatch(buyPackage({ packageId: pkgToBuy._id, redeemPoints: points || undefined }));
  }

  return (
    <>
      <section className="container page pkg-hero">
        <p className="eyebrow">Wellness Packages</p>
        <h1>Choose the support that fits your goal</h1>
        <p className="lead">Personalised nutrition guidance for everyday life: office days, PG meals, family kitchens and eating out. Pick one month to begin, or commit longer for steadier progress.</p>
      </section>

      <section className="container pkg-section">
        {user && user.role !== 'CUSTOMER' && <p className="note-box">You are signed in as staff. Online booking is for customer accounts.</p>}
        {buyError && <p className="form-error" role="alert">{buyError.message}</p>}
        {lastPurchase && (
          <p className="note-box ok" role="status">
            Payment verified. {lastPurchase.packageName} is active with {lastPurchase.consultationsRemaining} consultations. See your <Link to="/portal">dashboard</Link>.
          </p>
        )}
        <div className="pkg-grid">
          {packages.map((p) => (
            <PackageCard key={p._id} pkg={p} onBuy={onBuy} busy={buying === p._id} disabled={Boolean(buying) || (user && user.role !== 'CUSTOMER')} />
          ))}
        </div>
        <p className="pkg-fine">
          Savings are calculated against the single-month rate of {packages[0]?.referenceMonthlyPaise ? inr(packages[0].referenceMonthlyPaise) : 'the monthly package'}. Package terms are subject to confirmation by Anaa Nutricare. Nutrition guidance complements, and does not replace, your doctor&apos;s advice.
        </p>
      </section>

      {program.data?.enabled && (
        <section className="container pkg-earn">
          <p><strong>Log &amp; Earn:</strong> use your reward points at checkout (up to {inr(program.data.maxDiscountPaise)} off each order). <Link to="/log-and-earn">How it works</Link></p>
        </section>
      )}
      {checkout && <CheckoutDialog pkg={checkout} busy={Boolean(buying)} onConfirm={confirmCheckout} onCancel={() => setCheckout(null)} />}

      <section className="section">
        <div className="container">
          <p className="kicker">Built around you</p>
          <h2 className="section-title">Made for the way you eat</h2>
          <ul className="pill-grid pkg-aud">
            {packageAudiences.map((a) => (
              <li key={a.title}><strong>{a.title}</strong><span>{a.text}</span></li>
            ))}
          </ul>
          <h3 className="pkg-meals-title">Everyday meals we work with</h3>
          <ul className="pkg-meals">
            {packageMeals.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <h2 className="section-title">How it works</h2>
          <ol className="steps">
            {packageSteps.map((s) => <li key={s.title}><h3>{s.title}</h3><p>{s.text}</p></li>)}
          </ol>
        </div>
      </section>
    </>
  );
}
