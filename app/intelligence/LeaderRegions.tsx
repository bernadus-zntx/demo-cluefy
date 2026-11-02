'use client';

import { useMemo, useState } from 'react';
import { analyzeDistricts } from '../../lib/district-analysis';
import type { LiveItem } from './LiveIntelligence';
import styles from './leader-regions.module.css';

export function LeaderRegions({items}:{items:LiveItem[]}) {
  const districts=useMemo(()=>analyzeDistricts(items),[items]);
  const [selected,setSelected]=useState('');
  const district=districts.find(row=>row.name===selected);
  const mapped=districts.reduce((sum,row)=>sum+row.total,0);
  return <section className={`card ${styles.root}`}><h3>Citra per Wilayah</h3><p>Sentimen percakapan terkait actor · 28 hari terakhir. Klik kecamatan untuk rincian desa/kelurahan.</p><div className={styles.tableWrap}><table><thead><tr><th>Kecamatan</th><th>Percakapan</th><th>Positif</th><th>Netral</th><th>Negatif</th><th>Belum dianalisis</th></tr></thead><tbody>{districts.map(row=><tr key={row.name}><th><button type="button" onClick={()=>setSelected(selected===row.name?'':row.name)} aria-expanded={selected===row.name}>{row.name} {selected===row.name?'▴':'▾'}</button></th><td>{row.total}</td><td>{row.positive}</td><td>{row.neutral}</td><td>{row.negative}</td><td>{row.unknown}</td></tr>)}</tbody></table></div>{district&&<div className={styles.detail}><h4>Desa / Kelurahan · {district.name}</h4><div className={styles.tableWrap}><table><thead><tr><th>Wilayah</th><th>Percakapan</th><th>Positif</th><th>Netral</th><th>Negatif</th><th>Belum dianalisis</th></tr></thead><tbody>{district.villages.map(row=><tr key={row.name}><th>{row.name}</th><td>{row.total}</td><td>{row.positive}</td><td>{row.neutral}</td><td>{row.negative}</td><td>{row.unknown}</td></tr>)}</tbody></table></div></div>}<small>{items.length-mapped} percakapan belum terpetakan ke kecamatan. Lokasi berasal dari metadata konten dan bukan lokasi identitas komentator.</small></section>;
}
