'use client';

import { useId, useState } from 'react';
import { conversationDate } from '../../lib/conversation-trend';
import { defaultOverviewFilters, type OverviewFilters as Filters } from '../../lib/conversation-trend';
import styles from './overview-filters.module.css';

const sentiments = [{ value: 'Positive', label: 'Positif' }, { value: 'Neutral', label: 'Netral' }, { value: 'Negative', label: 'Negatif' }, { value: 'unknown', label: 'Belum dianalisis' }];
const flags: Record<string, string> = { Indonesia: '🇮🇩', Australia: '🇦🇺', Jepang: '🇯🇵', Jerman: '🇩🇪', Rusia: '🇷🇺', Ukraina: '🇺🇦', 'Amerika Serikat': '🇺🇸', 'Hong Kong': '🇭🇰', Inggris: '🇬🇧', Prancis: '🇫🇷', Singapura: '🇸🇬', Malaysia: '🇲🇾', Belanda: '🇳🇱', Kanada: '🇨🇦', India: '🇮🇳', China: '🇨🇳' };

export function OverviewFilterPanel({ value, onChange, topics, countries, periodLabel, count, valid, now }: {
  value: Filters; onChange: (value: Filters) => void; topics: string[]; countries: string[];
  periodLabel: string; count: number; valid: boolean; now: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const activeCount = Number(value.period !== '28') + Number(Boolean(value.topic)) + Number(Boolean(value.sentiment)) + Number(Boolean(value.country));
  const field = <K extends keyof Filters>(key: K, next: Filters[K]) => onChange({ ...value, [key]: next });
  const selectedSentiment = sentiments.find(item => item.value === value.sentiment)?.label;
  return <section className={styles.root} aria-label="Filter percakapan Overview">
    <div className={styles.toolbar}>
      <button type="button" className={styles.toggle} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>
        <span aria-hidden="true">☷</span> Filter Overview {activeCount > 0 && <b>{activeCount}</b>} <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
      </button>
      <div className={styles.summary}><span>{periodLabel}</span>{value.topic && <span>{value.topic}</span>}{selectedSentiment && <span>{selectedSentiment}</span>}{value.country && <span>{flags[value.country] || '🌐'} {value.country}</span>}</div>
      {activeCount > 0 && <button type="button" className={styles.reset} onClick={() => onChange(defaultOverviewFilters(now))}>Reset filter</button>}
      <small>{new Intl.NumberFormat('id-ID').format(count)} percakapan</small>
    </div>
    <div id={id} hidden={!expanded}>
      <div className={styles.fields}>
        <label>Waktu<select value={value.period} onChange={event => field('period', event.target.value as Filters['period'])}>
          <option value="7">7 hari terakhir</option><option value="14">14 hari terakhir</option><option value="28">28 hari terakhir</option><option value="90">90 hari terakhir</option><option value="all">Semua waktu</option><option value="custom">Rentang tanggal</option>
        </select></label>
        <label>Topik<select value={value.topic} onChange={event => field('topic', event.target.value)}><option value="">Semua topik</option>{topics.map(topic => <option key={topic}>{topic}</option>)}</select></label>
        <label>Sentimen<select value={value.sentiment} onChange={event => field('sentiment', event.target.value)}><option value="">Semua sentimen</option>{sentiments.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Negara<select value={value.country} onChange={event => field('country', event.target.value)}><option value="">Semua negara</option>{countries.map(country => <option key={country} value={country}>{flags[country] || '🌐'} {country}</option>)}</select></label>
      </div>
      {value.period === 'custom' && <div className={styles.dates}><label>Dari tanggal<input type="date" value={value.from} max={conversationDate(now)} onChange={event => field('from', event.target.value)} /></label><label>Sampai tanggal<input type="date" value={value.to} max={conversationDate(now)} onChange={event => field('to', event.target.value)} /></label></div>}
      {!valid && <p role="alert" className={styles.error}>Isi kedua tanggal; tanggal akhir harus sesudah atau sama dengan tanggal awal dan tidak melebihi hari ini.</p>}
      <p className={styles.hint}>Waktu Bali (WITA). Filter mengikuti percakapan, grafik, topik, kecamatan, dan bahasa. Ringkasan operasional Case dan Finding memakai antrean aktif.</p>
    </div>
  </section>;
}
