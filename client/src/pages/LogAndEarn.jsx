import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { fetchPublicProgram, selectRewards } from '../features/rewards/rewardsSlice.js';
import { inr } from '../utils/format.js';

const STEPS = [
  ['Create your account', 'Register and verify your email address. Points are only issued to verified customers.'],
  ['Earn points', 'Points are added automatically when the Anaa Nutricare system confirms a qualifying activity.'],
  ['Save at checkout', 'Choose how many points to use when you buy a wellness package. The discount is worked out by our server.'],
];

export default function LogAndEarn() {
  useDocumentMeta('Log & Earn Rewards | Anaa Nutricare', 'Earn reward points for verified activity with Anaa Nutricare and use them to save on wellness packages.');
  const dispatch = useDispatch();
  const { program } = useSelector(selectRewards);
  useEffect(() => { if (program.status === 'idle') dispatch(fetchPublicProgram()); }, [dispatch, program.status]);
  const p = program.data;
  const referral = p?.earn?.find((r) => r.key === 'REFERRAL');

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <div className="container"><Link to="/">Home</Link><span aria-hidden="true">&rsaquo;</span><span aria-current="page">Log &amp; Earn</span></div>
      </nav>

      <section className="page-hero">
        <div className="container">
          <p className="eyebrow">Rewards</p>
          <h1>Log &amp; <span>Earn</span></h1>
          <p className="lead">A simple way to be rewarded for looking after your health with us. Points are tracked by our system, so every balance is accurate and every change is on record.</p>
          <div className="cta-row">
            <Link className="btn btn-primary btn-lg" to="/register">Create a free account <Icon name="arrow" size={18} /></Link>
            <Link className="btn btn-outline btn-lg" to="/login">I already have an account</Link>
          </div>
        </div>
      </section>

      {p && !p.enabled && (
        <section className="section"><div className="container"><p className="lead">The Log &amp; Earn programme is not running at the moment. Please check back soon.</p></div></section>
      )}

      {p?.enabled && (
        <>
          <section className="section">
            <div className="container">
              <p className="kicker">Ways to earn</p>
              <h2 className="section-title">What earns you points</h2>
              <ul className="earn-grid">
                {p.earn.map((r) => (
                  <li key={r.key}><span className="earn-pts">+{r.points}</span><span>{r.label}{r.minPurchasePaise ? <small> (orders of {inr(r.minPurchasePaise)} or more)</small> : null}</span></li>
                ))}
              </ul>
            </div>
          </section>

          <section className="section alt">
            <div className="container">
              <p className="kicker">How it works</p>
              <h2 className="section-title">Three simple steps</h2>
              <ol className="steps-grid">
                {STEPS.map(([t, d], i) => <li key={t}><span className="step-n">{i + 1}</span><h3>{t}</h3><p>{d}</p></li>)}
              </ol>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <p className="kicker">Using your points</p>
              <h2 className="section-title">Save on wellness packages</h2>
              <p className="lead">100 points are worth {inr(p.paisePer100Points)}. You can use points on any package, and on more than one order, with a discount of up to {inr(p.maxDiscountPaise)} on each order.{p.minRedeemPoints ? ` Use at least ${p.minRedeemPoints} points at a time.` : ''}</p>
              {referral && <p className="lead">Refer a friend by email and earn {referral.points} points once they complete their first paid consultation. Only you, as the referrer, receive the reward, and your friend&apos;s details stay private.</p>}
              {p.expiryEnabled && <p className="lead">Points expire at the end of the month they are earned (Indian Standard Time), so use them while they last. We email you a reminder before they do.</p>}
            </div>
          </section>

          <section className="section alt">
            <div className="container">
              <h2 className="section-title">Good to know</h2>
              <ul className="terms">
                <li>Points are only issued for activity that Anaa Nutricare has verified itself, never from a browser message alone.</li>
                <li>A payment that fails or is cancelled earns no points, and any points you chose to use are returned.</li>
                <li>Points have no cash value and cannot be transferred or withdrawn.</li>
                <li>Anaa Nutricare may review and reverse points that were issued in error or through misuse.</li>
              </ul>
            </div>
          </section>
        </>
      )}

      <section className="cta-band">
        <div className="container">
          <h2>Start earning today</h2>
          <p>Create your free account and verify your email to begin.</p>
          <Link className="btn btn-light btn-lg" to="/register">Create account</Link>
        </div>
      </section>
    </>
  );
}
