import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtDate } from '@/lib/format';

interface Props {
  /** ISO timestamps of the events to count. */
  dates: string[];
  weeks?: number;
  /** Singular noun for the tooltip, e.g. "entry". */
  unit: [singular: string, plural: string];
  label: string;
}

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

/** Single-series weekly column chart with hover tooltips and a table fallback. */
export function ActivityChart({ dates, weeks = 12, unit, label }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [now] = useState(() => new Date());
  const [width, setWidth] = useState(600);
  const plotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [showTable]);

  const buckets = useMemo(() => {
    const first = startOfWeek(now);
    first.setDate(first.getDate() - 7 * (weeks - 1));
    const out = Array.from({ length: weeks }, (_, i) => {
      const start = new Date(first);
      start.setDate(first.getDate() + 7 * i);
      return { start, count: 0 };
    });
    for (const iso of dates) {
      const idx = Math.floor((startOfWeek(new Date(iso)).getTime() - first.getTime()) / (7 * 86_400_000) + 0.01);
      if (idx >= 0 && idx < weeks) out[idx].count++;
    }
    return out;
  }, [dates, weeks, now]);

  const max = Math.max(1, ...buckets.map((b) => b.count));
  // Round the axis top up to a friendly step, at most ~5 gridlines.
  const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : Math.ceil(max / 50) * 10;
  const top = Math.ceil(max / step) * step;
  // Measure the container so 1 SVG unit = 1px and text never scales.
  const W = Math.max(280, width);
  const H = 180;
  const padL = 28;
  const padB = 24;
  const padT = 12;
  const plotW = W - padL;
  const plotH = H - padB - padT;
  const band = plotW / weeks;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  // Label every week when there is room, otherwise every other one.
  const labelEvery = band >= 56 ? 1 : 2;
  const noun = (n: number) => (n === 1 ? unit[0] : unit[1]);
  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className="viz-root">
      <div className="viz-head">
        <div>
          <div className="viz-title">{label}</div>
          <div className="muted small">
            {total} {noun(total)} in the last {weeks} weeks
          </div>
        </div>
        <button className="btn btn-link small" onClick={() => setShowTable((s) => !s)} aria-pressed={showTable}>
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {showTable ? (
        <table className="table">
          <thead>
            <tr>
              <th>Week of</th>
              <th className="num">{unit[1][0].toUpperCase() + unit[1].slice(1)}</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.start.toISOString()}>
                <td>{fmtDate(b.start.toISOString())}</td>
                <td className="num">{b.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="viz-plot" ref={plotRef}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${total} ${noun(total)} over ${weeks} weeks`} onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="viz-grid" />
                <text x={padL - 8} y={y(t)} className="viz-axis" textAnchor="end" dominantBaseline="middle">
                  {t}
                </text>
              </g>
            ))}
            {buckets.map((b, i) => {
              const cx = padL + band * i + band / 2;
              const h = y(0) - y(b.count);
              const r = Math.min(4, h, barW / 2);
              const x0 = cx - barW / 2;
              const yTop = y(b.count);
              const path =
                b.count > 0
                  ? `M${x0},${y(0)} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${y(0)} Z`
                  : '';
              const showTick = (weeks - 1 - i) % labelEvery === 0;
              return (
                <g key={i}>
                  {path && <path d={path} className={`viz-bar ${hover === i ? 'is-hover' : ''}`} />}
                  {showTick && (
                    <text x={cx} y={H - 6} className="viz-axis" textAnchor="middle">
                      {b.start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </text>
                  )}
                  {/* Hit target spans the whole band, bigger than the mark. */}
                  <rect
                    x={padL + band * i}
                    y={padT}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={0}
                    aria-label={`Week of ${fmtDate(b.start.toISOString())}: ${b.count} ${noun(b.count)}`}
                  />
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div
              className="viz-tooltip"
              style={{
                left: `${((padL + band * hover + band / 2) / W) * 100}%`,
                top: `${(y(buckets[hover].count) / H) * 100}%`,
              }}
            >
              <div className="muted small">Week of {fmtDate(buckets[hover].start.toISOString())}</div>
              <strong>
                {buckets[hover].count} {noun(buckets[hover].count)}
              </strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
