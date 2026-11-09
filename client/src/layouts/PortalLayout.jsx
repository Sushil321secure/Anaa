import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { STAFF_ROLES, logout, selectUser } from '../features/auth/authSlice.js';
import Icon from '../components/Icon.jsx';
import Logo from '../components/Logo.jsx';
import { ROLE_LABEL } from '../utils/format.js';

// Shared shell for the customer and admin portals: fixed sidebar on desktop, slide-in drawer on phones and tablets.
// `nav` items: { to, label, icon, end?, roles? } (roles limits who sees the link).
export default function PortalLayout({ title, nav }) {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const items = nav.filter((n) => !n.roles || n.roles.includes(user.role));
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const current = items.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));

  async function signOut() {
    await dispatch(logout());
    navigate('/');
  }

  return (
    <div className={`portal${open ? ' is-open' : ''}`}>
      <a className="skip-link" href="#portal-content">Skip to content</a>
      <aside className="portal-side" aria-label={title}>
        <Link to="/" className="brand" aria-label="Anaa Nutricare home"><Logo className="portal-logo" /></Link>
        <p className="portal-title">{title}</p>
        <nav aria-label={title}>
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <Icon name={n.icon} size={19} /> <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="portal-foot">
          <Link to="/" className="portal-site-link"><Icon name="arrow" size={16} /> Back to website</Link>
        </div>
      </aside>
      {open && <button type="button" className="portal-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}

      <div className="portal-main">
        <header className="portal-top">
          <button type="button" className="portal-burger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" size={22} /></button>
          <span className="portal-here">{current?.label || title}</span>
          <div className="portal-user">
            <Link to={STAFF_ROLES.includes(user.role) ? '/admin/profile' : '/portal/profile'} className="portal-user-link" aria-label="View my profile" title="View my profile">
              <span className="avatar" aria-hidden="true">{initials}</span>
              <span className="portal-user-text"><strong>{user.name}</strong><small>{ROLE_LABEL[user.role]} · View profile</small></span>
            </Link>
            <button type="button" className="btn btn-outline btn-sm" onClick={signOut}><Icon name="logout" size={16} /> <span className="hide-sm">Log out</span></button>
          </div>
        </header>
        <main id="portal-content" className="portal-content"><Outlet /></main>
      </div>
    </div>
  );
}
