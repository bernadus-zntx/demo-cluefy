'use client';

import {useMemo,useState} from 'react';
import {inConversationPeriod} from '../../lib/conversation-trend';
import {resolveDistrictLocation} from '../../lib/district-analysis';
import {useLiveIntelligence} from './LiveIntelligence';
import styles from './periodic-reports.module.css';

type Period='Daily'|'Weekly'|'Monthly';
const periods:Record<Period,number>={Daily:1,Weekly:7,Monthly:30};
const number=(value:number)=>new Intl.NumberFormat('id-ID').format(value);
export function PeriodicReports(){
  const {items,loading,error,generatedAt}=useLiveIntelligence();
  const [period,setPeriod]=useState<Period>('Daily');
  const [national,setNational]=useState('');
  const [openedAt]=useState(()=>Date.now());
  const parsedAt=generatedAt?Date.parse(generatedAt):NaN;
  const now=Number.isFinite(parsedAt)?parsedAt:openedAt;
  const rows=useMemo(()=>items.filter(item=>inConversationPeriod(item,periods[period],0,now)),[items,period,now]);
  const counts={Positive:0,Neutral:0,Negative:0,unknown:0};
  const topics=new Map<string,number>();const areas=new Map<string,number>();
  for(const item of rows){if(item.sentiment==='Positive'||item.sentiment==='Neutral'||item.sentiment==='Negative')counts[item.sentiment]++;else counts.unknown++;if(item.topic&&!/^belum (diklasifikasi|dianalisis)$/i.test(item.topic.trim()))topics.set(item.topic,(topics.get(item.topic)||0)+1);const area=resolveDistrictLocation(item).district||'Belum terpetakan';areas.set(area,(areas.get(area)||0)+1);}
  const top=[...topics].sort((a,b)=>b[1]-a[1]).slice(0,5);const places=[...areas].sort((a,b)=>b[1]-a[1]);
  const date=new Intl.DateTimeFormat('id-ID',{dateStyle:'full',timeStyle:'short',timeZone:'Asia/Makassar'}).format(new Date(now));
  const lines=[`CLUEFY ${period.toUpperCase()} REPORT`, `Dibuat: ${date} WITA`, `Periode: ${periods[period]} hari kalender terakhir (termasuk hari ini, WITA)`, `Percakapan: ${number(rows.length)}`, `Sentimen: ${number(counts.Positive)} positif · ${number(counts.Neutral)} netral · ${number(counts.Negative)} negatif · ${number(counts.unknown)} belum dianalisis`, '', 'TOPIK TERATAS', ...(top.length?top.map(([name,count])=>`${name}: ${number(count)}`):['Belum ada topik terklasifikasi.']), '', 'SEBARAN KECAMATAN', ...(places.length?places.map(([name,count])=>`${name}: ${number(count)}`):['Belum ada data.']), '', 'ISU NASIONAL DAN POTENSI DAMPAK DI BADUNG', national.trim()||'Belum tersedia. Perlu identifikasi dan verifikasi manual.', '', 'Sumber: data crawler ClueFy. Ringkasan memerlukan peninjauan; cakupan bergantung pada sumber terhubung.'];
  function download(){const blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`cluefy-${period.toLowerCase()}-${new Date(now).toISOString().slice(0,10)}.txt`;a.click();URL.revokeObjectURL(url)}
  return <section className={styles.root}><div className={styles.heading}><div><h2>Periodic Reporting</h2><p>Siapkan ringkasan dari data aktual yang tersedia.</p></div></div><div className={styles.tabs}>{(Object.keys(periods) as Period[]).map(value=><button key={value} className={period===value?styles.active:''} onClick={()=>setPeriod(value)}>{value} Report</button>)}</div><div className={styles.notice}>Periode memakai waktu Bali (WITA). Laporan dibuat saat diminta; penjadwalan dan pengiriman otomatis belum aktif.</div>{error&&<p role="alert">Data belum dapat dimuat: {error}</p>}{loading&&!items.length?<p>Memuat data laporan…</p>:<div className={styles.grid}><section className={styles.panel}><h3>{period} Report</h3><p>{periods[period]} hari kalender terakhir · termasuk hari ini</p><div className={styles.metrics}><div><small>Percakapan</small><b>{number(rows.length)}</b></div><div><small>Positif</small><b>{number(counts.Positive)}</b></div><div><small>Netral</small><b>{number(counts.Neutral)}</b></div><div><small>Negatif</small><b>{number(counts.Negative)}</b></div><div><small>Belum dianalisis</small><b>{number(counts.unknown)}</b></div></div><h4>Topik teratas</h4>{top.length?top.map(([name,count])=><div className={styles.row} key={name}><span>{name}</span><b>{number(count)}</b></div>):<p>Belum ada topik terklasifikasi.</p>}<h4>Sebaran kecamatan</h4>{places.length?places.map(([name,count])=><div className={styles.row} key={name}><span>{name}</span><b>{number(count)}</b></div>):<p>Belum ada data.</p>}</section><section className={styles.panel}><h3>Isu nasional dan dampak di Badung</h3><p>Identifikasi otomatis belum tersedia. Tambahkan catatan yang sudah diverifikasi untuk laporan ini.</p><label>Catatan isu nasional<textarea value={national} onChange={event=>setNational(event.target.value)} placeholder="Tuliskan isu, sumber, dan potensi dampaknya…" rows={8}/></label><p>Catatan hanya masuk ke laporan yang diunduh; belum disimpan atau dikirim otomatis.</p><button className={styles.download} onClick={download}>Unduh laporan (.txt)</button></section></div>}</section>;
}
