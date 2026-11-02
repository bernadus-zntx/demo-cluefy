'use client';

import { useId, useState } from 'react';
import { conversationDate, type DailyConversation, type SentimentCounts } from '../../lib/conversation-trend';
import styles from './live-overview-charts.module.css';

const number = (value: number) => new Intl.NumberFormat('id-ID').format(value);
const percent = (value: number, total: number) => total ? `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value / total * 100)}%` : '0%';
const segments = [
  { key: 'positive', label: 'Positif', color: '#24938c' },
  { key: 'neutral', label: 'Netral', color: '#b4e84b' },
  { key: 'negative', label: 'Negatif', color: '#ed7a6e' },
  { key: 'unknown', label: 'Belum dianalisis', color: '#d7e0df' },
] as const;
const dateLabel = (date: string, full = true) => new Intl.DateTimeFormat('id-ID', full
  ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' }
  : { day: 'numeric', month: 'short', timeZone: 'Asia/Makassar' }).format(new Date(`${date}T00:00:00+08:00`));
const bucketLabel = (day: DailyConversation) => day.endDate && day.endDate !== day.date ? `${dateLabel(day.date, false)} – ${dateLabel(day.endDate)}` : dateLabel(day.date);

function Breakdown({ counts, total }: { counts: SentimentCounts; total: number }) {
  return <div className={styles.breakdown}>{segments.map(segment => <div key={segment.key}>
    <i style={{ background: segment.color }} /><span>{segment.label}</span>
    <b>{number(counts[segment.key])}</b><small>{percent(counts[segment.key], total)}</small>
  </div>)}</div>;
}

export function LiveTrendChart({ data, compact = false, label = 'Tren percakapan sesuai filter, waktu Bali' }: { data: DailyConversation[]; compact?: boolean; label?: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const id = useId();
  const active = activeIndex === null ? null : data[activeIndex];
  const max = Math.max(1, ...data.map(day => day.total));
  const x = (index: number) => data.length === 1 ? 350 : 5 + index / Math.max(1, data.length - 1) * 690;
  const y = (value: number) => 165 - value / max * 135;
  const points = data.map((day, index) => `${x(index)},${y(day.total)}`).join(' ');
  const describe = (day: DailyConversation) => `${bucketLabel(day)}: ${number(day.total)} percakapan; ${segments.map(segment => `${segment.label} ${number(day[segment.key])}`).join(', ')}`;
  const ticks = [...new Set([0, .25, .5, .75, 1].map(ratio => Math.round(ratio * (data.length - 1))))].filter(index => data[index]);

  return <div className={`${styles.trend} ${compact ? styles.compact : ''}`}>
    <div className={styles.yLabels}><span>{number(max)}</span><span>{number(Math.round(max / 2))}</span><span>0</span></div>
    <div className={styles.plot} onPointerLeave={() => setActiveIndex(null)}>
      <svg className={styles.line} viewBox="0 0 700 175" preserveAspectRatio="none" role="group" aria-label={label}>
        <defs><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#24938c" stopOpacity=".24" /><stop offset="1" stopColor="#24938c" stopOpacity="0" /></linearGradient></defs>
        {[30, 75, 120, 165].map(value => <line key={value} x1="0" x2="700" y1={value} y2={value} stroke="#e9eeea" />)}
        {data.length > 1 && <polygon points={`5,165 ${points} 695,165`} fill={`url(#${id}-area)`} />}
        <polyline points={points} fill="none" stroke="#167f7a" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((day, index) => <circle key={day.date} cx={x(index)} cy={y(day.total)} r="3.5" fill="#fff" stroke="#167f7a" strokeWidth="2" pointerEvents="none" />)}
        {active && activeIndex !== null && <g pointerEvents="none"><line x1={x(activeIndex)} x2={x(activeIndex)} y1="0" y2="165" stroke="#73a8ad" strokeDasharray="4 4" /><circle cx={x(activeIndex)} cy={y(active.total)} r="6" fill="#167f7a" stroke="#fff" strokeWidth="2" /></g>}
        {data.map((day, index) => <circle key={day.date} className={styles.hitArea}
          cx={x(index)} cy={y(day.total)} r="7" fill="transparent" tabIndex={0} role="button"
          aria-label={describe(day)} aria-describedby={activeIndex === index ? `${id}-tooltip` : undefined}
          onPointerEnter={() => setActiveIndex(index)} onPointerLeave={() => setActiveIndex(null)}
          onClick={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}
          onKeyDown={event => { if (event.key === 'Escape') setActiveIndex(null); if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveIndex(index); } }} />)}
      </svg>
      {active && activeIndex !== null && <div id={`${id}-tooltip`} role="tooltip" className={`${styles.tooltip} ${styles.trendTooltip}`} style={{ left: `clamp(0px, calc(${x(activeIndex) / 7}% - 112px), max(0px, calc(100% - 224px)))` }}>
        <time dateTime={active.date}>{bucketLabel(active)}</time><small className={styles.timezone}>Waktu Bali · WITA</small>
        <div className={styles.tooltipTotal}><span>Total percakapan</span><strong>{number(active.total)}</strong></div>
        <Breakdown counts={active} total={active.total} />
      </div>}
      <div className={styles.xLabels}>{ticks.map(index => <span key={index}>{data[index].date === conversationDate() ? 'Hari ini' : dateLabel(data[index].date, false)}</span>)}</div>
    </div>
  </div>;
}

function arcPath(start: number, end: number) {
  const point = (radius: number, angle: number) => `${80 + radius * Math.cos((angle - 90) * Math.PI / 180)},${80 + radius * Math.sin((angle - 90) * Math.PI / 180)}`;
  if (end - start >= 359.999) return 'M80,4 A76,76 0 1 1 80,156 A76,76 0 1 1 80,4 M80,27 A53,53 0 1 0 80,133 A53,53 0 1 0 80,27 Z';
  const large = end - start > 180 ? 1 : 0;
  return `M${point(76, start)} A76,76 0 ${large} 1 ${point(76, end)} L${point(53, end)} A53,53 0 ${large} 0 ${point(53, start)} Z`;
}

export function LiveDonut({ periodLabel = '28 hari terakhir', ...counts }: SentimentCounts & { periodLabel?: string }) {
  const [activeKey, setActiveKey] = useState<keyof SentimentCounts | null>(null);
  const id = useId();
  const total = counts.positive + counts.neutral + counts.negative + counts.unknown;
  const active = segments.find(segment => segment.key === activeKey);
  const slices = segments.map((segment, index) => {
    const start = total ? segments.slice(0, index).reduce((sum, prior) => sum + counts[prior.key], 0) / total * 360 : 0;
    return { ...segment, start, end: start + (total ? counts[segment.key] / total * 360 : 0) };
  });
  return <div className={styles.sentiment} onPointerLeave={() => setActiveKey(null)}>
    <div className={styles.donutFrame}>
      <svg viewBox="0 0 160 160" role="group" aria-label="Distribusi sentimen percakapan" className={styles.donutSvg}>
        <circle cx="80" cy="80" r="64.5" fill="none" stroke="#edf1f0" strokeWidth="23" />
        {slices.filter(slice => counts[slice.key] > 0).map(slice => <path key={slice.key}
          d={arcPath(slice.start, slice.end)} fill={slice.color} className={styles.slice}
          opacity={active && active.key !== slice.key ? .45 : 1} tabIndex={0} role="button"
          aria-label={`${slice.label}: ${number(counts[slice.key])} percakapan, ${percent(counts[slice.key], total)}`}
          aria-describedby={activeKey === slice.key ? `${id}-tooltip` : undefined}
          onPointerEnter={() => setActiveKey(slice.key)} onClick={() => setActiveKey(slice.key)}
          onFocus={() => setActiveKey(slice.key)} onBlur={() => setActiveKey(null)}
          onKeyDown={event => { if (event.key === 'Escape') setActiveKey(null); if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveKey(slice.key); } }} />)}
      </svg>
      <div className={styles.donutCenter}><b>{number(active ? counts[active.key] : total)}</b><span>{active?.label ?? 'percakapan'}</span></div>
      {active && <div role="tooltip" id={`${id}-tooltip`} className={`${styles.tooltip} ${styles.donutTooltip}`}>
        <b>{active.label}</b><div className={styles.tooltipTotal}><strong>{number(counts[active.key])}</strong><span>percakapan</span><b>{percent(counts[active.key], total)}</b></div>
        <small>dari {number(total)} percakapan · {periodLabel}</small>
      </div>}
    </div>
    <div className={styles.legend} aria-label="Rincian sentimen">{segments.map(segment => <button type="button" key={segment.key}
      className={activeKey === segment.key ? styles.selected : ''} aria-describedby={activeKey === segment.key ? `${id}-tooltip` : undefined}
      onPointerEnter={() => setActiveKey(segment.key)} onFocus={() => setActiveKey(segment.key)}
      onBlur={() => setActiveKey(null)} onClick={() => setActiveKey(segment.key)} onKeyDown={event => { if (event.key === 'Escape') setActiveKey(null); }}>
      <i style={{ background: segment.color }} /><span>{segment.label}</span><div><b>{percent(counts[segment.key], total)}</b><small>{number(counts[segment.key])} percakapan</small></div>
    </button>)}</div>
  </div>;
}
