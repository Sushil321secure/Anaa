import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Elements that fade/slide in as they enter the viewport (staggered within their parent).
const REVEAL = [
  '.section .kicker', '.section-title', '.section > .container > .lead', '.section > .container > .note',
  '.feature', '.pill-grid li', '.steps li', '.check-list li', '.faq-list details', '.card:not(form)',
  '.cta-band-inner > *', '.program-strip', '.page-hero-art', '.page-hero .eyebrow', '.page-hero h1',
  '.page-hero .lead', '.page-hero .cta-row', '.page > h1', '.contact-list li', '.split > ul', '.split > ol',
].join(',');

// Elements that tilt toward the pointer (3D).
const TILT = '.feature, .program-card, .steps li, .card:not(form), .pill-grid li';

/**
 * Global motion layer: scroll reveal, 3D tilt, hero depth/parallax, scroll progress, header shadow.
 * Everything is opt-out for visitors who prefer reduced motion (the <html> "motion" class is only
 * set when motion is allowed, so content is never hidden without JS or when motion is off).
 */
export default function MotionEffects() {
  const { pathname } = useLocation();

  // Reveal + tilt: (re)scan the page after navigation and whenever new content (e.g. API data) is added.
  useEffect(() => {
    if (!document.documentElement.classList.contains('motion')) return undefined;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    const seen = new WeakSet(); // per observer: a remounted effect must observe elements again
    const prepare = () => {
      const counts = new Map();
      document.querySelectorAll(REVEAL).forEach((el) => {
        if (seen.has(el) || el.closest('.hero')) return;
        seen.add(el);
        const n = counts.get(el.parentElement) || 0;
        counts.set(el.parentElement, n + 1);
        if (!el.hasAttribute('data-reveal')) {
          el.setAttribute('data-reveal', '');
          el.style.setProperty('--d', `${Math.min(n * 80, 480)}ms`);
        }
        if (!el.classList.contains('in')) io.observe(el);
      });
      document.querySelectorAll(TILT).forEach((el) => el.setAttribute('data-tilt', ''));
    };
    prepare();
    let raf = 0;
    const mo = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(prepare); });
    mo.observe(document.getElementById('content') || document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); cancelAnimationFrame(raf); };
  }, [pathname]);

  // Scroll progress, header shadow, hero parallax, pointer tilt/depth.
  useEffect(() => {
    if (!document.documentElement.classList.contains('motion')) return undefined;
    const root = document.documentElement;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const max = root.scrollHeight - window.innerHeight;
        root.style.setProperty('--p', max > 0 ? String(Math.min(1, window.scrollY / max)) : '0');
        document.querySelector('.site-header')?.classList.toggle('scrolled', window.scrollY > 8);
        document.querySelector('.hero')?.style.setProperty('--py', `${Math.min(window.scrollY * 0.12, 90)}px`);
        ticking = false;
      });
    };

    let active = null;
    const reset = (el) => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.classList.remove('tilting'); };
    const onMove = (e) => {
      if (e.pointerType === 'touch') return;
      const el = e.target.closest?.('[data-tilt]');
      if (active && active !== el) reset(active);
      active = el || null;
      if (el) {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--rx', `${(-y * 9).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${(x * 11).toFixed(2)}deg`);
        el.classList.add('tilting');
      }
      const hero = document.querySelector('.hero');
      if (hero) {
        const r = hero.getBoundingClientRect();
        const inside = e.clientY >= r.top && e.clientY <= r.bottom;
        hero.style.setProperty('--mx', inside ? String(((e.clientX / window.innerWidth) * 2 - 1).toFixed(3)) : '0');
        hero.style.setProperty('--my', inside ? String((((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3)) : '0');
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('pointermove', onMove);
    };
  }, []);

  return <div className="scroll-progress" aria-hidden="true"><span /></div>;
}
