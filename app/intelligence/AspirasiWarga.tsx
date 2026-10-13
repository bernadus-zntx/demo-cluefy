'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useFindings, type FindingConversation } from './Findings';
import type { Sentiment, Severity } from './model';
import { formatLiveTime, liveText, useLiveIntelligence, type LiveItem } from './LiveIntelligence';
import styles from './aspirasi-warga.module.css';

type SourceGroup = 'Social Media' | 'Media Konvensional' | 'Citizen / Owned';
type Change = {field:string;before:string;after:string};
type HistoryEvent = {id:string;actor:string;at:string;reason:string;changes:Change[]};
type Record = FindingConversation & {
  id:string; displayId:string; sourceUrl:string; sourceGroup:SourceGroup; platform:string; account:string; actor:string; location:string; village:string; language:string; country:string;
  severity:Severity; publishedLabel:string; isNew:boolean; systemTopic:string; classified:boolean; history:HistoryEvent[];
  evidenceType:'Publikasi Resmi'|'Media Publik'|'Percakapan Publik'; sourceNote:string;
  ai:{summary:string;entities:string[];emotion:string;confidence:number;recommendation:string};
};

const topicOptions=['Sampah & Kebersihan','Layanan Publik','Kemacetan & Transportasi','Jalan & Infrastruktur','Banjir & Drainase'];
const districtOptions=['Kuta','Mengwi','Kuta Utara','Abiansemal','Kuta Selatan'];

function initialHistory(id:string,topic:string,sentiment:Sentiment,severity:Severity):HistoryEvent[]{
  return [{id:`${id}-SYSTEM`,actor:'ClueFy AI',at:'Saat data diterima',reason:'Klasifikasi awal oleh sistem',changes:[{field:'Topik',before:'Belum diklasifikasi',after:topic},{field:'Sentimen',before:'Belum diklasifikasi',after:sentiment},{field:'Severity',before:'Belum diklasifikasi',after:severity}]}];
}

function sourceBadge(record:Record){
  if(record.evidenceType==='Publikasi Resmi')return 'OFFICIAL SOURCE';
  if(record.evidenceType==='Percakapan Publik')return 'PUBLIC SOCIAL';
  return record.platform==='Media Asing'?`FOREIGN MEDIA · ${record.language.toUpperCase()}`:'PUBLIC MEDIA';
}

function languageLabel(code:string){return ({id:'Bahasa Indonesia',en:'English',ja:'日本語',fr:'Français',de:'Deutsch'} as {[key:string]:string})[code.toLowerCase()]||code;}

function classifySourceGroup(item:LiveItem):SourceGroup{
  const value=`${item.platform||''} ${item.source}`.toLowerCase();
  if(/instagram|facebook|tiktok|youtube|reddit|twitter|\bx\b|social/.test(value))return 'Social Media';
  if(/whatsapp|call center|email|portal warga|sidumas|lapor/.test(value))return 'Citizen / Owned';
  return 'Media Konvensional';
}

function mapLiveRecord(item:LiveItem):Record{
  const platform=item.platform||item.source;
  const sentiment=['Positive','Neutral','Negative'].includes(item.sentiment||'')?item.sentiment as Sentiment:'Neutral';
  const severity=['Critical','High','Medium','Low'].includes(item.severity||'')?item.severity as Severity:'Medium';
  const topic=item.topic||'Belum diklasifikasi';
  const publishedAt=item.publishedAt||item.capturedAt;
  const classified=Boolean(item.topic||item.sentiment||item.severity);
  const isNew=Date.now()-new Date(item.firstSeenAt).getTime()<24*60*60*1000;
  return {
    id:item.id,displayId:`ASP-${item.id.replaceAll('-','').slice(0,8).toUpperCase()}`,sourceGroup:classifySourceGroup(item),platform,source:item.source,account:item.publisher||item.source,
    name:item.author||item.publisher||item.source,actor:item.actor||'Belum dianalisis',location:item.location||'Belum terdeteksi',
    village:item.village||'Belum terdeteksi',language:item.language||'Belum terdeteksi',country:item.country||'Belum terdeteksi',publishedAt,publishedLabel:formatLiveTime(publishedAt),
    sourceUrl:item.url,text:liveText(item),translation:item.translation||undefined,topic,systemTopic:topic,sentiment,severity,isNew,classified,
    evidenceType:item.evidenceType==='Publikasi Resmi'||item.evidenceType==='Percakapan Publik'?item.evidenceType:'Media Publik',
    sourceNote:item.sourceNote||'Data diterima langsung melalui crawler dan URL sumber disimpan sebagai evidence.',
    history:classified?initialHistory(item.id,topic,sentiment,severity):[],
    ai:{summary:item.ai.summary||'Analisis AI belum tersedia untuk data ini.',entities:item.ai.entities,emotion:item.ai.emotion||'Belum dianalisis',confidence:item.ai.confidence??0,recommendation:item.ai.recommendation||'Lakukan analisis dan verifikasi sebelum menentukan tindak lanjut.'},
  };
}

function compactSourceUrl(value:string){
  try{
    const url=new URL(value);
    const isGoogleNews=url.hostname==='news.google.com'&&url.pathname.startsWith('/rss/articles/');
    if(isGoogleNews)return `${url.hostname}/rss/articles/…`;
    const path=`${url.pathname}${url.search}`;
    return `${url.hostname}${path.length>54?`${path.slice(0,54)}…`:path}`;
  }catch{return value.length>70?`${value.slice(0,70)}…`:value;}
}

const sourceGroups:{name:SourceGroup;platforms:string[]}[]=[
  {name:'Social Media',platforms:['Instagram','TikTok','Facebook','X','YouTube','Reddit']},
  {name:'Media Konvensional',platforms:['Media Online','Media Asing','Print','TV','Radio']},
  {name:'Citizen / Owned',platforms:['Portal Warga','WhatsApp','Call Center','Email']},
];

type Modal = {type:'viewer'|'broadcast';recordId:string}|{type:'finding';records:Record[]}|null;

export function AspirasiWarga(){
  const {findings,addEvidence,createFromConversations}=useFindings();
  const live=useLiveIntelligence();
  const [itemOverrides,setItemOverrides]=useState<{[id:string]:Partial<Record>}>({});
  const items=useMemo(()=>live.items.map(mapLiveRecord).map(record=>({...record,...itemOverrides[record.id]})),[live.items,itemOverrides]);
  const [sources,setSources]=useState<string[]>([]);
  const [query,setQuery]=useState('');
  const [topic,setTopic]=useState('Semua topik');
  const [sentiment,setSentiment]=useState('Semua sentimen');
  const [location,setLocation]=useState('Semua kecamatan');
  const [village,setVillage]=useState('Semua desa/kelurahan');
  const [language,setLanguage]=useState('Semua bahasa');
  const [newState,setNewState]=useState('Semua status');
  const [account,setAccount]=useState('Semua media / akun');
  const [actor,setActor]=useState('Semua actor / entity');
  const [findingState,setFindingState]=useState('Semua');
  const [severity,setSeverity]=useState('Semua severity');
  const [advanced,setAdvanced]=useState(false);
  const [selected,setSelected]=useState<string[]>([]);
  const [modal,setModal]=useState<Modal>(null);
  const [openActionId,setOpenActionId]=useState<string|null>(null);

  const hasFinding=(record:Record)=>findings.some(finding=>finding.evidence.some(evidence=>evidence.author===record.name&&evidence.transcript===record.text));
  const shown=items.filter(record=>(!sources.length||sources.includes(record.platform))&&(topic==='Semua topik'||record.topic===topic)&&(sentiment==='Semua sentimen'||record.sentiment===sentiment)&&(location==='Semua kecamatan'||record.location===location)&&(village==='Semua desa/kelurahan'||record.village===village)&&(language==='Semua bahasa'||record.language===language)&&(newState==='Semua status'||(newState==='New')===record.isNew)&&(account==='Semua media / akun'||record.account===account)&&(actor==='Semua actor / entity'||record.actor===actor)&&(severity==='Semua severity'||record.severity===severity)&&(findingState==='Semua'||(findingState==='Sudah ada Finding')===hasFinding(record))&&(!query.trim()||`${record.text} ${record.translation||''} ${record.name} ${record.account} ${record.topic} ${record.actor}`.toLowerCase().includes(query.toLowerCase())));
  const values=(key:keyof Pick<Record,'topic'|'location'|'village'|'language'|'account'|'actor'>)=>Array.from(new Set(items.map(record=>String(record[key]))));
  const toggleSource=(platform:string)=>setSources(current=>current.includes(platform)?current.filter(item=>item!==platform):[...current,platform]);
  const toggleGroup=(platforms:string[])=>setSources(current=>platforms.every(platform=>current.includes(platform))?current.filter(item=>!platforms.includes(item)):Array.from(new Set([...current,...platforms])));
  const openFinding=(record:Record)=>setModal({type:'finding',records:selected.length?items.filter(item=>selected.includes(item.id)):[record]});
  const updateClassification=(recordId:string,patch:Partial<Pick<Record,'topic'|'sentiment'|'severity'|'actor'|'location'|'village'>>,reason:string,changes:Change[])=>{const record=items.find(item=>item.id===recordId);if(!record)return;setItemOverrides(current=>({...current,[recordId]:{...current[recordId],...patch,classified:true,history:[...record.history,{id:`${record.id}-${Date.now()}`,actor:'Budi Santoso',at:new Date().toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}),reason,changes}]}}));};
  const markViewed=(recordId:string)=>setItemOverrides(current=>({...current,[recordId]:{...current[recordId],isNew:false}}));
  const resetFilters=()=>{setSources([]);setQuery('');setTopic('Semua topik');setSentiment('Semua sentimen');setLocation('Semua kecamatan');setVillage('Semua desa/kelurahan');setLanguage('Semua bahasa');setNewState('Semua status');setAccount('Semua media / akun');setActor('Semua actor / entity');setFindingState('Semua');setSeverity('Semua severity');};
  const viewed=modal?.type==='viewer'?items.find(record=>record.id===modal.recordId):undefined;
  const broadcastRecord=modal?.type==='broadcast'?items.find(record=>record.id===modal.recordId):undefined;

  return <section className={styles.root}>
    <div className={styles.heading}><div><h2>Aspirasi & Percakapan Warga</h2><p>Data publik Kabupaten Badung yang masuk dari crawler dan tersimpan di Supabase.</p></div><span>{live.loading?'MEMUAT DATA LIVE':`${items.filter(record=>record.isNew).length} NEW · ${items.length} DATA LIVE`}</span></div>
    <div className={styles.realDataNotice}><span>{live.error?'!':'✓'}</span><div><b>{live.error?'Koneksi data bermasalah':live.configured?'Live data connected':'Sumber belum terhubung'}</b><p>{live.error||'Hanya data yang benar-benar diterima crawler yang ditampilkan. URL sumber disimpan sebagai evidence.'}</p></div><small>{live.generatedAt?`Diperbarui · ${formatLiveTime(live.generatedAt)}`:'Belum ada sinkronisasi'}</small></div>
    <div className={styles.sourceGroups}>{sourceGroups.map(group=>{const selectedGroup=group.platforms.some(platform=>sources.includes(platform));return <article key={group.name} className={selectedGroup?styles.selectedGroup:''}><button className={styles.groupButton} onClick={()=>toggleGroup(group.platforms)}><b>{group.name}</b><small>{group.platforms.join(', ')}</small></button><div>{group.platforms.map(platform=><button key={platform} className={sources.includes(platform)?styles.activeSource:''} onClick={()=>toggleSource(platform)}>{platform}<em>{items.filter(record=>record.platform===platform).length}</em></button>)}</div></article>;})}</div>
    <div className={styles.filters}>
      <label className={styles.searchField}>Free text<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cari percakapan, akun, topik..."/></label>
      <label>Periode<select><option>Semua data tersimpan</option><option>7 hari terakhir</option><option>30 hari terakhir</option></select></label>
      <details className={styles.sourcePicker}><summary>Sumber {sources.length?`(${sources.length})`:'· Semua'}</summary><div><header><b>Pilih beberapa sumber</b><button onClick={()=>setSources([])}>Reset</button></header>{sourceGroups.map(group=><section key={group.name}><strong>{group.name}</strong>{group.platforms.map(platform=><label key={platform}><input type="checkbox" checked={sources.includes(platform)} onChange={()=>toggleSource(platform)}/><span>{platform}</span><em>{items.filter(record=>record.platform===platform).length}</em></label>)}</section>)}</div></details>
      <label>Topik<select value={topic} onChange={event=>setTopic(event.target.value)}><option>Semua topik</option>{values('topic').map(value=><option key={value}>{value}</option>)}</select></label>
      <label>Sentimen<select value={sentiment} onChange={event=>setSentiment(event.target.value)}><option>Semua sentimen</option><option>Positive</option><option>Neutral</option><option>Negative</option></select></label>
      <label>Status data<select value={newState} onChange={event=>setNewState(event.target.value)}><option>Semua status</option><option>New</option><option>Sudah dilihat</option></select></label>
      <label>Kecamatan<select value={location} onChange={event=>setLocation(event.target.value)}><option>Semua kecamatan</option>{values('location').map(value=><option key={value}>{value}</option>)}</select></label>
      <button onClick={()=>setAdvanced(value=>!value)}>＋ Filter {advanced?'−':'+'}</button><button className={styles.resetButton} onClick={resetFilters}>Reset</button>
    </div>
    {advanced&&<div className={styles.advanced}><label>Desa/Kelurahan<select value={village} onChange={event=>setVillage(event.target.value)}><option>Semua desa/kelurahan</option>{values('village').map(value=><option key={value}>{value}</option>)}</select></label><label>Bahasa<select value={language} onChange={event=>setLanguage(event.target.value)}><option>Semua bahasa</option>{values('language').map(value=><option key={value}>{value}</option>)}</select></label><label>Media / Account<select value={account} onChange={event=>setAccount(event.target.value)}><option>Semua media / akun</option>{values('account').map(value=><option key={value}>{value}</option>)}</select></label><label>Actor / Entity<select value={actor} onChange={event=>setActor(event.target.value)}><option>Semua actor / entity</option>{values('actor').map(value=><option key={value}>{value}</option>)}</select></label><label>Has Finding<select value={findingState} onChange={event=>setFindingState(event.target.value)}><option>Semua</option><option>Sudah ada Finding</option><option>Belum ada Finding</option></select></label><label>Severity<select value={severity} onChange={event=>setSeverity(event.target.value)}><option>Semua severity</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label></div>}
    <div className={styles.resultBar}><p><b>{shown.length}</b> aspirasi ditampilkan{sources.length>0&&<> · <strong>{sources.length} sumber dipilih</strong></>}</p><div>{selected.length>0&&<><span>{selected.length} dipilih</span><button onClick={()=>openFinding(items.find(record=>record.id===selected[0])!)}>Gabungkan ke Finding</button><button onClick={()=>setSelected([])}>Batal pilih</button></>}</div></div>
    <section className={styles.table}><div className={`${styles.row} ${styles.head}`}><span><input type="checkbox" aria-label="Pilih semua aspirasi" checked={shown.length>0&&shown.every(record=>selected.includes(record.id))} onChange={event=>setSelected(event.target.checked?Array.from(new Set([...selected,...shown.map(record=>record.id)])):selected.filter(id=>!shown.some(record=>record.id===id)))}/></span><b>ASPIRASI / PERCAKAPAN</b><b>SUMBER</b><b>LOKASI</b><b>TOPIK</b><b>SENTIMEN</b><b>TANGGAL</b><b/></div>{shown.map(record=><div className={`${styles.row} ${record.isNew?styles.newRow:''}`} key={record.id}><span><input type="checkbox" aria-label={`Pilih ${record.id}`} checked={selected.includes(record.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,record.id]:current.filter(id=>id!==record.id))}/></span><button type="button" className={styles.content} aria-label={`Buka detail ${record.id}`} onClick={()=>{setOpenActionId(null);setModal({type:'viewer',recordId:record.id})}}><span>{record.name.slice(0,2).toUpperCase()}</span><span><span className={styles.authorLine}><strong>{record.name}</strong><i>{sourceBadge(record)}</i>{record.isNew&&<em>NEW</em>}</span><span className={styles.conversationText}>{record.text}</span>{record.translation&&<small>Terjemahan: {record.translation}</small>}</span></button><span><b>{record.platform}</b><small>{record.account}</small></span><span><b>{record.location}</b><small>{record.village}</small></span><span>{record.classified?record.topic:'Belum dianalisis'}</span><span className={record.classified?styles[record.sentiment.toLowerCase()]:''}>{record.classified?record.sentiment:'Belum dianalisis'}</span><span>{record.publishedLabel}</span><div className={styles.actions}><button type="button" className={styles.actionTrigger} aria-label={`Aksi ${record.id}`} aria-expanded={openActionId===record.id} onClick={()=>setOpenActionId(current=>current===record.id?null:record.id)}>•••</button>{openActionId===record.id&&<div><button onClick={()=>{setOpenActionId(null);setModal({type:'viewer',recordId:record.id})}}>View Detail &amp; AI Analysis</button><button onClick={()=>{setOpenActionId(null);openFinding(record)}}>Create / Add to Finding</button><button onClick={()=>{setOpenActionId(null);setModal({type:'broadcast',recordId:record.id})}}>Broadcast Internal</button></div>}</div></div>)}</section>
    {!shown.length&&<div className={styles.empty}>{live.loading?'Memuat data live…':live.error?'Data tidak dapat dimuat.':'Belum ada data crawler yang cocok dengan filter. Jalankan crawler untuk mulai mengisi Aspirasi Warga.'}</div>}
    {viewed&&<ViewerModal key={viewed.id} record={viewed} close={()=>setModal(null)} markViewed={()=>markViewed(viewed.id)} update={(patch,reason,changes)=>updateClassification(viewed.id,patch,reason,changes)}/>}
    {broadcastRecord&&<BroadcastModal key={broadcastRecord.id} record={broadcastRecord} close={()=>setModal(null)}/>}
    {modal?.type==='finding'&&<FindingModal records={modal.records} close={()=>setModal(null)} onDone={()=>setSelected([])} addEvidence={addEvidence} createNew={createFromConversations}/>}
  </section>;
}

function ModalShell({title,kicker,close,children}:{title:string;kicker:string;close:()=>void;children:ReactNode}){return <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}><article className={styles.modal}><header><div><small>{kicker}</small><h2>{title}</h2></div><button onClick={close}>×</button></header>{children}</article></div>}

type Editable = Pick<Record,'topic'|'sentiment'|'severity'|'actor'|'location'|'village'>;

function ViewerModal({record,close,markViewed,update}:{record:Record;close:()=>void;markViewed:()=>void;update:(patch:Partial<Editable>,reason:string,changes:Change[])=>void}){
  const [tab,setTab]=useState<'detail'|'analysis'>('detail');
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState<Editable>({topic:record.topic,sentiment:record.sentiment,severity:record.severity,actor:record.actor,location:record.location,village:record.village});
  const [reason,setReason]=useState('');
  const startEditing=()=>{setDraft({topic:record.topic,sentiment:record.sentiment,severity:record.severity,actor:record.actor,location:record.location,village:record.village});setReason('');setEditing(true)};
  const save=()=>{const labels:{[K in keyof Editable]:string}={topic:'Topik',sentiment:'Sentimen',severity:'Severity',actor:'Actor / Entity',location:'Kecamatan',village:'Desa / Kelurahan'};const keys=(Object.keys(draft) as (keyof Editable)[]);const changes=keys.filter(key=>String(record[key])!==String(draft[key])).map(key=>({field:labels[key],before:String(record[key]),after:String(draft[key])}));if(!changes.length||!reason.trim())return;update(draft,reason.trim(),changes);setEditing(false)};
  const hasChanges=(Object.keys(draft) as (keyof Editable)[]).some(key=>String(record[key])!==String(draft[key]));
  return <ModalShell title="Aspirasi Detail & AI Analysis" kicker={`${record.displayId} · SOURCE LINKED · ${sourceBadge(record)}${record.isNew?' · NEW ASPIRATION':''}`} close={close}>
    <div className={styles.tabs}><button className={tab==='detail'?styles.activeTab:''} onClick={()=>setTab('detail')}>Detail Sumber</button><button className={tab==='analysis'?styles.activeTab:''} onClick={()=>setTab('analysis')}>AI Analysis &amp; Review</button>{record.isNew&&<button className={styles.markViewed} onClick={markViewed}>Tandai sudah dilihat</button>}</div>
    {tab==='detail'?<div className={styles.detailGrid}><section><h3>URL Sumber</h3><div className={styles.url}><span title={record.sourceUrl}>{compactSourceUrl(record.sourceUrl)}</span><a href={record.sourceUrl} target="_blank" rel="noreferrer">Buka sumber asli ↗</a></div><h3>Preview Sumber</h3><article className={styles.sourcePreview}><div className={styles.sourcePreviewHead}><span>{record.account.slice(0,2).toUpperCase()}</span><div><small>{sourceBadge(record)}</small><b>{record.account}</b><em>{record.platform} · {languageLabel(record.language)} · {record.publishedLabel}</em></div></div><p>{record.text}</p><dl><div><dt>Penulis</dt><dd>{record.name}</dd></div><div><dt>Lokasi terdeteksi</dt><dd>{record.location} · {record.village}</dd></div></dl><footer><span>Preview dari metadata crawler</span><a href={record.sourceUrl} target="_blank" rel="noreferrer">Baca artikel lengkap ↗</a></footer></article><p className={styles.previewNote}>Halaman publisher dibuka di tab baru karena Google News dan sebagian media menolak ditampilkan di dalam aplikasi.</p></section><section><h3>Percakapan</h3><blockquote>{record.text}</blockquote>{record.translation&&<div className={styles.translation}><small>TERJEMAHAN INDONESIA</small><p>{record.translation}</p></div>}<dl><div><dt>Status Sumber</dt><dd>SOURCE LINKED</dd></div><div><dt>Klasifikasi Sumber</dt><dd>{sourceBadge(record)}</dd></div><div><dt>Sumber</dt><dd>{record.platform}</dd></div><div><dt>Media / Akun</dt><dd>{record.account}</dd></div><div><dt>Negara Media</dt><dd>{record.country}</dd></div><div><dt>Penulis</dt><dd>{record.name}</dd></div><div><dt>Waktu Publikasi</dt><dd>{record.publishedLabel}</dd></div><div><dt>Lokasi</dt><dd>{record.location} · {record.village}</dd></div><div><dt>Jenis Evidence</dt><dd>{record.evidenceType}</dd></div><div><dt>Bahasa</dt><dd>{languageLabel(record.language)}</dd></div></dl><div className={styles.sourceProvenance}><b>Catatan sumber</b><p>{record.sourceNote}</p></div><div className={styles.immutableNote}><b>Evidence asli dikunci</b><p>URL, isi percakapan, platform, penulis, dan waktu publikasi tidak dapat diedit agar integritas evidence tetap terjaga.</p></div></section></div>:<div className={styles.analysisWrap}><p className={styles.aiNotice}>AI memberi klasifikasi awal. User dapat mengoreksi field terstruktur; setiap perubahan wajib memiliki alasan dan tercatat dalam history.</p><div className={styles.aiGrid}><section><h3>Source Content</h3><blockquote>{record.text}</blockquote>{record.translation&&<p><b>Terjemahan:</b> {record.translation}</p>}<a href={record.sourceUrl} target="_blank" rel="noreferrer">Buka evidence asli ↗</a><h3>AI Summary</h3><p>{record.ai.summary}</p><h3>Recommendation</h3><p>{record.ai.recommendation}</p></section><section><div className={styles.reviewHead}><div><h3>Active Classification</h3><small>{record.classified?`System topic: ${record.systemTopic}`:'Klasifikasi AI belum tersedia'}</small></div>{!editing&&<button onClick={startEditing}>Edit Classification</button>}</div>{editing?<div className={styles.editForm}><label>Topik<select value={draft.topic} onChange={event=>setDraft(current=>({...current,topic:event.target.value}))}>{topicOptions.map(value=><option key={value}>{value}</option>)}</select></label><label>Sentimen<select value={draft.sentiment} onChange={event=>setDraft(current=>({...current,sentiment:event.target.value as Sentiment}))}><option>Positive</option><option>Neutral</option><option>Negative</option></select></label><label>Severity<select value={draft.severity} onChange={event=>setDraft(current=>({...current,severity:event.target.value as Severity}))}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label><label>Actor / Entity<input value={draft.actor} onChange={event=>setDraft(current=>({...current,actor:event.target.value}))}/></label><label>Kecamatan<select value={draft.location} onChange={event=>setDraft(current=>({...current,location:event.target.value}))}>{districtOptions.map(value=><option key={value}>{value}</option>)}</select></label><label>Desa / Kelurahan<input value={draft.village} onChange={event=>setDraft(current=>({...current,village:event.target.value}))}/></label><label className={styles.reason}>Alasan koreksi<textarea value={reason} onChange={event=>setReason(event.target.value)} placeholder="Wajib diisi untuk audit trail"/></label><div className={styles.editActions}><button onClick={()=>setEditing(false)}>Batal</button><button disabled={!hasChanges||!reason.trim()} onClick={save}>Simpan &amp; Catat History</button></div></div>:<dl><div><dt>Topic</dt><dd>{record.classified?record.topic:'Belum dianalisis'}</dd></div><div><dt>Sentiment</dt><dd>{record.classified?record.sentiment:'Belum dianalisis'}</dd></div><div><dt>Emotion</dt><dd>{record.ai.emotion}</dd></div><div><dt>Severity</dt><dd>{record.classified?record.severity:'Belum dianalisis'}</dd></div><div><dt>Location</dt><dd>{record.location} · {record.village}</dd></div><div><dt>Confidence</dt><dd>{record.classified?`${record.ai.confidence}%`:'Belum tersedia'}</dd></div><div className={styles.full}><dt>Actor / Entity</dt><dd>{record.actor}</dd></div><div className={styles.full}><dt>Detected Entities</dt><dd>{record.ai.entities.join(', ')}</dd></div></dl>}<div className={styles.editableGuide}><b>Yang dapat dikoreksi user</b><p>Topik, sentimen, severity, actor/entity, kecamatan, dan desa/kelurahan.</p></div></section></div><section className={styles.history}><h3>Classification History &amp; Audit Log</h3>{[...record.history].reverse().map(event=><article key={event.id}><div><b>{event.actor}</b><span>{event.at}</span></div><p>{event.reason}</p><ul>{event.changes.map(change=><li key={`${event.id}-${change.field}`}><strong>{change.field}</strong><del>{change.before}</del><span>→</span><ins>{change.after}</ins></li>)}</ul></article>)}</section></div>}
  </ModalShell>
}

type Channel = 'Email'|'WhatsApp'|'Telegram'|'Facebook'|'Instagram'|'SMS';
const channels:Channel[]=['Email','WhatsApp','Telegram','Facebook','Instagram','SMS'];

function ChannelIcon({channel}:{channel:Channel}){
  if(channel==='Email')return <svg viewBox="0 0 24 24" aria-hidden><path d="M3 6h18v12H3zM4 7l8 6 8-6"/></svg>;
  if(channel==='WhatsApp')return <svg viewBox="0 0 24 24" aria-hidden><path d="M12 3a8 8 0 0 0-6.8 12.2L4 20l4.9-1.2A8 8 0 1 0 12 3z"/><path d="M9 8c.5 3 2 4.5 5 5l1-1.2 2 1c-.2 1.7-1.2 2.4-2.5 2.3-4.2-.4-7.2-3.5-7.6-7.5C6.8 6.4 7.6 5.4 9.2 5l1 2z"/></svg>;
  if(channel==='Telegram')return <svg viewBox="0 0 24 24" aria-hidden><path d="M3 11l18-7-4 16-6-5-4 3 1-5z"/><path d="M8 13L18 7"/></svg>;
  if(channel==='Facebook')return <svg viewBox="0 0 24 24" aria-hidden><path d="M14 21v-8h3l.5-3H14V8.5c0-1 .4-1.5 1.7-1.5H18V4.2c-.6-.1-1.7-.2-2.8-.2-2.8 0-4.2 1.7-4.2 4.3V10H8v3h3v8z"/></svg>;
  if(channel==='Instagram')return <svg viewBox="0 0 24 24" aria-hidden><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.8" r="1"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden><path d="M4 5h16v12H8l-4 3z"/><path d="M8 9h8M8 13h6"/></svg>;
}

function generatedMessage(record:Record){
  const responseTarget:{[K in Severity]:string}={Critical:'Maks. 1 jam',High:'Maks. 4 jam',Medium:'Maks. 1 hari kerja',Low:'Maks. 3 hari kerja'};
  return `[CLUEFY · INTERNAL ALERT]\n\nID Aspirasi : ${record.displayId}\nTopik       : ${record.classified?record.topic:'Belum dianalisis'}\nSentimen    : ${record.classified?record.sentiment:'Belum dianalisis'}\nPriority    : ${record.classified?record.severity:'Belum dianalisis'}\nLokasi      : ${record.location} · ${record.village}\nSumber      : ${record.platform} · ${record.account}\nPublikasi   : ${record.publishedLabel}\n\nRINGKASAN AI\n${record.ai.summary}\n\nANALISIS\nEmosi terdeteksi: ${record.ai.emotion}. Confidence klasifikasi ${record.classified?`${record.ai.confidence}%`:'belum tersedia'}.\n\nREKOMENDASI TINDAKAN\n${record.ai.recommendation}\n\nSUGGESTED PIC / OPD\n${record.actor}\n\nTARGET RESPONS\n${record.classified?responseTarget[record.severity]:'Belum ditentukan'}\n\nEVIDENCE\n${record.sourceUrl}\n\nStatus: Menunggu verifikasi dan disposisi internal.`;
}

function BroadcastModal({record,close}:{record:Record;close:()=>void}){
  const [message,setMessage]=useState(generatedMessage(record));
  const [selectedChannels,setSelectedChannels]=useState<Channel[]>(['WhatsApp','Email']);
  const [audience,setAudience]=useState(`OPD terkait · ${record.actor}`);
  const [sent,setSent]=useState(false);
  const toggle=(channel:Channel)=>setSelectedChannels(current=>current.includes(channel)?current.filter(item=>item!==channel):[...current,channel]);
  return <ModalShell title="Internal Broadcast Message" kicker={`${record.displayId} · INTERNAL ONLY · AI GENERATED`} close={close}>
    <div className={styles.internalBanner}><b>INTERNAL ONLY</b><span>Pesan operasional untuk command center, pimpinan, dan OPD terkait. Bukan balasan publik kepada warga.</span></div>
    <div className={styles.broadcastIntro}><div><small>ASPIRASI SUMBER</small><strong>{record.classified?record.topic:'Belum dianalisis'}</strong><p>{record.text}</p></div><div className={styles.broadcastTags}><span>Priority · {record.classified?record.severity:'Belum dianalisis'}</span><span>{record.location}</span></div></div>
    <div className={styles.broadcastFacts}><div><small>TOPIK</small><b>{record.classified?record.topic:'Belum dianalisis'}</b></div><div><small>SENTIMEN</small><b className={record.classified?styles[record.sentiment.toLowerCase()]:''}>{record.classified?record.sentiment:'Belum dianalisis'}</b></div><div><small>PRIORITY</small><b>{record.classified?record.severity:'Belum dianalisis'}</b></div><div><small>LOKASI</small><b>{record.location} · {record.village}</b></div><div><small>SUGGESTED PIC</small><b>{record.actor}</b></div></div>
    <section className={styles.broadcastBody}><div className={styles.messageEditor}><header><div><h3>AI Internal Brief</h3><p>Format operasional dapat diedit sebelum didistribusikan.</p></div><button onClick={()=>setMessage(generatedMessage(record))}>↻ Generate ulang</button></header><textarea aria-label="Broadcast message" value={message} onChange={event=>setMessage(event.target.value)}/><footer><span>AI DRAFT · EDITABLE</span><b>{message.length} karakter</b></footer></div>
    <div className={styles.channelPanel}><h3>Distribusi Internal</h3><p>Tentukan grup penerima dan channel pengiriman.</p><label className={styles.audienceField}>Penerima internal<select value={audience} onChange={event=>setAudience(event.target.value)}><option>{`OPD terkait · ${record.actor}`}</option><option>Command Center &amp; OPD terkait</option><option>Pimpinan Daerah</option><option>Tim Komunikasi Publik</option></select></label><div className={styles.channelGrid}>{channels.map(channel=><button key={channel} aria-pressed={selectedChannels.includes(channel)} className={`${styles.channel} ${styles[`channel${channel}`]} ${selectedChannels.includes(channel)?styles.selectedChannel:''}`} onClick={()=>toggle(channel)}><span><ChannelIcon channel={channel}/></span><span><b>{channel}</b><small>{selectedChannels.includes(channel)?'✓ Dipilih':'Pilih'}</small></span></button>)}</div><div className={styles.broadcastNote}><b>Delivery adapter belum terhubung</b><p>Pengiriman aktual akan memakai adapter API dan direktori penerima internal yang terhubung.</p></div></div></section>
    {sent?<div className={styles.broadcastSuccess}><span>✓</span><div><b>Broadcast internal berhasil dimulai</b><p>{audience} · {selectedChannels.length} channel: {selectedChannels.join(', ')}</p></div><button onClick={close}>Selesai</button></div>:<footer><button onClick={close}>Batal</button><button disabled={!message.trim()||!selectedChannels.length} onClick={()=>setSent(true)}>Kirim Internal · {selectedChannels.length} Channel</button></footer>}
  </ModalShell>
}

function FindingModal({records,close,onDone,addEvidence,createNew}:{records:Record[];close:()=>void;onDone:()=>void;addEvidence:(id:string,items:FindingConversation[])=>void;createNew:(items:FindingConversation[],title:string)=>string}){
  const {findings}=useFindings();const [mode,setMode]=useState<'existing'|'new'>('existing');const [findingId,setFindingId]=useState(findings[0]?.id||'');const [title,setTitle]=useState(`Finding: ${records[0]?.topic||'Aspirasi Warga'}`);const [done,setDone]=useState('');
  function save(){if(mode==='existing'){addEvidence(findingId,records);setDone(`${records.length} aspirasi ditambahkan ke ${findingId}. Finding kembali ke Draft agar evidence baru dapat direview.`)}else{const id=createNew(records,title);setDone(`${id} dibuat dengan ${records.length} supporting evidence.`)}onDone()}
  return <ModalShell title="Create / Add to Finding" kicker={`${records.length} ASPIRASI DIPILIH`} close={close}><div className={styles.findingExplain}><b>Finding menemukan pola yang sama dari banyak informasi.</b><p>Aspirasi adalah satu informasi. Finding menggabungkan minimal dua aspirasi atau source signal yang berkaitan sebagai satu masalah berulang.</p></div><div className={styles.mode}><button className={mode==='existing'?styles.activeMode:''} onClick={()=>setMode('existing')}>Tambahkan ke Finding</button><button className={mode==='new'?styles.activeMode:''} onClick={()=>setMode('new')}>Buat Finding Baru</button></div>{mode==='existing'?<label className={styles.field}>Pilih Finding<select value={findingId} onChange={event=>setFindingId(event.target.value)}>{findings.map(finding=><option value={finding.id} key={finding.id}>{finding.title} · {finding.evidence.length} evidence · {finding.status}</option>)}</select></label>:<><label className={styles.field}>Judul Finding<input value={title} onChange={event=>setTitle(event.target.value)}/></label>{records.length<2&&<p className={styles.findingMinimum}>Pilih minimal dua aspirasi untuk membuat Finding baru. Informasi tunggal tetap dapat ditambahkan ke Finding yang sudah ada.</p>}</>}<section className={styles.selectedEvidence}><h3>Related aspirasi yang akan digabungkan</h3>{records.map(record=><div key={record.id}><span>{record.platform}</span><p><b>{record.name}</b><small>{record.text}</small></p><em>{record.topic}</em></div>)}</section>{done?<div className={styles.success}>{done}<button onClick={close}>Selesai</button></div>:<footer><button onClick={close}>Batal</button><button disabled={mode==='existing'?!findingId:!title.trim()||records.length<2} onClick={save}>{mode==='existing'?'Tambahkan Evidence':'Buat Finding'}</button></footer>}</ModalShell>
}
