'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import styles from './media-monitoring.module.css';

type Tab = 'Ringkasan' | 'Berita & Postingan' | 'Media & Akun' | 'Pencarian' | 'Analitik' | 'Peta & Relasi' | 'Tren';
type ContentRecord = {
  id: string; title: string; publisher: string; type: string; platform: string; topic: string; sentiment: string;
  reach: string; engagement: string; date: string; location: string; language: string; excerpt: string; url?: string; video?: boolean;
};

const records: ContentRecord[] = [
  {
    id: 'MED-001', title: 'Pemkab Badung siapkan moda trem penghubung Kuta hingga Canggu', publisher: 'Portal Kabupaten Badung',
    type: 'Media Konvensional', platform: 'Media Online', topic: 'Kemacetan & Transportasi', sentiment: 'Neutral', reach: '24.8K',
    engagement: '1.2K', date: '02 Sep 2026', location: 'Kuta–Kuta Utara', language: 'Bahasa Indonesia',
    excerpt: 'Pemkab Badung dan PT KAI menyiapkan moda trem Bandara–Legian–Seminyak–Canggu sebagai solusi mobilitas Bali Selatan.',
    url: 'https://badungkab.go.id/index.php/kab/berita/74919-gandeng-pt-kai-pemkab-badung-siapkan-moda-trem-penghubung-kuta-hingga-canggu',
  },
  {
    id: 'MED-DEMO-002', title: 'Kemacetan koridor Kuta–Canggu pada jam pulang kerja', publisher: 'Warga Kuta', type: 'Social Media',
    platform: 'TikTok', topic: 'Kemacetan & Transportasi', sentiment: 'Negative', reach: '184K', engagement: '14.6K', date: '04 Okt 2026',
    location: 'Kuta Utara', language: 'Bahasa Indonesia', excerpt: 'Perjalanan yang biasanya 45 menit dilaporkan mencapai lebih dari dua jam.', video: true,
  },
  {
    id: 'MED-DEMO-003', title: 'Wisatawan membahas kebutuhan transportasi publik menuju Canggu', publisher: 'Bali Travel Forum',
    type: 'Social Media', platform: 'Instagram', topic: 'Kemacetan & Transportasi', sentiment: 'Negative', reach: '92K', engagement: '7.8K',
    date: '03 Okt 2026', location: 'Kuta Utara', language: 'English', excerpt: 'Diskusi wisatawan meningkat terkait waktu tempuh bandara menuju Canggu.',
  },
  {
    id: 'MED-DEMO-004', title: 'Sorotan kebersihan setelah akhir pekan di kawasan Pantai Kuta', publisher: 'Komunitas Kuta Bersih',
    type: 'Citizen / Owned Channel', platform: 'Portal Warga', topic: 'Sampah & Kebersihan', sentiment: 'Negative', reach: '18.3K',
    engagement: '2.1K', date: '04 Okt 2026', location: 'Kuta', language: 'Bahasa Indonesia', excerpt: 'Warga meminta jadwal pengangkutan sampah yang lebih rutin setelah akhir pekan.',
  },
];

const tabs: Tab[] = ['Ringkasan', 'Berita & Postingan', 'Media & Akun', 'Pencarian', 'Analitik', 'Peta & Relasi', 'Tren'];

export function MediaMonitoring({navigate}:{navigate:(target:'Topics'|'Findings')=>void}) {
  const [tab,setTab]=useState<Tab>('Ringkasan');
  const [selected,setSelected]=useState<ContentRecord|null>(null);
  const [query,setQuery]=useState('canggu macet');
  return <section className={styles.root}>
    <div className={styles.hero}><div><span>MEDIA INTELLIGENCE</span><h2>Media Monitoring</h2><p>Pantau isi percakapan, pihak yang mengamplifikasi, jangkauan, dan perubahan narasi dalam satu workspace.</p></div><div><small>MONITORED PUBLIC WEB</small><b>04 Agu–04 Okt 2026</b><em>Dataset demo terkurasi</em></div></div>
    <nav className={styles.tabs} aria-label="Media Monitoring tabs">{tabs.map(item=><button key={item} className={tab===item?styles.active:''} onClick={()=>setTab(item)}>{item}</button>)}</nav>
    {tab==='Ringkasan'&&<Summary open={setSelected} navigate={navigate}/>}
    {tab==='Berita & Postingan'&&<ContentExplorer open={setSelected}/>}
    {tab==='Media & Akun'&&<Publishers/>}
    {tab==='Pencarian'&&<Search query={query} setQuery={setQuery} open={setSelected}/>}
    {tab==='Analitik'&&<Analytics/>}
    {tab==='Peta & Relasi'&&<Relationships navigate={navigate}/>}
    {tab==='Tren'&&<Trends navigate={navigate}/>}
    {selected&&<ContentDetail record={selected} close={()=>setSelected(null)} navigate={navigate}/>}
  </section>;
}

function Metric({label,value,note}:{label:string;value:string;note:string}){return <article className={styles.metric}><small>{label}</small><strong>{value}</strong><span>{note}</span></article>}

function Summary({open,navigate}:{open:(record:ContentRecord)=>void;navigate:(target:'Topics'|'Findings')=>void}){
  return <><div className={styles.metrics}><Metric label="Konten Terpantau" value="42,680" note="+10.4% dari periode sebelumnya"/><Metric label="Media Konvensional" value="8,964" note="21% dari konten terpantau"/><Metric label="Social Media" value="29,876" note="70% dari konten terpantau"/><Metric label="Potensi Jangkauan" value="12.8M" note="Demo terkontrol"/><Metric label="Engagement" value="846K" note="Demo terkontrol"/></div>
    <div className={styles.summaryGrid}><section className={styles.panel}><div className={styles.title}><div><h3>Volume Media</h3><p>Media konvensional dan social media</p></div><span className={styles.legend}>● Social &nbsp; ● Conventional</span></div><div className={styles.volumeChart}>{[36,43,39,57,48,66,62,78,71,88,83,96].map((value,index)=><div key={index}><i style={{height:`${value}%`}}/><em style={{height:`${Math.max(18,value*.38)}%`}}/></div>)}</div><div className={styles.chartLabels}><span>04 Agu</span><span>19 Agu</span><span>03 Sep</span><span>18 Sep</span><span>04 Okt</span></div></section>
      <section className={styles.panel}><div className={styles.title}><div><h3>Top Issues</h3><p>Volume dan perubahan perhatian</p></div><button onClick={()=>navigate('Topics')}>Buka Isu Daerah →</button></div><div className={styles.ranking}>{[['Kemacetan & Transportasi','9,840','+24.6%'],['Sampah & Kebersihan','7,215','+18.2%'],['Jalan & Infrastruktur','6,482','+9.1%'],['Pariwisata','5,940','+12.4%']].map((item,index)=><div key={item[0]}><span>{index+1}</span><p><b>{item[0]}</b><small>{item[1]} percakapan</small></p><em>{item[2]}</em></div>)}</div></section></div>
    <div className={styles.three}><section className={styles.panel}><div className={styles.title}><div><h3>Emerging Narratives</h3><p>Pertumbuhan baru dan tidak biasa</p></div></div>{[['Transportasi massal Bali Selatan','Pertama 28 Sep','+186%'],['Jam puncak Kuta–Canggu','Pertama 01 Okt','+94%'],['Sampah pasca akhir pekan','Pertama 03 Okt','+71%']].map(item=><div className={styles.signal} key={item[0]}><i>↗</i><p><b>{item[0]}</b><small>{item[1]}</small></p><strong>{item[2]}</strong></div>)}</section>
      <section className={styles.panel}><div className={styles.title}><div><h3>Media Attention</h3><p>Isu dengan kenaikan liputan tajam</p></div></div>{[['Kemacetan & Transportasi',86],['Sampah & Kebersihan',64],['Pariwisata',49],['Infrastruktur',37]].map(item=><div className={styles.attention} key={item[0]}><p><span>{item[0]}</span><b>{item[1]}%</b></p><i><em style={{width:`${item[1]}%`}}/></i></div>)}</section>
      <section className={styles.panel}><div className={styles.title}><div><h3>Sentiment</h3><p>Semua konten terpantau</p></div></div><div className={styles.sentiment}><div><strong>58.7%</strong><span>Positif</span></div><p><span><i className={styles.positive}/>Positive <b>58.7%</b></span><span><i className={styles.neutral}/>Neutral <b>27.9%</b></span><span><i className={styles.negative}/>Negative <b>13.4%</b></span></p></div></section></div>
    <section className={styles.panel}><div className={styles.title}><div><h3>Konten Terbaru</h3><p>Media, postingan, dan owned channel dalam konteks yang sama</p></div><button onClick={()=>navigate('Findings')}>Lihat Findings →</button></div><ContentTable data={records} open={open}/></section></>;
}

function FilterBar(){return <div className={styles.filters}><label>Periode<select><option>04 Agu–04 Okt 2026</option></select></label><label>Media Type<select><option>Semua tipe</option><option>Social Media</option><option>Media Konvensional</option></select></label><label>Platform<select><option>Semua platform</option><option>TikTok</option><option>Media Online</option></select></label><label>Topic<select><option>Semua topik</option><option>Kemacetan & Transportasi</option></select></label><label>Sentiment<select><option>Semua sentimen</option><option>Negative</option></select></label><button>＋ Filter</button></div>}

function ContentExplorer({open}:{open:(record:ContentRecord)=>void}){return <><FilterBar/><section className={styles.panel}><div className={styles.title}><div><h3>Berita & Postingan</h3><p>Konten mentah lintas media dengan klasifikasi dan evidence</p></div><span className={styles.demo}>4 record contoh · 1 sumber resmi</span></div><ContentTable data={records} open={open}/></section></>}

function ContentTable({data,open}:{data:ContentRecord[];open:(record:ContentRecord)=>void}){return <div className={styles.tableWrap}><div className={`${styles.tableRow} ${styles.tableHead}`}><b>CONTENT</b><b>MEDIA / ACCOUNT</b><b>TYPE</b><b>TOPIC</b><b>SENTIMENT</b><b>REACH</b><b>ENGAGEMENT</b><b>DATE</b></div>{data.map(record=><button className={styles.tableRow} key={record.id} onClick={()=>open(record)}><span><strong>{record.title}</strong><small>{record.id} · {record.platform}</small></span><span>{record.publisher}</span><span>{record.type}</span><span>{record.topic}</span><span className={record.sentiment==='Negative'?styles.bad:record.sentiment==='Positive'?styles.good:styles.mid}>{record.sentiment}</span><span>{record.reach}</span><span>{record.engagement}</span><span>{record.date}</span></button>)}</div>}

function Publishers(){const publishers=[['Portal Kabupaten Badung','Media Online','186','2.8M','84K','Neutral'],['Warga Kuta','TikTok','74','1.9M','146K','Negative'],['Bali Travel Forum','Instagram','96','1.2M','98K','Neutral'],['Komunitas Kuta Bersih','Portal Warga','58','486K','32K','Positive']];return <><FilterBar/><div className={styles.publisherGrid}>{publishers.map((p,index)=><article className={styles.publisher} key={p[0]}><div><span>{p[0].split(' ').map(x=>x[0]).join('').slice(0,2)}</span><p><b>{p[0]}</b><small>{p[1]}</small></p></div><dl><div><dt>Content</dt><dd>{p[2]}</dd></div><div><dt>Reach</dt><dd>{p[3]}</dd></div><div><dt>Engagement</dt><dd>{p[4]}</dd></div><div><dt>Dominant sentiment</dt><dd>{p[5]}</dd></div></dl><div className={styles.topicMix}><span style={{width:`${72-index*9}%`}}/><em>Kemacetan · Pariwisata · Layanan publik</em></div><button>Lihat profil media / akun →</button></article>)}</div></>}

function Search({query,setQuery,open}:{query:string;setQuery:(value:string)=>void;open:(record:ContentRecord)=>void}){const found=useMemo(()=>records.filter(record=>`${record.title} ${record.excerpt} ${record.topic}`.toLowerCase().includes(query.toLowerCase().split(' ')[0]||'')),[query]);return <><section className={styles.searchPanel}><span>⌕</span><input value={query} onChange={event=>setQuery(event.target.value)} aria-label="Cari intelligence media"/><button>Cari Intelligence</button></section><FilterBar/><div className={styles.searchMeta}><p><b>{found.length} contoh hasil</b> untuk “{query}”</p><div><button>☆ Save Search</button><button>＋ Create Monitoring Rule</button></div></div><section className={styles.panel}><ContentTable data={found} open={open}/></section></>}

function Analytics(){return <><div className={styles.analyticsNav}>{['Conversation','Sentiment & Emotion','Engagement','Topic','Geography','Comparison'].map((x,i)=><button className={i===0?styles.selected:''} key={x}>{x}</button>)}</div><div className={styles.metrics}><Metric label="Mention Volume" value="42,680" note="+10.4%"/><Metric label="Share of Voice" value="38.6%" note="Top issue: transportasi"/><Metric label="Negative Sentiment" value="13.4%" note="+2.8 poin"/><Metric label="Engagement Rate" value="6.6%" note="Demo terkontrol"/><Metric label="Source Diversity" value="7" note="Kelompok sumber"/></div><div className={styles.summaryGrid}><section className={styles.panel}><div className={styles.title}><div><h3>Topic × Sentiment</h3><p>Distribusi sentimen pada isu utama</p></div></div>{[['Kemacetan',18,31,51],['Sampah',34,29,37],['Infrastruktur',48,36,16],['Pariwisata',69,24,7]].map(item=><div className={styles.stacked} key={item[0]}><span>{item[0]}</span><i><em style={{width:`${item[1]}%`}}/><b style={{width:`${item[2]}%`}}/><strong style={{width:`${item[3]}%`}}/></i></div>)}</section><section className={styles.panel}><div className={styles.title}><div><h3>Source Mix</h3><p>Porsi sumber percakapan</p></div></div><div className={styles.sourceMix}>{[['Social Media','70%'],['Media Konvensional','21%'],['Citizen / Owned','9%']].map(item=><p key={item[0]}><span>{item[0]}</span><b>{item[1]}</b></p>)}</div></section></div></>}

function Relationships({navigate}:{navigate:(target:'Topics'|'Findings')=>void}){return <div className={styles.relationshipGrid}><section className={styles.panel}><div className={styles.title}><div><h3>Network</h3><p>Pihak yang mengamplifikasi isu transportasi</p></div></div><div className={styles.network}><span className={styles.nodeMain}>Kemacetan<br/>Kuta–Canggu</span><span className={styles.nodeA}>Media lokal</span><span className={styles.nodeB}>Travel creators</span><span className={styles.nodeC}>Warga Kuta</span><span className={styles.nodeD}>Wisatawan</span></div></section><section className={styles.panel}><div className={styles.title}><div><h3>Entity & Narrative Relationship</h3><p>Relasi lokasi, aktor, organisasi, dan narasi</p></div></div><div className={styles.links}>{[['Kuta Utara','Kemacetan','Jam puncak'],['Wisatawan','Transportasi publik','Pengalaman destinasi'],['Pemkab Badung','Moda trem','Mobilitas Bali Selatan'],['Media lokal','Canggu','Overdevelopment']].map(item=><p key={item[0]}><b>{item[0]}</b><i>→</i><span>{item[1]}</span><i>→</i><em>{item[2]}</em></p>)}</div><div className={styles.actions}><button onClick={()=>navigate('Topics')}>View Related Issue</button><button onClick={()=>navigate('Findings')}>View Findings</button></div></section></div>}

function Trends({navigate}:{navigate:(target:'Topics'|'Findings')=>void}){return <><div className={styles.trendGrid}>{[['Rising Topics','Kemacetan & Transportasi','+24.6%'],['Rising Keywords','trem · macet · canggu','+186%'],['Rising Actors','Dishub · PT KAI','+78%'],['Rising Locations','Kuta Utara','+42%'],['Media Attention','Transportasi publik','+64%']].map((item,index)=><article key={item[0]}><small>{item[0]}</small><strong>{item[1]}</strong><span>↗ {item[2]}</span><i style={{width:`${82-index*8}%`}}/></article>)}</div><section className={styles.panel}><div className={styles.title}><div><h3>Emerging Narratives</h3><p>First detected, growth, source count, dan potential reach</p></div><button onClick={()=>navigate('Findings')}>Create / View Finding →</button></div><div className={styles.narratives}>{[['Transportasi massal menjadi kebutuhan mendesak Bali Selatan','28 Sep 2026','+186%','18 sources','1.8M'],['Kemacetan jam puncak memengaruhi pengalaman wisatawan','01 Okt 2026','+94%','12 sources','940K'],['Pertumbuhan Canggu dikaitkan dengan tekanan infrastruktur','02 Okt 2026','+81%','9 sources','610K']].map(item=><div key={item[0]}><strong>{item[0]}</strong><span>First detected {item[1]}</span><b>{item[2]}</b><em>{item[3]}</em><i>{item[4]} reach</i></div>)}</div></section></>}

function ContentDetail({record,close,navigate}:{record:ContentRecord;close:()=>void;navigate:(target:'Topics'|'Findings')=>void}){return <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="media-detail-title"><article className={styles.detail}><header><div><small>{record.id} · {record.type}</small><h2 id="media-detail-title">{record.title}</h2></div><button onClick={close}>×</button></header><div className={styles.detailGrid}><section>{record.video?<><Image src="/demo-kuta-traffic.svg" width={800} height={450} alt="Frame video demo kemacetan Kuta"/><span className={styles.videoTag}>VIDEO DEMO · 02:14–02:37</span></>:<div className={styles.articlePreview}><span>MEDIA EVIDENCE</span><b>{record.publisher}</b><p>{record.excerpt}</p></div>}<h3>Source & Evidence</h3><dl><div><dt>Publisher</dt><dd>{record.publisher}</dd></div><div><dt>Published</dt><dd>{record.date}</dd></div><div><dt>Location</dt><dd>{record.location}</dd></div><div><dt>Language</dt><dd>{record.language}</dd></div></dl>{record.url?<a href={record.url} target="_blank" rel="noreferrer">Buka sumber asli ↗</a>:<p className={styles.disclaimer}>Controlled demo record. Tidak diklaim sebagai sumber publik asli.</p>}</section><section><h3>Transcript / Content</h3><blockquote>{record.excerpt}</blockquote><h3>AI Analysis</h3><dl><div><dt>Topic</dt><dd>{record.topic}</dd></div><div><dt>Sentiment</dt><dd>{record.sentiment}</dd></div><div><dt>Reach</dt><dd>{record.reach}</dd></div><div><dt>Engagement</dt><dd>{record.engagement}</dd></div></dl><h3>Related Intelligence</h3><p>Konten ini mendukung cluster isu transportasi dan dapat ditambahkan sebagai evidence untuk Finding terpisah.</p><div className={styles.actions}><button onClick={()=>{close();navigate('Topics')}}>View Related Issue</button><button onClick={()=>{close();navigate('Findings')}}>Add as Evidence / Create Finding</button></div></section></div></article></div>}
