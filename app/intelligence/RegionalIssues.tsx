'use client';

import { useMemo, useState } from 'react';
import styles from './regional-issues.module.css';

type Topic = 'Kemacetan & Transportasi' | 'Sampah & Kebersihan' | 'Jalan & Infrastruktur' | 'Pariwisata' | 'Banjir & Drainase';
type Sentiment = 'Positive' | 'Neutral' | 'Negative';
type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

type Issue = {
  topic: Topic;
  volume: number;
  growth: number;
  severity: Severity;
  owner: string;
  districts: string[];
  keywords: string[];
  color: string;
};

type Conversation = {
  id: string;
  topic: Topic;
  author: string;
  account: string;
  media: string;
  sourceType: 'Social Media' | 'Media Online' | 'Citizen / Owned';
  district: string;
  sentiment: Sentiment;
  severity: Severity;
  publishedAt: string;
  publishedLabel: string;
  text: string;
  mentions: number;
};

const issues: Issue[] = [
  {topic:'Kemacetan & Transportasi',volume:9840,growth:24.6,severity:'Critical',owner:'Dishub · PT KAI',districts:['Kuta Utara','Kuta','Kuta Selatan'],keywords:['kemacetan','transportasi publik','trem','rekayasa lalu lintas'],color:'#167f7a'},
  {topic:'Sampah & Kebersihan',volume:7215,growth:18.2,severity:'High',owner:'DLHK · Komunitas',districts:['Kuta','Kuta Selatan'],keywords:['sampah pantai','jadwal angkut','tempat sampah','kebersihan'],color:'#8db52d'},
  {topic:'Jalan & Infrastruktur',volume:6482,growth:9.1,severity:'High',owner:'PUPR · Dishub',districts:['Mengwi','Abiansemal'],keywords:['jalan rusak','lampu jalan','trotoar','akses warga'],color:'#5e79b9'},
  {topic:'Pariwisata',volume:5940,growth:12.4,severity:'Medium',owner:'Dispar · Pelaku Usaha',districts:['Kuta Selatan','Kuta'],keywords:['wisatawan','destinasi','UMKM','layanan informasi'],color:'#bf8a35'},
  {topic:'Banjir & Drainase',volume:4206,growth:-2.8,severity:'High',owner:'PUPR · BPBD',districts:['Kuta Selatan','Mengwi'],keywords:['drainase','genangan','hujan deras','normalisasi'],color:'#a45c72'},
];

const conversations: Conversation[] = [
  {id:'ISU-001',topic:'Kemacetan & Transportasi',author:'Emily Carter',account:'@emilytravels.demo',media:'Instagram',sourceType:'Social Media',district:'Kuta Utara',sentiment:'Negative',severity:'Critical',publishedAt:'2026-10-04',publishedLabel:'04 Okt 2026 · 09:00',text:'Traffic from the airport to Canggu took almost three hours. Better public transport would really help.',mentions:1280},
  {id:'ISU-002',topic:'Kemacetan & Transportasi',author:'Pemkab Badung',account:'Portal Kabupaten Badung',media:'Media Online Lokal',sourceType:'Media Online',district:'Kuta Utara',sentiment:'Neutral',severity:'High',publishedAt:'2026-09-02',publishedLabel:'02 Sep 2026 · 15:04',text:'Pemkab Badung dan PT KAI menyiapkan moda trem Bandara–Legian–Seminyak–Canggu sebagai solusi mobilitas Bali Selatan.',mentions:2260},
  {id:'ISU-003',topic:'Kemacetan & Transportasi',author:'Warga Seminyak',account:'Forum Warga Seminyak',media:'Facebook',sourceType:'Social Media',district:'Kuta',sentiment:'Negative',severity:'High',publishedAt:'2026-08-22',publishedLabel:'22 Agu 2026 · 18:15',text:'Antrean kendaraan menuju Seminyak mulai padat sejak sore. Perlu pengaturan simpang yang lebih konsisten.',mentions:940},
  {id:'ISU-004',topic:'Sampah & Kebersihan',author:'Adi Pratama',account:'@wargakuta.demo',media:'Instagram',sourceType:'Social Media',district:'Kuta',sentiment:'Negative',severity:'High',publishedAt:'2026-10-04',publishedLabel:'04 Okt 2026 · 11:54',text:'Mohon penanganan sampah di area Pantai Kuta lebih rutin, terutama setelah akhir pekan.',mentions:1360},
  {id:'ISU-005',topic:'Sampah & Kebersihan',author:'山田 太郎',account:'@yamada.demo',media:'TikTok',sourceType:'Social Media',district:'Kuta',sentiment:'Neutral',severity:'Medium',publishedAt:'2026-10-04',publishedLabel:'04 Okt 2026 · 08:00',text:'Pantai Kuta indah, tetapi pada sore hari dibutuhkan lebih banyak tempat sampah.',mentions:1120},
  {id:'ISU-006',topic:'Sampah & Kebersihan',author:'Radar Bali',account:'Radar Bali',media:'Media Online Lokal',sourceType:'Media Online',district:'Kuta Selatan',sentiment:'Neutral',severity:'High',publishedAt:'2026-07-19',publishedLabel:'19 Jul 2026 · 13:20',text:'Volume sampah kawasan pesisir meningkat selama musim kunjungan dan membutuhkan penyesuaian jadwal angkut.',mentions:1840},
  {id:'ISU-007',topic:'Jalan & Infrastruktur',author:'Komunitas Abiansemal',account:'Komunitas Abiansemal',media:'Facebook',sourceType:'Social Media',district:'Abiansemal',sentiment:'Positive',severity:'Low',publishedAt:'2026-10-04',publishedLabel:'04 Okt 2026 · 11:00',text:'Lampu jalan di jalur utama sudah kembali menyala. Terima kasih atas respons cepatnya.',mentions:720},
  {id:'ISU-008',topic:'Jalan & Infrastruktur',author:'Bali Post',account:'Bali Post',media:'Media Online Lokal',sourceType:'Media Online',district:'Mengwi',sentiment:'Negative',severity:'High',publishedAt:'2026-09-18',publishedLabel:'18 Sep 2026 · 10:10',text:'Kerusakan ruas penghubung desa di Mengwi dikeluhkan karena memperlambat aktivitas warga dan distribusi usaha.',mentions:1510},
  {id:'ISU-009',topic:'Jalan & Infrastruktur',author:'Lapor Badung',account:'Portal Warga',media:'Portal Warga',sourceType:'Citizen / Owned',district:'Mengwi',sentiment:'Negative',severity:'Medium',publishedAt:'2026-06-08',publishedLabel:'08 Jun 2026 · 07:45',text:'Trotoar di sekitar pusat layanan perlu diperbaiki agar lebih aman untuk lansia dan penyandang disabilitas.',mentions:680},
  {id:'ISU-010',topic:'Pariwisata',author:'Claire Laurent',account:'Pusat Informasi Wisata',media:'Email',sourceType:'Citizen / Owned',district:'Kuta Selatan',sentiment:'Positive',severity:'Low',publishedAt:'2026-10-04',publishedLabel:'04 Okt 2026 · 07:00',text:'Petugas pusat informasi sangat ramah dan banyak membantu kami menemukan destinasi lokal.',mentions:810},
  {id:'ISU-011',topic:'Pariwisata',author:'Tribun Bali',account:'Tribun Bali',media:'Media Online Lokal',sourceType:'Media Online',district:'Kuta',sentiment:'Positive',severity:'Medium',publishedAt:'2026-08-11',publishedLabel:'11 Agu 2026 · 14:40',text:'Pelaku UMKM menyambut peningkatan kunjungan wisata dan berharap promosi destinasi lokal diperluas.',mentions:1690},
  {id:'ISU-012',topic:'Pariwisata',author:'Bali Travel Community',account:'@balitravelcommunity',media:'Instagram',sourceType:'Social Media',district:'Kuta Selatan',sentiment:'Neutral',severity:'Medium',publishedAt:'2026-05-27',publishedLabel:'27 Mei 2026 · 16:30',text:'Wisatawan mencari informasi transportasi, jam kunjungan, dan alternatif destinasi yang tidak terlalu padat.',mentions:980},
  {id:'ISU-013',topic:'Banjir & Drainase',author:'Dewa Putra',account:'@dewabali.demo',media:'TikTok',sourceType:'Social Media',district:'Kuta Selatan',sentiment:'Negative',severity:'High',publishedAt:'2026-10-04',publishedLabel:'04 Okt 2026 · 10:00',text:'Drainase dekat pasar perlu dibersihkan sebelum hujan deras berikutnya.',mentions:1040},
  {id:'ISU-014',topic:'Banjir & Drainase',author:'Nusa Bali',account:'Nusa Bali',media:'Media Online Lokal',sourceType:'Media Online',district:'Mengwi',sentiment:'Negative',severity:'High',publishedAt:'2026-09-25',publishedLabel:'25 Sep 2026 · 12:10',text:'Genangan berulang di beberapa titik Mengwi mendorong permintaan normalisasi saluran sebelum puncak musim hujan.',mentions:1430},
  {id:'ISU-015',topic:'Banjir & Drainase',author:'Warga Jimbaran',account:'Call Center 112',media:'Call Center',sourceType:'Citizen / Owned',district:'Kuta Selatan',sentiment:'Negative',severity:'Critical',publishedAt:'2026-04-16',publishedLabel:'16 Apr 2026 · 06:20',text:'Air mulai menggenang di akses pasar setelah hujan deras dan membutuhkan pemeriksaan saluran utama.',mentions:760},
];

const monthLabels=['Nov','Des','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt'];
const monthlySeries:Record<Topic,number[]>={
  'Kemacetan & Transportasi':[520,610,590,680,720,760,810,850,910,1040,1210,1380],
  'Sampah & Kebersihan':[480,530,500,560,610,640,690,720,780,840,930,1010],
  'Jalan & Infrastruktur':[410,430,460,490,520,570,620,660,710,760,810,860],
  'Pariwisata':[380,450,420,470,510,550,590,630,680,740,800,830],
  'Banjir & Drainase':[620,710,760,690,580,540,470,430,410,450,510,560],
};

const dominantTopics:Topic[]=['Banjir & Drainase','Banjir & Drainase','Banjir & Drainase','Kemacetan & Transportasi','Kemacetan & Transportasi','Kemacetan & Transportasi','Kemacetan & Transportasi','Kemacetan & Transportasi','Kemacetan & Transportasi','Kemacetan & Transportasi','Kemacetan & Transportasi','Kemacetan & Transportasi'];

const format=(value:number)=>new Intl.NumberFormat('id-ID').format(value);

function rankBy(records:Conversation[],key:'media'|'account'){
  const totals=new Map<string,{name:string;volume:number;items:number}>();
  records.forEach(record=>{const name=record[key];const current=totals.get(name)||{name,volume:0,items:0};current.volume+=record.mentions;current.items+=1;totals.set(name,current);});
  return Array.from(totals.values()).sort((a,b)=>b.volume-a.volume).slice(0,5);
}

export function RegionalIssues(){
  const [period,setPeriod]=useState('12 bulan terakhir');
  const [topic,setTopic]=useState<'Semua isu'|Topic>('Semua isu');
  const [source,setSource]=useState('Semua sumber');
  const [sentiment,setSentiment]=useState('Semua sentimen');
  const [district,setDistrict]=useState('Semua kecamatan');
  const [severity,setSeverity]=useState('Semua severity');
  const [query,setQuery]=useState('');
  const [detail,setDetail]=useState<Issue|null>(null);
  const monthCount=period==='3 bulan terakhir'?3:period==='6 bulan terakhir'?6:12;
  const cutoff=monthCount===3?'2026-08-01':monthCount===6?'2026-05-01':'2025-11-01';
  const filterable=useMemo(()=>conversations.filter(record=>(source==='Semua sumber'||record.sourceType===source||record.media===source)&&(sentiment==='Semua sentimen'||record.sentiment===sentiment)&&(district==='Semua kecamatan'||record.district===district)&&(severity==='Semua severity'||record.severity===severity)&&record.publishedAt>=cutoff&&(!query.trim()||`${record.text} ${record.author} ${record.account}`.toLowerCase().includes(query.toLowerCase()))),[source,sentiment,district,severity,query,cutoff]);
  const filtered=useMemo(()=>filterable.filter(record=>topic==='Semua isu'||record.topic===topic),[filterable,topic]);
  const mediaRanking=rankBy(filtered,'media');
  const contributorRanking=rankBy(filtered,'account');
  const selectedIssue=topic==='Semua isu'?null:issues.find(issue=>issue.topic===topic)||null;
  const chartValues=selectedIssue?monthlySeries[selectedIssue.topic].slice(-monthCount):dominantTopics.slice(-monthCount).map((issue,index)=>monthlySeries[issue][12-monthCount+index]);
  const chartTopics=selectedIssue?Array(monthCount).fill(selectedIssue.topic) as Topic[]:dominantTopics.slice(-monthCount);
  const maxChart=Math.max(...chartValues);
  const openIssue=(issue:Issue)=>{setTopic(issue.topic);setDetail(issue);};
  const clearFilters=()=>{setPeriod('12 bulan terakhir');setTopic('Semua isu');setSource('Semua sumber');setSentiment('Semua sentimen');setDistrict('Semua kecamatan');setSeverity('Semua severity');setQuery('');};

  return <section className={styles.root}>
    <div className={styles.intro}><div><h2>Isu Daerah Terpantau</h2><p>Cluster percakapan publik untuk melihat isu, sumber, kontributor, dan perubahan perhatian selama satu tahun.</p></div><span>CONTROLLED DEMO DATA</span></div>

    <div className={styles.filters}>
      <label className={styles.search}>Cari percakapan<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Kata kunci, akun, atau percakapan..."/></label>
      <label>Periode<select value={period} onChange={event=>setPeriod(event.target.value)}><option>12 bulan terakhir</option><option>6 bulan terakhir</option><option>3 bulan terakhir</option></select></label>
      <label>Isu<select value={topic} onChange={event=>setTopic(event.target.value as 'Semua isu'|Topic)}><option>Semua isu</option>{issues.map(issue=><option key={issue.topic}>{issue.topic}</option>)}</select></label>
      <label>Sumber<select value={source} onChange={event=>setSource(event.target.value)}><option>Semua sumber</option><option>Social Media</option><option>Media Online</option><option>Citizen / Owned</option><option>Instagram</option><option>Facebook</option><option>TikTok</option><option>Media Online Lokal</option><option>Portal Warga</option></select></label>
      <label>Sentimen<select value={sentiment} onChange={event=>setSentiment(event.target.value)}><option>Semua sentimen</option><option>Positive</option><option>Neutral</option><option>Negative</option></select></label>
      <label>Kecamatan<select value={district} onChange={event=>setDistrict(event.target.value)}><option>Semua kecamatan</option><option>Kuta</option><option>Kuta Utara</option><option>Kuta Selatan</option><option>Mengwi</option><option>Abiansemal</option></select></label>
      <label>Severity<select value={severity} onChange={event=>setSeverity(event.target.value)}><option>Semua severity</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label>
      <button onClick={clearFilters}>Reset</button>
    </div>

    <div className={styles.resultLine}><p><b>{filtered.length}</b> contoh percakapan sesuai filter</p>{topic!=='Semua isu'&&<button onClick={()=>setTopic('Semua isu')}>× {topic}</button>}</div>

    <div className={styles.issueGrid}>{issues.map((issue,index)=>{
      const visibleCount=filterable.filter(record=>record.topic===issue.topic).length;
      return <button key={issue.topic} className={`${styles.issueCard} ${topic===issue.topic?styles.activeIssue:''}`} onClick={()=>openIssue(issue)}>
        <div className={styles.issueTop}><span>0{index+1}</span><em className={issue.growth<0?styles.down:styles.up}>{issue.growth>0?'+':''}{issue.growth}%</em></div>
        <h3>{issue.topic}</h3><p><b>{format(issue.volume)}</b> percakapan terpantau</p>
        <i className={styles.issueBar}><span style={{width:`${issue.volume/100}%`,background:issue.color}}/></i>
        <div className={styles.issueMeta}><span>{issue.severity}</span><span>{issue.districts[0]}</span><span>{visibleCount} contoh data</span></div>
        <small>Klik untuk melihat detail percakapan →</small>
      </button>;
    })}</div>

    <div className={styles.analyticsGrid}>
      <section className={`${styles.panel} ${styles.chartPanel}`}>
        <header><div><h3>Hot Topic per Bulan</h3><p>{selectedIssue?`Tren ${selectedIssue.topic}`:'Isu dengan volume tertinggi setiap bulan'} · {period}</p></div><strong>{selectedIssue?format(selectedIssue.volume):format(issues.reduce((sum,item)=>sum+item.volume,0))}</strong></header>
        <div className={styles.chart} aria-label="Grafik hot topic bulanan selama satu tahun">{chartValues.map((value,index)=>{
          const chartIssue=issues.find(issue=>issue.topic===chartTopics[index])!;
          return <div className={styles.month} key={`${monthLabels[12-monthCount+index]}-${chartIssue.topic}`} title={`${monthLabels[12-monthCount+index]} · ${chartIssue.topic} · ${format(value)}`}><div><span style={{height:`${Math.max(12,value/maxChart*100)}%`,background:chartIssue.color}}><b>{format(value)}</b></span></div><small>{monthLabels[12-monthCount+index]}</small><em>{chartIssue.topic.split(' ')[0]}</em></div>;
        })}</div>
        <div className={styles.legend}>{issues.map(issue=><span key={issue.topic}><i style={{background:issue.color}}/>{issue.topic}</span>)}</div>
      </section>

      <section className={styles.panel}><header><div><h3>Top Media</h3><p>Media yang paling banyak menyumbang isu</p></div></header><Ranking items={mediaRanking}/></section>
      <section className={styles.panel}><header><div><h3>Top Contributor / Account</h3><p>Akun dengan kontribusi percakapan terbesar</p></div></header><Ranking items={contributorRanking}/></section>
    </div>

    <section className={styles.latest}><header><div><h3>Percakapan Isu Terbaru</h3><p>Hasil yang mengikuti seluruh filter di atas</p></div><b>{filtered.length} hasil</b></header>{filtered.length?<div className={styles.conversationList}>{filtered.slice(0,8).map(record=><article key={record.id}><span>{record.author.slice(0,2).toUpperCase()}</span><div><div><b>{record.author}</b><em>{record.media} · {record.account}</em></div><p>{record.text}</p><small>{record.topic} · {record.district} · {record.publishedLabel}</small></div><i className={styles[record.sentiment.toLowerCase()]}>{record.sentiment}</i></article>)}</div>:<div className={styles.empty}>Tidak ada percakapan yang cocok dengan kombinasi filter.</div>}</section>

    {detail&&<IssueDetail issue={detail} records={conversations.filter(record=>record.topic===detail.topic&&(source==='Semua sumber'||record.sourceType===source||record.media===source)&&(sentiment==='Semua sentimen'||record.sentiment===sentiment)&&(district==='Semua kecamatan'||record.district===district)&&(severity==='Semua severity'||record.severity===severity)&&record.publishedAt>=cutoff)} close={()=>setDetail(null)}/>}
  </section>;
}

function Ranking({items}:{items:{name:string;volume:number;items:number}[]}){
  const max=items[0]?.volume||1;
  return <div className={styles.ranking}>{items.length?items.map((item,index)=><div key={item.name}><span>{index+1}</span><p><b>{item.name}</b><small>{item.items} kontribusi terpantau</small><i><em style={{width:`${item.volume/max*100}%`}}/></i></p><strong>{format(item.volume)}</strong></div>):<div className={styles.noRanking}>Tidak ada data untuk filter ini.</div>}</div>;
}

function IssueDetail({issue,records,close}:{issue:Issue;records:Conversation[];close:()=>void}){
  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`Detail ${issue.topic}`}><article className={styles.modal}>
    <header><div><small>ISSUE CLUSTER DETAIL</small><h2>{issue.topic}</h2><p>{format(issue.volume)} percakapan · pertumbuhan {issue.growth>0?'+':''}{issue.growth}%</p></div><button onClick={close}>×</button></header>
    <div className={styles.detailSummary}><div><small>SEVERITY</small><b>{issue.severity}</b></div><div><small>RESPONSIBLE ENTITY</small><b>{issue.owner}</b></div><div><small>WILAYAH UTAMA</small><b>{issue.districts.join(' · ')}</b></div><div><small>CONTOH PERCAKAPAN</small><b>{records.length}</b></div></div>
    <div className={styles.keywords}>{issue.keywords.map(keyword=><span key={keyword}>#{keyword}</span>)}</div>
    <section className={styles.detailConversations}><h3>Percakapan dalam cluster isu</h3>{records.length?records.map(record=><article key={record.id}><div className={styles.detailAvatar}>{record.author.slice(0,2).toUpperCase()}</div><div><header><p><b>{record.author}</b><span>{record.account}</span></p><em>{record.media} · {record.sourceType}</em></header><blockquote>{record.text}</blockquote><footer><span>{record.district}</span><span>{record.publishedLabel}</span><i className={styles[record.sentiment.toLowerCase()]}>{record.sentiment}</i></footer></div></article>):<div className={styles.empty}>Tidak ada percakapan dalam cluster ini untuk filter aktif.</div>}</section>
  </article></div>;
}
