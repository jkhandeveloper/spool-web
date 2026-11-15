import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Point } from '@/lib/chart-utils';

/* Shared chart kit. Colors come from CSS tokens (--series-1..3, validated for
 * light and dark); text always uses text tokens, never the series color. */

const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

function useWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceScale(max: number) {
  const m = Math.max(1, max);
  const raw = m / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * pow).find((s) => s >= raw) ?? raw;
  const s = Math.max(1, Math.ceil(step));
  const top = Math.ceil(m / s) * s;
  return { top, ticks: Array.from({ length: top / s + 1 }, (_, i) => i * s) };
}

const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const longDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmt = (n: number) => n.toLocaleString();


function ChartFrame({ title, subtitle, legend, table, children }: { title: string; subtitle?: ReactNode; legend?: ReactNode; table: ReactNode; children: ReactNode }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div className="viz-root">
      <div className="viz-head">
        <div>
          <div className="viz-title">{title}</div>
          {subtitle && <div className="muted small">{subtitle}</div>}
        </div>
        <button className="btn btn-link small" onClick={() => setShowTable((s) => !s)} aria-pressed={showTable}>
          {showTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {legend && !showTable && legend}
      {showTable ? <div className="table-scroll">{table}</div> : children}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="legend" role="list">
      {items.map((it) => (
        <span key={it.label} className="legend-item" role="listitem">
          <span className="legend-swatch" style={{ background: it.color }} aria-hidden="true" />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- Line chart */

export interface SeriesDef {
  key: string;
  label: string;
}

export function LineChart({ title, subtitle, data, series, unit = 'day', height = 220 }: { title: string; subtitle?: ReactNode; data: Point[]; series: SeriesDef[]; unit?: 'day' | 'week'; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const colors = series.map((_, i) => SERIES_COLORS[i % SERIES_COLORS.length]);
  const max = Math.max(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key] ?? 0))));
  const { top, ticks } = niceScale(max);
  const padL = 36;
  const padR = series.length > 1 ? 92 : 16;
  const padT = 10;
  const padB = 24;
  const W = Math.max(280, width);
  const plotW = W - padL - padR;
  const plotH = height - padT - padB;
  const x = (i: number) => padL + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 70))));

  // Direct end labels, nudged apart so they never overlap.
  const ends = series
    .map((s, i) => ({ label: s.label, color: colors[i], y: y(Number(data[data.length - 1]?.[s.key] ?? 0)) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  const overflowBottom = (ends[ends.length - 1]?.y ?? 0) - (padT + plotH - 4);
  if (overflowBottom > 0) for (const e of ends) e.y -= overflowBottom;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - padL) / plotW) * (data.length - 1));
    setHover(i >= 0 && i < data.length ? i : null);
  }

  const table = (
    <table className="table">
      <thead>
        <tr>
          <th>{unit === 'week' ? 'Week of' : 'Day'}</th>
          {series.map((s) => (
            <th key={s.key} className="num">
              {s.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...data].reverse().map((d) => (
          <tr key={d.day}>
            <td>{longDate(d.day)}</td>
            {series.map((s) => (
              <td key={s.key} className="num">
                {fmt(Number(d[s.key] ?? 0))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame title={title} subtitle={subtitle} table={table} legend={series.length > 1 ? <Legend items={series.map((s, i) => ({ label: s.label, color: colors[i] }))} /> : undefined}>
      <div className="viz-plot" ref={ref}>
        <svg viewBox={`0 0 ${W} ${height}`} style={{ height }} role="img" aria-label={`${title}, ${data.length} ${unit}s`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="viz-grid" />
              <text x={padL - 8} y={y(t)} className="viz-axis" textAnchor="end" dominantBaseline="middle">
                {fmt(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            (data.length - 1 - i) % labelEvery === 0 ? (
              <text key={d.day} x={x(i)} y={height - 6} className="viz-axis" textAnchor={i === data.length - 1 ? 'end' : 'middle'}>
                {shortDate(d.day)}
              </text>
            ) : null,
          )}
          {series.length === 1 && (
            <path
              d={`M${x(0)},${y(0)} ${data.map((d, i) => `L${x(i)},${y(Number(d[series[0].key] ?? 0))}`).join(' ')} L${x(data.length - 1)},${y(0)} Z`}
              fill={colors[0]}
              opacity={0.12}
            />
          )}
          {series.map((s, si) => (
            <path
              key={s.key}
              d={data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(Number(d[s.key] ?? 0))}`).join(' ')}
              fill="none"
              stroke={colors[si]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {series.length > 1 &&
            ends.map((e) => (
              <text key={e.label} x={W - padR + 8} y={e.y} className="viz-label" dominantBaseline="middle">
                {e.label}
              </text>
            ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + plotH} className="viz-crosshair" />
              {series.map((s, si) => (
                <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key] ?? 0))} r={4} fill={colors[si]} stroke="var(--bg)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className="viz-tooltip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(padT / height) * 100}%`, transform: `translate(${x(hover) > W * 0.7 ? 'calc(-100% - 12px)' : '12px'}, 0)` }}>
            <div className="muted small">{unit === 'week' ? `Week of ${longDate(data[hover].day)}` : longDate(data[hover].day)}</div>
            {series.map((s, si) => (
              <div key={s.key} className="tt-row">
                <span className="legend-swatch" style={{ background: colors[si] }} aria-hidden="true" />
                <span>{s.label}</span>
                <strong>{fmt(Number(data[hover][s.key] ?? 0))}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

/* ----------------------------------------------------------- Column chart */

export function ColumnChart({ title, subtitle, data, valueKey, valueLabel, unit = 'day', height = 200 }: { title: string; subtitle?: ReactNode; data: Point[]; valueKey: string; valueLabel: string; unit?: 'day' | 'week'; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const values = data.map((d) => Number(d[valueKey] ?? 0));
  const { top, ticks } = niceScale(Math.max(0, ...values));
  const padL = 36;
  const padB = 24;
  const padT = 10;
  const W = Math.max(280, width);
  const plotW = W - padL - 8;
  const plotH = height - padT - padB;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 70))));

  const table = (
    <table className="table">
      <thead>
        <tr>
          <th>{unit === 'week' ? 'Week of' : 'Day'}</th>
          <th className="num">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {[...data].reverse().map((d) => (
          <tr key={d.day}>
            <td>{longDate(d.day)}</td>
            <td className="num">{fmt(Number(d[valueKey] ?? 0))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartFrame title={title} subtitle={subtitle} table={table}>
      <div className="viz-plot" ref={ref}>
        <svg viewBox={`0 0 ${W} ${height}`} style={{ height }} role="img" aria-label={`${title}: ${fmt(values.reduce((a, b) => a + b, 0))} total`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} className="viz-grid" />
              <text x={padL - 8} y={y(t)} className="viz-axis" textAnchor="end" dominantBaseline="middle">
                {fmt(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const v = values[i];
            const cx = padL + band * i + band / 2;
            const x0 = cx - barW / 2;
            const yt = y(v);
            const r = Math.min(4, barW / 2, y(0) - yt);
            return (
              <g key={d.day}>
                {v > 0 && (
                  <path
                    d={`M${x0},${y(0)} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x0 + barW - r} Q${x0 + barW},${yt} ${x0 + barW},${yt + r} V${y(0)} Z`}
                    className={`viz-bar ${hover === i ? 'is-hover' : ''}`}
                  />
                )}
                {(data.length - 1 - i) % labelEvery === 0 && (
                  <text x={cx} y={height - 6} className="viz-axis" textAnchor="middle">
                    {shortDate(d.day)}
                  </text>
                )}
                <rect x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div className="viz-tooltip" style={{ left: `${((padL + band * hover + band / 2) / W) * 100}%`, top: `${(y(values[hover]) / height) * 100}%` }}>
            <div className="muted small">{unit === 'week' ? `Week of ${longDate(data[hover].day)}` : longDate(data[hover].day)}</div>
            <strong>
              {fmt(values[hover])} {valueLabel.toLowerCase()}
            </strong>
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

/* ---------------------------------------------------- Horizontal bar list */

export function BarList({ items, total, empty = 'No data yet', format = fmt }: { items: { label: string; value: number; hint?: string }[]; total?: number; empty?: string; format?: (n: number) => string }) {
  if (!items.length || items.every((i) => i.value === 0)) return <p className="muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="barlist">
      {items.map((it) => (
        <li key={it.label}>
          <div className="barlist-head">
            <span>{it.label}</span>
            <span className="barlist-value">
              {format(it.value)}
              {total ? <span className="muted"> · {Math.round((it.value / total) * 100)}%</span> : null}
              {it.hint ? <span className="muted"> · {it.hint}</span> : null}
            </span>
          </div>
          <div className="barlist-track" aria-hidden="true">
            <div className="barlist-fill" style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------- Heatmap */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** 7×24 grid (isoWeekday × hour). Sequential single hue, darker = more. */
export function Heatmap({ grid }: { grid: number[][] }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...grid.flat());
  const total = grid.flat().reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="muted">No activity in this period.</p>;
  const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });
  return (
    <div className="heatmap-wrap">
      <div className="heatmap" role="grid" aria-label="Activity by weekday and hour" onMouseLeave={() => setHover(null)}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="heatmap-hour muted" aria-hidden="true">
            {h % 3 === 0 ? hourLabel(h) : ''}
          </div>
        ))}
        {grid.map((row, d) => (
          <div key={d} className="heatmap-row" role="row">
            <div className="heatmap-day muted">{WEEKDAYS[d]}</div>
            {row.map((v, h) => (
              <div
                key={h}
                role="gridcell"
                tabIndex={0}
                aria-label={`${WEEKDAYS[d]} ${hourLabel(h)}: ${v} actions`}
                className={`heatmap-cell ${hover?.d === d && hover?.h === h ? 'is-hover' : ''}`}
                style={{ '--level': v === 0 ? 0 : 12 + (v / max) * 88 } as React.CSSProperties}
                onMouseEnter={() => setHover({ d, h })}
                onFocus={() => setHover({ d, h })}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap-foot">
        <span className="muted small" aria-live="polite">
          {hover ? (
            <>
              <strong>{WEEKDAYS[hover.d]}</strong> {hourLabel(hover.h)}–{hourLabel((hover.h + 1) % 24)}: <strong>{fmt(grid[hover.d][hover.h])}</strong> actions
            </>
          ) : (
            'Hover a cell for details'
          )}
        </span>
        <span className="heatmap-scale muted small">
          Less
          {[0, 25, 50, 75, 100].map((l) => (
            <span key={l} className="heatmap-cell" style={{ '--level': l === 0 ? 0 : 12 + l * 0.88 } as React.CSSProperties} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- KPI tiles */

export function Kpi({ label, value, change, hint, invert }: { label: string; value: ReactNode; change?: number | null; hint?: ReactNode; invert?: boolean }) {
  let delta: ReactNode = null;
  if (change !== undefined) {
    if (change === null) delta = <span className="delta muted">New</span>;
    else if (change === 0) delta = <span className="delta muted">No change</span>;
    else {
      const good = invert ? change < 0 : change > 0;
      delta = (
        <span className={`delta ${good ? 'delta-good' : 'delta-bad'}`}>
          <span aria-hidden="true">{change > 0 ? '▲' : '▼'}</span> {Math.abs(change)}%
          <span className="sr-only">{change > 0 ? ' increase' : ' decrease'}</span>
        </span>
      );
    }
  }
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint">
        {delta}
        {delta && hint ? ' ' : null}
        {hint}
      </div>
    </div>
  );
}

export function RangePicker({ value, onChange, options = [7, 30, 90, 365] }: { value: number; onChange: (d: number) => void; options?: number[] }) {
  const label = (d: number) => (d === 365 ? '12 months' : `${d} days`);
  return (
    <div className="tabs" role="tablist" aria-label="Time range">
      {options.map((d) => (
        <button key={d} role="tab" aria-selected={value === d} className={`tab ${value === d ? 'is-active' : ''}`} onClick={() => onChange(d)}>
          {label(d)}
        </button>
      ))}
    </div>
  );
}
