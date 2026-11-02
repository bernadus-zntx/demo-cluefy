'use client';

import { useMemo, useState } from 'react';
import { summarizeLanguages } from '../../lib/language-analysis';
import { dominantSentiments } from '../../lib/district-analysis';
import { buildTrendForRange } from '../../lib/conversation-trend';
import { LiveDonut, LiveTrendChart } from './LiveOverviewCharts';
import type { LiveItem } from './LiveIntelligence';
import styles from './language-analysis.module.css';

const format = (value: number) => new Intl.NumberFormat('id-ID').format(value);
const percent = (value: number, total: number) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(total ? value / total * 100 : 0)}%`;

export function LiveLanguageAnalysis({ items, periodLabel, from, to, now }: { items: LiveItem[]; periodLabel: string; from: string; to: string; now: number }) {
  const languages = useMemo(() => summarizeLanguages(items), [items]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const selected = languages.find(item => item.key === selectedKey) || languages[0];
  const topic = selected?.concerns.some(item => item.name === selectedTopic) ? selectedTopic : null;
  const evidence = selected?.items.filter(item => !topic || item.topic === topic).slice(0, 5) || [];
  const known = languages.filter(item => item.key !== 'unknown');
  const unknown = languages.find(item => item.key === 'unknown')?.total || 0;
  const negative = items.filter(item => item.sentiment === 'Negative').length;
  return <>
    <div className={styles.banner}><span>LANGUAGE INTELLIGENCE</span><h2>Bahasa &amp; Isu Percakapan</h2><p>Bandingkan apa yang dibahas di setiap bahasa, temukan isu yang mendapat sentimen negatif, lalu telusuri percakapannya.</p></div>
    <div className="kpis"><div className="kpi"><small>Total percakapan</small><strong>{format(items.length)}</strong><p>{periodLabel} · sesuai filter</p></div><div className="kpi"><small>Bahasa terdeteksi</small><strong>{format(known.length)}</strong><p>berdasarkan metadata sumber</p></div><div className="kpi"><small>Bahasa belum diketahui</small><strong>{format(unknown)}</strong><p>tetap dihitung dalam total</p></div><div className="kpi"><small>Percakapan negatif</small><strong>{format(negative)}</strong><p>semua bahasa · sesuai filter</p></div></div>
    <div className={styles.layout}><section className="card"><h3>Bahasa Terpantau</h3><p className={styles.caption}>Pilih bahasa untuk melihat isu dan sentimennya.</p>
      <div className={styles.languageList}>{languages.map(language => {
        const dominant = dominantSentiments(language);
        const label = { positive: 'positif', neutral: 'netral', negative: 'negatif', unknown: 'belum dianalisis' };
        const dominantKey = dominant.length === 1 ? dominant[0].key : null;
        const ranked = [...language.concerns].sort((a, b) => dominantKey ? b[dominantKey] - a[dominantKey] || b.total - a.total || a.name.localeCompare(b.name, 'id') : b.total - a.total || a.name.localeCompare(b.name, 'id'));
        const topTopic = ranked[0] && (!dominantKey || ranked[0][dominantKey] > 0) ? ranked[0].name : 'Topik belum tersedia';
        return <button type="button" key={language.key} className={`${styles.languageRow} ${language.key === selected?.key ? styles.active : ''}`} aria-pressed={language.key === selected?.key} onClick={() => { setSelectedKey(language.key); setSelectedTopic(null); }}>
          <span><b>{language.label}</b><small>{format(language.total)} percakapan · {percent(language.total, items.length)}</small></span><span className={styles.languageStats}><b className={dominantKey ? styles[dominantKey] : styles.mixed}>{dominant.length ? `${percent(dominant[0].count, language.total)} ${dominant.map(item => label[item.key]).join(' / ')}` : 'Belum ada data'}</b><small>{topTopic}</small></span><i>→</i>
        </button>;
      })}</div>{!languages.length && <p className={styles.empty}>Belum ada percakapan sesuai filter.</p>}
    </section>
    <section className={`card ${styles.details}`} aria-live="polite">{selected ? <>
      <div className={styles.detailHead}><div><span>ANALISIS BAHASA</span><h3>{selected.label}</h3><p>{format(selected.total)} percakapan · {periodLabel}</p></div><strong>{percent(selected.total, items.length)}</strong></div>
      <div className={styles.concern}><small>ISU PERLU PERHATIAN</small>{selected.concerns[0]?.negative ? <><b>{selected.concerns[0].name}</b><p>{format(selected.concerns[0].negative)} percakapan negatif dari {format(selected.concerns[0].total)} percakapan pada topik ini.</p></> : <><b>Belum ada isu negatif terklasifikasi</b><p>{selected.concerns[0] ? `Topik terbanyak: ${selected.concerns[0].name} (${format(selected.concerns[0].total)} percakapan).` : 'Topik belum tersedia untuk bahasa ini.'}</p></>}</div>
      <h4>Sentimen Percakapan</h4><LiveDonut positive={selected.positive} neutral={selected.neutral} negative={selected.negative} unknown={selected.unknown} periodLabel={periodLabel}/>
      <h4>Isu per Topik</h4><p className={styles.caption}>Diurutkan berdasarkan jumlah percakapan negatif, lalu volume. Klik topik untuk melihat sumbernya.</p>
      <div className={styles.topics}>{selected.concerns.map(item => <button type="button" key={item.name} className={topic === item.name ? styles.topicActive : ''} aria-pressed={topic === item.name} onClick={() => setSelectedTopic(topic === item.name ? null : item.name)}><span className={styles.topicHeading}><b>{item.name}</b><span>{format(item.total)} percakapan</span></span><span className={styles.topicCounts}><span>Negatif <b>{format(item.negative)}</b></span><span>Netral <b>{format(item.neutral)}</b></span><span>Positif <b>{format(item.positive)}</b></span><span>Belum dianalisis <b>{format(item.unknown)}</b></span></span></button>)}</div>
      {!selected.concerns.length && <p className={styles.empty}>Topik belum diklasifikasi untuk bahasa ini.</p>}
      <h4>Percakapan Terbaru{topic ? ` · ${topic}` : ''}</h4><p className={styles.caption}>Maksimal lima sumber terbaru sesuai pilihan.</p>
      <div className={styles.evidence}>{evidence.map(item => <div key={item.id}>{/^https?:\/\//i.test(item.canonicalUrl || item.url || '') ? <a href={item.canonicalUrl || item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a> : <b>{item.title}</b>}<small>{item.publisher || item.source} · {item.sentiment || 'Belum dianalisis'}</small></div>)}</div>
    </> : <p className={styles.empty}>Pilih bahasa untuk melihat rinciannya.</p>}</section></div>
    {selected && <section className={`card ${styles.trend}`}><h3>Tren {selected.label}</h3><p className={styles.caption}>Arahkan kursor ke titik untuk melihat total dan sentimen pada tanggal tersebut.</p><LiveTrendChart data={buildTrendForRange(selected.items, from, to, now)} label={`Tren percakapan ${selected.label}`} /></section>}
    <div className="insight-note"><span>i</span><div><b>Tentang analisis ini</b><p>Bahasa, topik, dan sentimen berasal dari metadata konten yang tersedia. Bahasa tidak menunjukkan kewarganegaraan penulis. Data yang belum terklasifikasi tidak dihitung sebagai isu negatif.</p></div></div>
  </>;
}
