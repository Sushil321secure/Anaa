import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, Badge, EmptyState, FormRow, Loading, PageHeader, StatCard } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import { selectUser, resendVerification, selectVerifyLink } from '../features/auth/authSlice.js';
import { clearInvite, fetchReferrals, fetchTransactions, fetchWallet, selectRewards, sendInvite } from '../features/rewards/rewardsSlice.js';
import { fmtDate, inr } from '../utils/format.js';

// What each referral status means to the person who sent the invitation. Progress only: nothing about the friend's health or plans.
const STEPS = ['INVITATION_SENT', 'REGISTERED', 'CONSULTATION_BOOKED', 'AWAITING_COMPLETION', 'REWARD_CREDITED'];
const STEP_LABEL = { INVITATION_SENT: 'Invited', REGISTERED: 'Registered', CONSULTATION_BOOKED: 'Consultation booked', AWAITING_COMPLETION: 'Awaiting completion', REWARD_CREDITED: 'Reward credited' };
const STATUS_TEXT = {
  INVITATION_SENT: 'Waiting for your friend to register', REGISTERED: 'Registered. Waiting for a paid consultation', CONSULTATION_BOOKED: 'Consultation booked',
  AWAITING_COMPLETION: 'Waiting for the consultation to be completed', SUCCESSFUL: 'Qualified. Your reward is being added', REWARD_CREDITED: 'Reward credited',
  EXPIRED: 'Invitation expired', REJECTED: 'Not eligible',
};
const TONE = { REWARD_CREDITED: 'ok', SUCCESSFUL: 'ok', EXPIRED: 'off', REJECTED: 'off' };

function Tracker({ status }) {
  const at = status === 'SUCCESSFUL' ? STEPS.length - 1 : STEPS.indexOf(status);
  if (at < 0) return null;
  return (
    <ol className="ref-steps" aria-label="Referral progress">
      {STEPS.map((s, i) => <li key={s} className={i <= at ? 'done' : ''}><span aria-hidden="true" />{STEP_LABEL[s]}</li>)}
    </ol>
  );
}

export default function CustomerRewards() {
  useDocumentMeta('Log & Earn Rewards | Anaa Nutricare');
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const devLink = useSelector(selectVerifyLink);
  const { wallet, transactions, referrals, invite } = useSelector(selectRewards);
  const [email, setEmail] = useState('');
  const [resent, setResent] = useState(false);

  useEffect(() => {
    dispatch(fetchWallet());
    dispatch(fetchTransactions(1));
    dispatch(fetchReferrals());
    return () => { dispatch(clearInvite()); };
  }, [dispatch]);

  const d = wallet.data;
  async function submit(e) {
    e.preventDefault();
    const res = await dispatch(sendInvite(email));
    if (sendInvite.fulfilled.match(res)) setEmail('');
  }
  async function resend() {
    await dispatch(resendVerification());
    setResent(true);
  }

  if (wallet.status === 'loading' && !d) return <Loading />;
  if (!d) return <Alert>{wallet.error?.message || 'Could not load your rewards.'}</Alert>;
  const { wallet: w, program, terms } = d;
  const earn = program.earn || [];
  const emailErr = invite.error?.details?.email?.[0];

  return (
    <>
      <PageHeader title="Log & Earn" subtitle="Earn reward points for looking after your health, and use them to save on your next package." />

      {!d.verified && (
        <div className="alert alert-info" role="status">
          <strong>Verify your email to start earning.</strong> Points are only issued to verified accounts.{' '}
          <button type="button" className="btn btn-outline btn-sm" onClick={resend} disabled={resent}>{resent ? 'Sent. Check your inbox' : 'Resend verification email'}</button>
          {devLink && <> <a href={devLink}>Development link: verify now</a></>}
        </div>
      )}
      {!program.enabled && <Alert kind="info">The Log &amp; Earn programme is not running at the moment. Your balance and history are kept safe.</Alert>}

      <div className="stats">
        <StatCard icon="gift" label="Available points" value={w.available} hint={program.enabled ? `Worth ${inr(Math.floor((w.available * program.paisePer100Points) / 100))}` : undefined} />
        <StatCard icon="star" tone="green" label="Total earned" value={w.totalEarned} />
        <StatCard icon="package" tone="orange" label="Total redeemed" value={w.totalRedeemed} />
        <StatCard icon="clock" label="Expiring this month" value={w.expiringThisMonth} hint={w.expiresAt ? `Use before ${fmtDate(new Date(new Date(w.expiresAt).getTime() - 1))}` : 'Nothing expiring'} />
      </div>

      {program.enabled && earn.length > 0 && (
        <section className="panel">
          <h2>Ways to earn</h2>
          <ul className="earn-grid">
            {earn.map((r) => (
              <li key={r.key}><span className="earn-pts">+{r.points}</span><span>{r.label}{r.minPurchasePaise ? <small> (orders of {inr(r.minPurchasePaise)} or more)</small> : null}</span></li>
            ))}
          </ul>
          <p className="muted" style={{ marginBottom: 0 }}>Use points at checkout on any package: 100 points = {inr(program.paisePer100Points)}, up to {inr(program.maxDiscountPaise)} off each order.{program.expiryEnabled ? ' Unused points expire at the end of each month.' : ''}</p>
        </section>
      )}

      <div className="grid-2">
        <section className="panel">
          <h2>Refer a friend</h2>
          <p className="muted" style={{ marginTop: 0 }}>Invite a friend by email. When they register with that email, verify it and complete their first paid consultation, you earn points{earn.find((r) => r.key === 'REFERRAL') ? ` (${earn.find((r) => r.key === 'REFERRAL').points})` : ''}. Your friend can only join as a new customer.</p>
          <form onSubmit={submit} noValidate>
            <Alert kind="ok">{invite.status === 'done' ? `Invitation sent to ${invite.sent}.` : null}</Alert>
            <Alert>{invite.status === 'failed' && !emailErr ? invite.error?.message : null}</Alert>
            {invite.devInviteLink && <Alert kind="info">Development mode (no email is configured): <a href={invite.devInviteLink}>open the invitation link</a></Alert>}
            <FormRow label="Your friend's email" id="ref-email" error={emailErr}>
              <input id="ref-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" disabled={!program.enabled || !d.verified} />
            </FormRow>
            <div className="form-actions"><button className="btn btn-primary" disabled={invite.status === 'loading' || !email || !program.enabled || !d.verified}>{invite.status === 'loading' ? 'Sending…' : 'Send invitation'}</button></div>
          </form>
        </section>

        <section className="panel">
          <h2>Your referrals</h2>
          {referrals.items.length === 0 ? (
            <EmptyState icon="users" title="No invitations yet" text="Invite a friend to see their progress here." />
          ) : (
            <ul className="row-list">
              {referrals.items.map((r) => (
                <li key={r._id} className="row-card ref-card">
                  <div className="ref-top">
                    <div><h3>{r.invitedEmail}</h3><p className="muted">Invited {fmtDate(r.createdAt)} · {STATUS_TEXT[r.status]}</p></div>
                    <Badge tone={TONE[r.status] || 'info'}>{r.status === 'REWARD_CREDITED' && r.rewardPoints ? `+${r.rewardPoints} points` : STEP_LABEL[r.status] || (r.status === 'EXPIRED' ? 'Expired' : r.status === 'REJECTED' ? 'Not eligible' : 'Qualified')}</Badge>
                  </div>
                  {!['EXPIRED', 'REJECTED'].includes(r.status) && <Tracker status={r.status} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>Points activity</h2>
        {transactions.items.length === 0 ? <p className="muted">Your points activity will appear here.</p> : (
          <>
            <div className="table-wrap">
              <table className="rtable">
                <thead><tr><th>Date</th><th>Activity</th><th>Points</th><th>Expires</th></tr></thead>
                <tbody>
                  {transactions.items.map((t) => (
                    <tr key={t._id}>
                      <td data-label="Date" className="nowrap">{fmtDate(t.createdAt)}</td>
                      <td data-label="Activity">{t.label}{t.status === 'PENDING' && <small className="muted"> (payment in progress)</small>}{t.status === 'REVERSED' && <small className="muted"> (returned)</small>}</td>
                      <td data-label="Points"><Badge tone={t.points > 0 ? 'ok' : 'warn'}>{t.points > 0 ? '+' : ''}{t.points}</Badge></td>
                      <td data-label="Expires" className="nowrap">{t.type === 'EARN' || (t.type === 'ADJUSTMENT' && t.points > 0) ? (t.expiresAt ? fmtDate(new Date(new Date(t.expiresAt).getTime() - 1)) : 'Never') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {transactions.pages > 1 && (
              <div className="cta-row" style={{ marginTop: 14, alignItems: 'center' }}>
                <button type="button" className="btn btn-outline btn-sm" disabled={transactions.page <= 1} onClick={() => dispatch(fetchTransactions(transactions.page - 1))}>Previous</button>
                <span className="muted">Page {transactions.page} of {transactions.pages}</span>
                <button type="button" className="btn btn-outline btn-sm" disabled={transactions.page >= transactions.pages} onClick={() => dispatch(fetchTransactions(transactions.page + 1))}>Next</button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel">
        <h2><Icon name="shield" size={20} /> Terms and conditions</h2>
        <ul className="terms">{terms.map((t) => <li key={t}>{t}</li>)}</ul>
      </section>
    </>
  );
}
