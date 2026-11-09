import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const SLIDE_MS = 700;
const SWIPE_PX = 45;

// columns: [[minViewportWidth, cardsVisible], ...] from widest to narrowest, e.g. [[1100, 3], [700, 2]] (1 below).
function useVisibleCount(columns) {
  const get = () => (columns.find(([min]) => window.matchMedia(`(min-width: ${min}px)`).matches) || [0, 1])[1];
  const [count, setCount] = useState(get);
  useEffect(() => {
    const queries = columns.map(([min]) => window.matchMedia(`(min-width: ${min}px)`));
    const onChange = () => setCount(get());
    queries.forEach((q) => q.addEventListener('change', onChange));
    return () => queries.forEach((q) => q.removeEventListener('change', onChange));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.join('|')]);
  return count;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(q.matches);
    q.addEventListener('change', onChange);
    return () => q.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Horizontal, looping, auto-advancing slider shared by the testimonials and programmes sections.
 * Looping works by appending copies of the first `visible` items; after sliding onto them the track jumps back
 * to the real first item with the transition switched off, so there is no visible jump.
 * Autoplay pauses on hover, keyboard focus, touch, when off screen and when the tab is hidden, and is off for
 * visitors who prefer reduced motion. Swipe, arrow keys, previous/next buttons and dots are supported.
 */
export default function Slider({ items, getKey, renderItem, label, columns = [[1100, 3], [700, 2]], intervalMs = 4500, className = '' }) {
  const visible = useVisibleCount(columns);
  const reduced = useReducedMotion();

  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);
  const rootRef = useRef(null);
  const busy = useRef(false);
  const unlockTimer = useRef(0);
  const dragStart = useRef(null);

  const n = items.length;
  const canLoop = n > visible;
  const slides = canLoop ? [...items, ...items.slice(0, visible)] : items;
  const paused = hovered || focused || touching || !onScreen || tabHidden;
  const autoplay = canLoop && !reduced && !paused;

  // Keep the position valid when the number of visible cards or items changes.
  useEffect(() => {
    setAnimate(false);
    setIndex((i) => (n ? i % n : 0));
  }, [visible, n]);

  const lock = useCallback(() => {
    busy.current = true;
    clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => { busy.current = false; }, SLIDE_MS + 80);
  }, []);

  const move = useCallback((dir) => {
    if (!canLoop || busy.current) return;
    if (reduced) { // no sliding for reduced motion: change slide instantly
      setAnimate(false);
      setIndex((i) => (i + dir + n) % n);
      return;
    }
    lock();
    if (dir > 0) {
      setAnimate(true);
      setIndex((i) => i + 1);
    } else if (index === 0) { // backwards from the first item: jump to the copy, then slide back
      setAnimate(false);
      setIndex(n);
      requestAnimationFrame(() => requestAnimationFrame(() => { setAnimate(true); setIndex(n - 1); }));
    } else {
      setAnimate(true);
      setIndex((i) => i - 1);
    }
  }, [canLoop, reduced, n, index, lock]);

  const goTo = useCallback((k) => {
    if (!canLoop || busy.current) return;
    lock();
    setAnimate(!reduced);
    setIndex(k);
  }, [canLoop, reduced, lock]);

  // After sliding onto the copies, silently jump back to the real items.
  const onTransitionEnd = (e) => {
    if (e.target !== e.currentTarget) return;
    if (index >= n) { setAnimate(false); setIndex(index - n); }
  };

  // Autoplay. The latest `move` is read through a ref so the timer is not recreated every slide.
  const moveRef = useRef(move);
  moveRef.current = move;
  useEffect(() => {
    if (!autoplay) return undefined;
    const id = setInterval(() => moveRef.current(1), intervalMs);
    return () => clearInterval(id);
  }, [autoplay, intervalMs]);

  // Pause while the slider is off screen or the tab is in the background.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [n]);

  useEffect(() => () => clearTimeout(unlockTimer.current), []);

  // Swipe / drag. The move is decided as soon as the pointer has travelled far enough (not on release),
  // because browsers may cancel a touch gesture part-way through a horizontal swipe.
  const onPointerDown = (e) => { dragStart.current = e.clientX; setTouching(true); };
  const onPointerMove = (e) => {
    if (dragStart.current == null) return;
    const dx = e.clientX - dragStart.current;
    if (Math.abs(dx) > SWIPE_PX) { dragStart.current = null; move(dx < 0 ? 1 : -1); }
  };
  const endDrag = () => { dragStart.current = null; setTouching(false); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
  };

  if (n === 0) return null;
  const active = index % n;
  return (
    <div
      ref={rootRef}
      className={`slider ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      style={{ '--vis': visible }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}
    >
      <div
        className="slider-viewport"
        tabIndex={0}
        aria-label="Use the left and right arrow keys to change slide"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <ul
          className="slider-track"
          aria-live={autoplay ? 'off' : 'polite'}
          style={{ transform: `translateX(-${(index * 100) / visible}%)`, transition: animate && !reduced ? `transform ${SLIDE_MS}ms cubic-bezier(.45, .05, .25, 1)` : 'none' }}
          onTransitionEnd={onTransitionEnd}
        >
          {slides.map((item, i) => {
            const copy = i >= n;
            return (
              <li key={`${getKey(item)}-${copy ? 'copy' : 'real'}`} className="slider-slide" role="group" aria-roledescription="slide" aria-label={`${(i % n) + 1} of ${n}`} aria-hidden={copy || undefined}>
                {renderItem(item, copy)}
              </li>
            );
          })}
        </ul>
      </div>

      {canLoop && (
        <div className="slider-controls">
          <button type="button" className="slider-btn prev" onClick={() => move(-1)} aria-label="Previous slide"><Icon name="arrow" size={18} /></button>
          <div className="slider-dots">
            {items.map((item, k) => (
              <button key={getKey(item)} type="button" className={k === active ? 'on' : ''} onClick={() => goTo(k)} aria-label={`Show slide ${k + 1} of ${n}`} aria-current={k === active || undefined} />
            ))}
          </div>
          <button type="button" className="slider-btn next" onClick={() => move(1)} aria-label="Next slide"><Icon name="arrow" size={18} /></button>
        </div>
      )}
    </div>
  );
}
