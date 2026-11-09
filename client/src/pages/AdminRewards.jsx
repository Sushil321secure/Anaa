import { Fragment, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, Badge, FormRow, Loading, PageHeader, StatCard } from '../components/ui.jsx';
import useDocumentMeta from '../hooks/useDocumentMeta.js';
import {
  adjustWallet, approveReferral, clearAdminRewardsAction, fetchReferralsAdmin, fetchRewardConfig, fetchRewardReport, fetchTransactionsAdmin,
  fetchWallets, rejectReferral, runMaintenance, saveRewardConfig, selectAdminRewards,
} from '../features/rewards/adminRewardsSlice.js';
import { fmtDate, fmtDateTime, inr } from '../utils/format.js';

const TABS = ['Settings', 'Wallets', 'Transactions', 'Referrals', 'Reports'];
const RULE_HELP = {
  REGISTRATION: 'Once, after the customer verifies their email.',
  PURCHASE: 'Each package payment confirmed by the server.',
  CONSULTATION: 'Each paid consultation marked completed by staff.',
  REFERRAL: 'Referrer only, after the invited friend completes a paid consultation.',
};

function Pager({ list, onPage }) {
  if (list.pages <= 1) return null;
  return (
    <div className="cta-row" style={{ marginTop: 14, alignItems: 'center' }}>
      <button type="button" className="btn btn-outline btn-sm" disabled={list.page <= 1} onClick={() => onPage(list.page - 1)}>Previous</button>
      <span className="muted">Page {list.page} of {list.pages}</span>
      <button type="button" className="btn btn-outline btn-sm" disabled={list.page >= list.pages} onClick={() => onPage(list.page + 1)}>Next</button>
    </div>
  );
}

function Settings({ data }) {
  const dispatch = useDispatch();
  const { action } = useSelector(selectAdminRewards);
  const p = data.program;
  const [f, setF] = useState({
    enabled: p.enabled, rupees: p.paisePer100Points / 100, maxDiscount: p.maxDiscountPaise / 100, minRedeem: p.minRedeemPoints,
    expiryEnabled: p.expiryEnabled, inviteValidDays: p.inviteValidDays, expiringSoonDays: p.expiringSoonDays,
  });
  const [rules, setRules] = useState(data.rules.map((r) => ({ key: r.key, label: r.label, enabled: r.enabled, points: r.points, min: (r.minPurchasePaise || 0) / 100 })));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setRule = (i, patch) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const err = action.error?.details || {};
  function submit(e) {
    e.preventDefault();
    dispatch(saveRewardConfig({
      program: {
        enabled: f.enabled, paisePer100Points: Math.round(Number(f.rupees) * 100), maxDiscountPaise: Math.round(Number(f.maxDiscount) * 100),
        minRedeemPoints: Number(f.minRedeem), expiryEnabled: f.expiryEnabled, inviteValidDays: Number(f.inviteValidDays), expiringSoonDays: Number(f.expiringSoonDays),
      },
      rules: rules.map((r) => ({ key: r.key, enabled: r.enabled, points: Number(r.points), minPurchasePaise: Math.round(Number(r.min) * 100) })),
    }));
  }
  return (
    <form onSubmit={submit} noValidate>
      <Alert kind="ok">{action.status === 'done' && action.message?.startsWith('Rewards settings') ? action.message : null}</Alert>
      <Alert>{action.status === 'failed' ? action.error?.message : null}</Alert>
      <div className="grid-2">
        <section className="panel">
          <h2>Programme</h2>
          <label className="check"><input type="checkbox" checked={f.enabled} onChange={set('enabled')} /> Log &amp; Earn is switched on</label>
          <p className="muted">Switching off pauses earning and redemption. Balances and history are kept.</p>
          <div className="form-grid">
            <FormRow label="Value of 100 points (₹)" id="rw-rate" error={err.program?.[0]}><input id="rw-rate" type="number" min="0.01" step="0.01" value={f.rupees} onChange={set('rupees')} /></FormRow>
            <FormRow label="Largest discount on one order (₹)" id="rw-cap"><input id="rw-cap" type="number" min="0" value={f.maxDiscount} onChange={set('maxDiscount')} /></FormRow>
            <FormRow label="Smallest redemption (points)" id="rw-min"><input id="rw-min" type="number" min="0" value={f.minRedeem} onChange={set('minRedeem')} /></FormRow>
            <FormRow label="Invitation valid for (days)" id="rw-inv"><input id="rw-inv" type="number" min="1" max="90" value={f.inviteValidDays} onChange={set('inviteValidDays')} /></FormRow>
            <FormRow label="Expiry reminder (days before month end)" id="rw-soon"><input id="rw-soon" type="number" min="1" max="28" value={f.expiringSoonDays} onChange={set('expiringSoonDays')} /></FormRow>
          </div>
          <label className="check"><input type="checkbox" checked={f.expiryEnabled} onChange={set('expiryEnabled')} /> Points expire at the end of the month they were earned (IST)</label>
        </section>

        <section className="panel">
          <h2>Earning rules</h2>
          <p className="muted" style={{ marginTop: 0 }}>A rule needs points above 0 before it can be switched on. Nothing is awarded by a rule that is off.</p>
          {rules.map((r, i) => (
            <div key={r.key} className="rule-row">
              <label className="check"><input type="checkbox" checked={r.enabled} onChange={(e) => setRule(i, { enabled: e.target.checked })} /> <strong>{r.label}</strong></label>
              <p className="muted">{RULE_HELP[r.key]}</p>
              <div className="form-grid">
                <FormRow label="Points" id={`rule-${r.key}`}><input id={`rule-${r.key}`} type="number" min="0" value={r.points} onChange={(e) => setRule(i, { points: e.target.value })} /></FormRow>
                {r.key === 'PURCHASE' && <FormRow label="Minimum amount paid (₹)" id="rule-min"><input id="rule-min" type="number" min="0" value={r.min} onChange={(e) => setRule(i, { min: e.target.value })} /></FormRow>}
              </div>
            </div>
          ))}
        </section>
      </div>
      <div className="form-actions"><button className="btn btn-primary" disabled={action.status === 'loading'}>{action.status === 'loading' ? 'Saving…' : 'Save rewards settings'}</button></div>
    </form>
  );
}

function Wallets() {
  const dispatch = useDispatch();
  const { wallets, action } = useSelector(selectAdminRewards);
  const [q, setQ] = useState('');
  const [adj, setAdj] = useState({ customerId: '', points: '', reason: '' });
  useEffect(() => { dispatch(fetchWallets({ q })); }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(e) {
    e.preventDefault();
    const res = await dispatch(adjustWallet({ customerId: adj.customerId, points: Number(adj.points), reason: adj.reason }));
    if (adjustWallet.fulfilled.match(res)) { setAdj({ customerId: '', points: '', reason: '' }); dispatch(fetchWallets({ q })); }
  }
  return (
    <>
      <section className="panel">
        <form className="cta-row" onSubmit={(e) => { e.preventDefault(); dispatch(fetchWallets({ q })); }} style={{ alignItems: 'flex-end' }}>
          <FormRow label="Search customer" id="wl-q"><input id="wl-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or phone" /></FormRow>
          <button className="btn btn-outline">Search</button>
        </form>
        {wallets.status === 'loading' && !wallets.items.length ? <Loading /> : wallets.items.length === 0 ? <p className="muted">No wallets found.</p> : (
          <div className="table-wrap">
            <table className="rtable">
              <thead><tr><th>Customer</th><th>Available</th><th>Earned</th><th>Redeemed</th><th>Expired</th><th /></tr></thead>
              <tbody>
                {wallets.items.map((w) => (
                  <tr key={w._id}>
                    <td data-label="Customer"><strong>{w.user?.name}</strong><br /><small className="muted">{w.user?.email}</small></td>
                    <td data-label="Available">{w.available}</td><td data-label="Earned">{w.totalEarned}</td><td data-label="Redeemed">{w.totalRedeemed}</td><td data-label="Expired">{w.totalExpired ?? 0}</td>
                    <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdj({ ...adj, customerId: w.user?._id })}>Adjust</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager list={wallets} onPage={(p) => dispatch(fetchWallets({ q, page: p }))} />
      </section>
      {adj.customerId && (
        <form className="panel" onSubmit={submit} noValidate>
          <h2>Manual adjustment</h2>
          <p className="muted" style={{ marginTop: 0 }}>Every adjustment is written to the ledger and the audit log. A reason is required.</p>
          <Alert kind="ok">{action.status === 'done' && action.message?.startsWith('Reward') ? action.message : null}</Alert>
          <Alert>{action.status === 'failed' ? action.error?.message : null}</Alert>
          <div className="form-grid">
            <FormRow label="Points (+ or −)" id="ad-pts"><input id="ad-pts" type="number" step="1" value={adj.points} onChange={(e) => setAdj({ ...adj, points: e.target.value })} /></FormRow>
            <FormRow label="Reason" id="ad-reason"><input id="ad-reason" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} minLength={5} maxLength={200} /></FormRow>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={!adj.points || adj.reason.trim().length < 5 || action.status === 'loading'}>Apply</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setAdj({ customerId: '', points: '', reason: '' }); dispatch(clearAdminRewardsAction()); }}>Cancel</button>
          </div>
        </form>
      )}
    </>
  );
}

function Transactions() {
  const dispatch = useDispatch();
  const { transactions } = useSelector(selectAdminRewards);
  const [f, setF] = useState({ q: '', type: '' });
  useEffect(() => { dispatch(fetchTransactionsAdmin(f)); }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="panel">
      <form className="cta-row" onSubmit={(e) => { e.preventDefault(); dispatch(fetchTransactionsAdmin(f)); }} style={{ alignItems: 'flex-end' }}>
        <FormRow label="Customer" id="tx-q"><input id="tx-q" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Name, email or phone" /></FormRow>
        <FormRow label="Type" id="tx-type">
          <select id="tx-type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="">All</option>{['EARN', 'REDEEM', 'REVERSE', 'EXPIRE', 'ADJUSTMENT'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </FormRow>
        <button className="btn btn-outline">Search</button>
      </form>
      {transactions.status === 'loading' && !transactions.items.length ? <Loading /> : transactions.items.length === 0 ? <p className="muted">No transactions found.</p> : (
        <div className="table-wrap">
          <table className="rtable">
            <thead><tr><th>When</th><th>Customer</th><th>Type</th><th>Activity</th><th>Points</th><th>Status</th></tr></thead>
            <tbody>
              {transactions.items.map((t) => (
                <tr key={t._id}>
                  <td data-label="When" className="nowrap">{fmtDateTime(t.createdAt)}</td>
                  <td data-label="Customer">{t.user?.name}<br /><small className="muted">{t.user?.email}</small></td>
                  <td data-label="Type">{t.type}</td>
                  <td data-label="Activity">{t.label}{t.reason ? <small className="muted"> ({t.reason})</small> : null}</td>
                  <td data-label="Points"><Badge tone={t.points > 0 ? 'ok' : 'warn'}>{t.points > 0 ? '+' : ''}{t.points}</Badge></td>
                  <td data-label="Status">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager list={transactions} onPage={(p) => dispatch(fetchTransactionsAdmin({ ...f, page: p }))} />
    </section>
  );
}

function Referrals() {
  const dispatch = useDispatch();
  const { referrals, action } = useSelector(selectAdminRewards);
  const [f, setF] = useState({ status: '', flagged: '' });
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  useEffect(() => { dispatch(fetchReferralsAdmin(f)); }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = () => dispatch(fetchReferralsAdmin(f));
  async function approve(id) { const r = await dispatch(approveReferral(id)); if (approveReferral.fulfilled.match(r)) reload(); }
  async function reject(e) {
    e.preventDefault();
    const r = await dispatch(rejectReferral({ id: rejecting, reason }));
    if (rejectReferral.fulfilled.match(r)) { setRejecting(null); setReason(''); reload(); }
  }
  return (
    <section className="panel">
      <Alert kind="ok">{action.status === 'done' && action.message?.startsWith('Referral') ? action.message : null}</Alert>
      <Alert>{action.status === 'failed' ? action.error?.message : null}</Alert>
      <form className="cta-row" onSubmit={(e) => { e.preventDefault(); reload(); }} style={{ alignItems: 'flex-end' }}>
        <FormRow label="Status" id="rf-status">
          <select id="rf-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">All</option>
            {['INVITATION_SENT', 'REGISTERED', 'CONSULTATION_BOOKED', 'AWAITING_COMPLETION', 'SUCCESSFUL', 'REWARD_CREDITED', 'EXPIRED', 'REJECTED'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}
          </select>
        </FormRow>
        <FormRow label="Needs review" id="rf-flag">
          <select id="rf-flag" value={f.flagged} onChange={(e) => setF({ ...f, flagged: e.target.value })}><option value="">Any</option><option value="true">Flagged only</option></select>
        </FormRow>
        <button className="btn btn-outline">Filter</button>
      </form>
      {referrals.status === 'loading' && !referrals.items.length ? <Loading /> : referrals.items.length === 0 ? <p className="muted">No referrals found.</p> : (
        <div className="table-wrap">
          <table className="rtable">
            <thead><tr><th>Referrer</th><th>Invited email</th><th>Status</th><th>Invited</th><th /></tr></thead>
            <tbody>
              {referrals.items.map((r) => (
                <tr key={r._id}>
                  <td data-label="Referrer">{r.referrer?.name}<br /><small className="muted">{r.referrer?.email}</small></td>
                  <td data-label="Invited email">{r.invitedEmail}{r.referredUser && <><br /><small className="muted">Joined as {r.referredUser.name}</small></>}</td>
                  <td data-label="Status"><Badge tone={r.status === 'REWARD_CREDITED' ? 'ok' : ['REJECTED', 'EXPIRED'].includes(r.status) ? 'off' : 'info'}>{r.status.replace(/_/g, ' ').toLowerCase()}</Badge>{r.flagged && <> <Badge tone="warn">needs review</Badge></>}{r.flagReason && <><br /><small className="muted">{r.flagReason}</small></>}</td>
                  <td data-label="Invited" className="nowrap">{fmtDate(r.createdAt)}</td>
                  <td>
                    {r.flagged && !['REWARD_CREDITED', 'REJECTED', 'EXPIRED'].includes(r.status) && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="btn btn-outline btn-sm" disabled={action.status === 'loading'} onClick={() => approve(r._id)}>Approve</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setRejecting(r._id); setReason(''); }}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager list={referrals} onPage={(p) => dispatch(fetchReferralsAdmin({ ...f, page: p }))} />
      {rejecting && (
        <form onSubmit={reject} noValidate style={{ marginTop: 16 }}>
          <FormRow label="Reason for rejecting (kept in the audit log)" id="rf-reason"><input id="rf-reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={200} /></FormRow>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={reason.trim().length < 5 || action.status === 'loading'}>Reject referral</button>
            <button type="button" className="btn btn-ghost" onClick={() => setRejecting(null)}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

function Reports() {
  const dispatch = useDispatch();
  const { report, action } = useSelector(selectAdminRewards);
  const [month, setMonth] = useState('');
  useEffect(() => { dispatch(fetchRewardReport(month)); }, [dispatch, month]);
  const d = report.data;
  async function maintain() { const r = await dispatch(runMaintenance()); if (runMaintenance.fulfilled.match(r)) dispatch(fetchRewardReport(month)); }
  return (
    <>
      <section className="panel">
        <div className="cta-row" style={{ alignItems: 'flex-end' }}>
          <FormRow label="Month" id="rp-month"><input id="rp-month" type="month" value={month || d?.month || ''} onChange={(e) => setMonth(e.target.value)} /></FormRow>
          <button type="button" className="btn btn-outline" onClick={maintain} disabled={action.status === 'loading'}>Run expiry and maintenance now</button>
        </div>
        <Alert kind="ok">{action.status === 'done' && action.message?.startsWith('Maintenance') ? action.message : null}</Alert>
        <Alert>{action.status === 'failed' ? action.error?.message : null}</Alert>
      </section>
      {!d ? <Loading /> : (
        <>
          <div className="stats">
            <StatCard icon="gift" label="Points earned" value={d.earned.total} hint={Object.entries(d.earned.bySource).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(' · ')} />
            <StatCard icon="package" tone="orange" label="Points redeemed" value={d.redeemed.points} hint={`${d.redeemed.orders} orders · ${inr(d.redeemed.discountPaise)} discount`} />
            <StatCard icon="clock" tone="green" label="Points expired" value={d.expired} hint={`Reversed ${-d.reversed}`} />
            <StatCard icon="star" label="Expiring this month" value={d.expiringThisMonth.points} hint={`${d.expiringThisMonth.customers} customers · by ${fmtDate(new Date(new Date(d.expiringThisMonth.at).getTime() - 1))}`} />
          </div>
          <div className="grid-2">
            <section className="panel">
              <h2>Referrals created this month</h2>
              {Object.keys(d.referrals).length === 0 ? <p className="muted">None.</p> : (
                <dl className="kv">{Object.entries(d.referrals).map(([k, v]) => <Fragment key={k}><dt>{k.replace(/_/g, ' ').toLowerCase()}</dt><dd>{v}</dd></Fragment>)}</dl>
              )}
              <p className="muted">Manual adjustments: +{d.adjustments.added} / −{d.adjustments.removed}</p>
            </section>
            <section className="panel">
              <h2>Expiry runs</h2>
              {d.expiryRuns.length === 0 ? <p className="muted">No runs recorded yet.</p> : (
                <ul className="row-list">{d.expiryRuns.slice(0, 8).map((r) => <li key={r._id} className="row-card"><div><h3>{r.type} · {r.period}</h3><p className="muted">{r.status} · {r.processed ?? 0} processed{r.completedAt ? ` · ${fmtDateTime(r.completedAt)}` : ''}</p></div></li>)}</ul>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}

export default function AdminRewards() {
  useDocumentMeta('Log & Earn | Anaa Admin');
  const dispatch = useDispatch();
  const { config } = useSelector(selectAdminRewards);
  const [tab, setTab] = useState('Settings');
  useEffect(() => { dispatch(fetchRewardConfig()); return () => { dispatch(clearAdminRewardsAction()); }; }, [dispatch]);
  return (
    <>
      <PageHeader title="Log & Earn" subtitle="Reward rules, conversion, wallets, referrals and reports." />
      <div className="tabs" role="tablist" aria-label="Rewards sections">
        {TABS.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); dispatch(clearAdminRewardsAction()); }}>{t}</button>)}
      </div>
      {tab === 'Settings' && (config.data ? <Settings data={config.data} /> : config.status === 'failed' ? <Alert>{config.error?.message}</Alert> : <Loading />)}
      {tab === 'Wallets' && <Wallets />}
      {tab === 'Transactions' && <Transactions />}
      {tab === 'Referrals' && <Referrals />}
      {tab === 'Reports' && <Reports />}
    </>
  );
}
