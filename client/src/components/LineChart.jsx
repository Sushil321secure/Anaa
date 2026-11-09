import { fmtDate } from '../utils/format.js';

// Dependency-free responsive SVG line chart. points: [{ x: dateString, y: number }] sorted by date.
export default function LineChart({ points, unit = '', label }) {
  if (points.length === 0) return null;
  const W = 640;
  const H = 260;
  const m = { l: 46, r: 16, t: 14, b: 34 };
  const ys = points.map((p) => p.y);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15;
  lo -= pad;
  hi += pad;
  const t0 = new Date(points[0].x).getTime();
  const t1 = new Date(points[points.length - 1].x).getTime();
  const sx = (x) => (t1 === t0 ? (W + m.l - m.r) / 2 : m.l + ((new Date(x).getTime() - t0) / (t1 - t0)) * (W - m.l - m.r));
  const sy = (y) => m.t + (1 - (y - lo) / (hi - lo)) * (H - m.t - m.b);
  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={m.l} x2={W - m.r} y1={sy(t)} y2={sy(t)} />
          <text x={m.l - 8} y={sy(t) + 4} textAnchor="end">{t.toFixed(1)}</text>
        </g>
      ))}
      {points.length > 1 && <path className="line" d={path} />}
      {points.map((p) => (
        <circle key={p.x} className="dot" cx={sx(p.x)} cy={sy(p.y)} r="4.5"><title>{`${fmtDate(p.x)}: ${p.y}${unit}`}</title></circle>
      ))}
      <text x={m.l} y={H - 8} textAnchor="start">{fmtDate(points[0].x, { year: '2-digit' })}</text>
      {points.length > 1 && <text x={W - m.r} y={H - 8} textAnchor="end">{fmtDate(points[points.length - 1].x, { year: '2-digit' })}</text>}
    </svg>
  );
}
