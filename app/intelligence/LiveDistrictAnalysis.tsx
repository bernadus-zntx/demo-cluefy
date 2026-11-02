'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { analyzeDistricts, type LocationCounts } from '../../lib/district-analysis';
import { buildTrendForRange } from '../../lib/conversation-trend';
import { LiveTrendChart } from './LiveOverviewCharts';
import type { LiveItem } from './LiveIntelligence';
import styles from './district-analysis.module.css';

const number = (value: number) => new Intl.NumberFormat('id-ID').format(value);
const percent = (value: number, total: number) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(total ? value / total * 100 : 0)}%`;
const segments = [
  { key: 'positive', label: 'Positif', color: '#24938c' },
  { key: 'neutral', label: 'Netral', color: '#b4e84b' },
  { key: 'negative', label: 'Negatif', color: '#ed7a6e' },
  { key: 'unknown', label: 'Belum dianalisis', color: '#d7e0df' },
] as const;
const describe = (name: string, counts: LocationCounts) => `${name}: ${number(counts.total)} percakapan; ${segments.map(segment => `${segment.label} ${number(counts[segment.key])}`).join(', ')}`;

function Breakdown({ counts }: { counts: LocationCounts }) {
  return <div className={styles.breakdown}>{segments.map(segment => <div key={segment.key}>
    <i style={{ background: segment.color }} /><span>{segment.label}</span><b>{number(counts[segment.key])}</b><small>{percent(counts[segment.key], counts.total)}</small>
  </div>)}</div>;
}

function SentimentBar({ name, counts, scale = 1, onOpen }: { name: string; counts: LocationCounts; scale?: number; onOpen?: () => void }) {
  const [active, setActive] = useState(false);
  const id = useId();
  return <div className={styles.barWrap} onPointerLeave={() => setActive(false)}>
    <button type="button" className={styles.barButton} aria-label={describe(name, counts)} aria-describedby={active ? id : undefined}
      onPointerEnter={() => setActive(true)} onFocus={() => setActive(true)} onBlur={() => setActive(false)}
      onKeyDown={event => { if (event.key === 'Escape') setActive(false); }} onClick={() => { setActive(true); onOpen?.(); }}>
      <span className={styles.track}><span className={styles.stacked} style={{ width: `${scale * 100}%` }}>{segments.map(segment => <i key={segment.key} style={{ background: segment.color, width: `${counts.total ? counts[segment.key] / counts.total * 100 : 0}%` }} />)}</span></span>
    </button>
    {active && <div role="tooltip" id={id} className={styles.tooltip}><b>{name}</b><p>Total <strong>{number(counts.total)}</strong> percakapan</p><Breakdown counts={counts} />{onOpen && <small>Klik untuk detail desa/kelurahan</small>}</div>}
  </div>;
}

export function LiveDistrictAnalysis({ items, periodLabel, from, to, now }: { items: LiveItem[]; periodLabel: string; from: string; to: string; now: number }) {
  const districts = useMemo(() => analyzeDistricts(items), [items]);
  const [selected, setSelected] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const detail = districts.find(district => district.name === selected);
  const total = districts.reduce((sum, district) => sum + district.total, 0);
  const max = Math.max(1, ...districts.map(district => district.total));
  useEffect(() => {
    if (!selected) return;
    dialog.current?.showModal();
    const prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prior; };
  }, [selected]);
  const close = () => dialog.current?.close();
  return <>
    <div className="section-intro"><h2>Analisis Kecamatan</h2><p>Telusuri volume, sentimen, dan desa/kelurahan sesuai filter Overview.</p></div>
    <section className={`card ${styles.summary}`}>
      <div className="card-title"><div><h3>Sebaran Percakapan Kabupaten Badung</h3><p>{number(total)} percakapan terpetakan · {periodLabel}</p></div></div>
      <div className={styles.legend}>{segments.map(segment => <span key={segment.key}><i style={{ background: segment.color }} />{segment.label}</span>)}</div>
      <div className={styles.districtRows}>{districts.map(district => <div className={styles.districtRow} key={district.name}>
        <button className={styles.nameButton} type="button" onClick={() => setSelected(district.name)}>{district.name}</button>
        <SentimentBar name={district.name} counts={district} scale={district.total / max} onOpen={() => setSelected(district.name)} />
        <button type="button" className={styles.countButton} aria-label={`Buka ${district.name}, ${number(district.total)} percakapan`} onClick={() => setSelected(district.name)}>{number(district.total)} <span>→</span></button>
      </div>)}</div>
      <p className={styles.hint}>Arahkan kursor untuk rincian sentimen. Klik kecamatan untuk melihat desa/kelurahan.</p>
    </section>
    <div className={styles.cards}>{districts.map(district => <section className={`card ${styles.card}`} key={district.name}>
      <div className={styles.cardHead}><span className={styles.initials}>{district.name.split(' ').map(word => word[0]).join('')}</span><button type="button" className={styles.detailButton} onClick={() => setSelected(district.name)} aria-label={`Detail desa/kelurahan ${district.name}`}>Desa/kelurahan ↗</button></div>
      <h3><button type="button" className={styles.nameButton} onClick={() => setSelected(district.name)}>{district.name}</button></h3>
      <p className={styles.cardTotal}><strong>{number(district.total)}</strong> percakapan <span>· {periodLabel}</span></p>
      <div className={styles.topicList}><div className={styles.topicHeader}><b>3 topik teratas</b><span>Berdasarkan jumlah percakapan</span></div>{district.topTopics.map((topic, index) => <div className={styles.topicRow} key={topic.name}><span className={styles.topicRank}>{index + 1}</span><div><b>{topic.name}</b><small><span className={styles.positive}>● {number(topic.positive)} positif</span><span className={styles.neutral}>● {number(topic.neutral)} netral</span><span className={styles.negative}>● {number(topic.negative)} negatif</span>{topic.unknown > 0 && <span>● {number(topic.unknown)} belum dianalisis</span>}</small></div><strong>{number(topic.total)}</strong></div>)}{!district.topTopics.length && <p className={styles.hint}>Topik belum terklasifikasi untuk filter ini.</p>}</div>
      <div className={styles.metrics}><div><small>Butuh respons ⓘ</small><b title="Percakapan negatif atau severity High/Critical; setiap percakapan dihitung satu kali.">{number(district.needs)}</b></div></div>
      <p className={styles.chartCaption}>Tren volume · arahkan kursor ke grafik</p>
      <LiveTrendChart compact data={buildTrendForRange(district.items, from, to, now)} label={`Tren percakapan ${district.name}`} />
    </section>)}</div>
    <div className="insight-note"><span>i</span><div><b>Cakupan lokasi</b><p>{number(items.length - total)} percakapan belum dapat dipetakan ke kecamatan. Lokasi umum, ambigu, atau desa/kelurahan yang belum teridentifikasi tetap ditampilkan sebagai belum terpetakan.</p></div></div>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={headingId} onClose={() => setSelected(null)}>
      {detail && <div className={styles.dialogBody}>
        <div className={styles.dialogHead}><div><small>DETAIL KECAMATAN · {periodLabel}</small><h2 id={headingId}>{detail.name}</h2><p><strong>{number(detail.total)}</strong> percakapan · mengikuti seluruh filter Overview</p></div><button type="button" onClick={close} aria-label="Tutup detail kecamatan">×</button></div>
        <div className={styles.dialogSummary}><Breakdown counts={detail} /><div><b>{number(detail.total - (detail.villages.find(village => village.name === 'Belum terpetakan')?.total || 0))}</b><span>percakapan terpetakan ke desa/kelurahan</span></div></div>
        <h3 className={styles.tableTitle}>Rincian per Desa/Kelurahan</h3>
        <p className={styles.hint}>Setiap kolom menampilkan jumlah, persentase, dan topik terbanyak untuk sentimen tersebut. Persentase dihitung dari total percakapan wilayah.</p>
        <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th scope="col">Desa / Kelurahan</th><th scope="col">Total</th>{segments.map(segment => <th scope="col" key={segment.key}><i style={{ background: segment.color }} />{segment.label}</th>)}</tr></thead>
          <tbody>{detail.villages.map(village => <tr key={village.name} className={village.name === 'Belum terpetakan' ? styles.unknownRow : ''}><th scope="row">{village.name}</th><td><strong>{number(village.total)}</strong></td>{segments.map(segment => <td key={segment.key}>{number(village[segment.key])}<small>{percent(village[segment.key], village.total)}</small>{segment.key !== 'unknown' && <small className={styles.villageTopic}>{village.topBySentiment[segment.key].length ? village.topBySentiment[segment.key].map(topic => `${topic.name} (${number(topic.count)})`).join(' · ') : 'Topik belum tersedia'}</small>}</td>)}</tr>)}</tbody>
          <tfoot><tr><th scope="row">Total {detail.name}</th><td>{number(detail.total)}</td>{segments.map(segment => <td key={segment.key}>{number(detail[segment.key])}</td>)}</tr></tfoot>
        </table></div>
        <p className={styles.mappingNote}>“Belum terpetakan” tetap masuk total kecamatan. Angka 0 berarti belum ada percakapan dalam filter ini, bukan tidak ada masalah di wilayah tersebut.</p>
      </div>}
    </dialog>
  </>;
}
