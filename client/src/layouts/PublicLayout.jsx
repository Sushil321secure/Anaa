import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { homeFor, logout, selectUser } from '../features/auth/authSlice.js';
import { contact, navItems, social } from '../content/site.js';
import Icon from '../components/Icon.jsx';
import Logo from '../components/Logo.jsx';
import SocialLinks from '../components/SocialLinks.jsx';
import MotionEffects from '../components/MotionEffects.jsx';

// Long labels get a short form on laptop widths (see .lbl-full / .lbl-short in the CSS).
function Label({ item }) {
  if (!item.short) return item.label;
  return (
    <>
      <span className="lbl-full">{item.label}</span>
      <span className="lbl-short" aria-hidden="true">{item.short}</span>
    </>
  );
}

function NavDropdown({ item, open, onToggle, onClose }) {
  const children = item.children();
  return (
    <div
      className={`dropdown ${open ? 'open' : ''}`}
      onMouseEnter={() => window.matchMedia('(hover: hover) and (min-width: 1280px)').matches && onToggle(true)}
      onMouseLeave={() => window.matchMedia('(hover: hover) and (min-width: 1280px)').matches && onClose()}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) onClose(); }}
    >
      <button type="button" aria-haspopup="true" aria-expanded={open} onClick={() => onToggle()}>
        <Label item={item} /> <Icon name="chevron" size={14} />
      </button>
      <ul>
        {children.map((c) => (
          <li key={c.label}><Link to={c.to} onClick={onClose}>{c.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

export default function PublicLayout() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();

  // New page: close menus; jump to the #section if there is one, otherwise to the top.
  useEffect(() => {
    setOpen(false);
    setOpenMenu(null);
    if (hash) {
      const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      return () => clearTimeout(t);
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); // a new page opens at the top at once, not with a long smooth scroll
  }, [pathname, hash]);

  return (
    <>
      <MotionEffects />
      <a className="skip-link" href="#content">Skip to content</a>
      <div className="topbar">
        <div className="container topbar-row">
          <p className="topbar-tag">
            <Icon name="leaf" size={20} />
            <span>{contact.tagline}</span><span className="sep" aria-hidden="true">|</span><span>{contact.motto}</span>
          </p>
          <ul className="topbar-info">
            <li><a href={contact.phoneHref}><Icon name="phone" size={17} /> {contact.phone}</a></li>
            <li className="hide-sm"><a href={`mailto:${contact.email}`}><Icon name="mail" size={17} /> {contact.email}</a></li>
            <li className="hide-md"><span><Icon name="pin" size={17} /> {contact.location}</span></li>
            <li className="hide-sm"><SocialLinks size="sm" /></li>
          </ul>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-row">
          <Link to="/" className="brand" aria-label="Anaa Nutricare home"><Logo /></Link>
          <button className="menu-btn" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen((o) => !o)}>
            <Icon name={open ? 'close' : 'menu'} size={20} /> <span>{open ? 'Close' : 'Menu'}</span>
          </button>
          <nav id="main-nav" className={`main-nav ${open ? 'open' : ''}`} aria-label="Main">
            <div className="nav-links">
              {navItems.map((item) =>
                item.children ? (
                  <NavDropdown
                    key={item.label}
                    item={item}
                    open={openMenu === item.label}
                    onToggle={(force) => setOpenMenu((m) => (force === true || m !== item.label ? item.label : null))}
                    onClose={() => setOpenMenu(null)}
                  />
                ) : (
                  <NavLink key={item.label} to={item.to} end={item.end}><Label item={item} /></NavLink>
                ),
              )}
            </div>
            <div className="nav-actions">
              {user ? (
                <>
                  <Link className="btn btn-outline" to={homeFor(user)}>My account</Link>
                  <button className="btn btn-ghost" onClick={async () => { await dispatch(logout()); navigate('/'); }}>Log out</button>
                </>
              ) : (
                <>
                  <Link className="btn btn-ghost" to="/login"><Icon name="user" size={20} /> <span className="btn-label">Login</span></Link>
                  <Link className="btn btn-outline" to="/register">Sign Up</Link>
                </>
              )}
              <Link className="btn btn-primary" to="/discovery-call">Enquire Now <Icon name="arrow" size={18} /></Link>
            </div>
          </nav>
        </div>
      </header>
      <main id="content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <Logo className="footer-logo" />
            <p className="muted">{contact.motto}</p>
            <SocialLinks size="lg" />
          </div>
          <nav aria-label="Footer">
            <h2>Explore</h2>
            {navItems.filter((n) => !n.children || n.label === 'Programs').map((l) => <Link key={l.label} to={l.to}>{l.label}</Link>)}
            <Link to="/log-and-earn">Log &amp; Earn</Link>
            <Link to="/faqs">FAQs</Link>
            <a href={social.youtube} target="_blank" rel="noopener noreferrer">Videos</a>
          </nav>
          <div>
            <h2>Contact</h2>
            <a href={contact.phoneHref}>{contact.phone}</a>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
            <address className="footer-address">{contact.address.map((line) => <span key={line}>{line}</span>)}</address>
          </div>
        </div>
        <p className="container footer-copy">© {new Date().getFullYear()} Anaa Nutricare. Nutrition guidance complements, and does not replace, medical advice.</p>
        <div className="footer-credit-bar">
          <a className="credit-badge" href="https://securelogicgroup.co/" target="_blank" rel="noopener noreferrer" aria-label="Designed and developed by Secure Logic (opens in a new tab)">
            <span className="credit-icon" aria-hidden="true"><Icon name="shield" size={18} /></span>
            <span className="credit-text">Designed &amp; developed by</span>
            <strong className="credit-name">Secure Logic</strong>
            <Icon name="arrow" size={16} />
          </a>
        </div>
      </footer>
    </>
  );
}
