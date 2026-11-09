import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, Loading } from './ui.jsx';
import { clearQuote, fetchQuote, selectRewards } from '../features/rewards/rewardsSlice.js';
import { inr } from '../utils/format.js';

/**
 * Lets a customer choose how many reward points to use on one package. All numbers (balance, the largest allowed
 * redemption, the discount and the final amount) are returned by the backend quote endpoint; the browser only displays them.
 */
export default function CheckoutDialog({ pkg, onConfirm, onCancel, busy }) {
  const dispatch = useDispatch();
  const { quote } = useSelector(selectRewards);
  const [points, setPoints] = useState('');
  const pricePaise = pkg.pricing.pricePaise;

  useEffect(() => { dispatch(fetchQuote({ packageId: pkg._id })); return () => { dispatch(clearQuote()); }; }, [dispatch, pkg._id]);

  const info = quote.data;
  const wanted = Number(points) || 0;
  useEffect(() => {
    if (!wanted) return undefined;
    const t = setTimeout(() => dispatch(fetchQuote({ packageId: pkg._id, points: wanted })), 250);
    return () => clearTimeout(t);
  }, [dispatch, pkg._id, wanted]);

  // The quote with the chosen points: present only when the backend accepted that number.
  const priced = quote.status === 'ready' && info?.discountPaise && info.points === wanted ? info : null;
  const payable = priced ? priced.payablePaise : pricePaise;

  return (
    <div className="modal-back" role="presentation" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Checkout" onClick={(e) => e.stopPropagation()}>
        <h2>{pkg.name}</h2>
        {quote.status === 'loading' && !info && <Loading />}
        {info && (
          <>
            <p style={{ margin: '0 0 12px' }}>You have <strong>{info.balance} reward points</strong> ({inr(Math.floor((info.balance * info.paisePer100Points) / 100))} of value).</p>
            {info.maxPoints > 0 ? (
              <>
                <div className="field">
                  <label htmlFor="co-points">Points to use on this order</label>
                  <input id="co-points" type="number" min="0" max={info.maxPoints} step="1" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} placeholder={`Up to ${info.maxPoints}`} />
                  <p className="field-hint">Up to {info.maxPoints} points on this order (the discount on one order is capped at {inr(info.capPaise)}).</p>
                </div>
                <div className="cta-row" style={{ marginBottom: 12 }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPoints(String(info.maxPoints))}>Use the most I can</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPoints('')}>Don't use points</button>
                </div>
                <Alert>{quote.status === 'failed' && wanted ? quote.error?.message : null}</Alert>
              </>
            ) : (
              <p className="muted">{info.balance > 0 ? 'No points can be used on this package.' : 'Earn points by verifying your email, buying packages and completing consultations.'}</p>
            )}
            <dl className="kv" style={{ margin: '8px 0 16px' }}>
              <dt>Package price</dt><dd>{inr(pricePaise)}</dd>
              {priced && (<><dt>Points discount</dt><dd>− {inr(priced.discountPaise)} ({priced.points} points)</dd></>)}
              <dt><strong>You pay</strong></dt><dd><strong>{inr(payable)}</strong></dd>
            </dl>
          </>
        )}
        {quote.status === 'failed' && !info && <Alert>{quote.error?.message}</Alert>}
        <div className="cta-row">
          <button type="button" className="btn btn-primary" disabled={busy || (wanted > 0 && !priced)} onClick={() => onConfirm(priced ? priced.points : 0)}>
            {busy ? 'Opening payment…' : `Pay ${inr(payable)}`}
          </button>
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
