import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { fetchPublicProgram, selectRewards } from '../features/rewards/rewardsSlice.js';
import { inr } from '../utils/format.js';

/** Home page promotion. Renders only while the programme is switched on, and every figure comes from the admin's live settings. */
export default function LogEarnSection() {
  const dispatch = useDispatch();
  const { program } = useSelector(selectRewards);
  useEffect(() => { if (program.status === 'idle') dispatch(fetchPublicProgram()); }, [dispatch, program.status]);
  const p = program.data;
  if (!p?.enabled) return null;
  return (
    <section className="section logearn" aria-labelledby="logearn-title">
      <div className="container logearn-grid">
        <div>
          <p className="kicker">Log &amp; Earn</p>
          <h2 className="section-title" id="logearn-title">Look after your health, earn rewards</h2>
          <p className="lead">Earn points for the healthy steps you take with Anaa Nutricare and use them to save on your next wellness package.</p>
          <div className="cta-row">
            <Link className="btn btn-primary" to="/log-and-earn">How it works <Icon name="arrow" size={18} /></Link>
            <Link className="btn btn-outline" to="/register">Create a free account</Link>
          </div>
        </div>
        <ul className="logearn-list">
          {p.earn.map((r) => (
            <li key={r.key}><span className="earn-pts">+{r.points}</span><span>{r.label}</span></li>
          ))}
          <li><span className="earn-pts alt"><Icon name="gift" size={18} /></span><span>100 points = {inr(p.paisePer100Points)} off, up to {inr(p.maxDiscountPaise)} on each order</span></li>
        </ul>
      </div>
    </section>
  );
}
