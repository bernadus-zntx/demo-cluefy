'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import type { Severity } from './model';
import styles from './cases.module.css';

type CaseStatus = 'Open' | 'In Progress' | 'Waiting Approval' | 'Actioned' | 'Monitoring' | 'Closed';
type CaseType = 'Issue' | 'Crisis' | 'Campaign' | 'Event' | 'Complaint' | 'Opportunity' | 'News' | 'Other';
type FindingSnapshot = { id: string; title: string; issue: string; severity: Severity; evidence: string; recommendation: string };
type CaseAction = { id: string; type: string; channel: string; draft: string; status: 'Draft' | 'Published'; publishedAt?: string; publishedUrl?: string };
type CaseRecord = {
  id: string; title: string; type: CaseType; severity: Severity; owner: string; team: string; status: CaseStatus;
  primaryOpd: string; collaborators: string[]; workflow: Array<{stage:string;status:'Done'|'Active'|'Waiting';sla:string;elapsed:string}>;
  objective: string; dueDate: string; updatedAt: string; findings: FindingSnapshot[]; actions: CaseAction[];
  timeline: string[]; impact: { label: string; beforeNegative: number; after24: number; after48: number; beforeVolume: number; afterVolume: number };
};

const seedCase: CaseRecord = {
  id: 'CASE-BDG-001', title: 'Kemacetan Koridor Kuta–Canggu', type: 'Issue', severity: 'High', owner: 'Dinas Perhubungan', team: 'Command Center Badung', status: 'Monitoring',
  primaryOpd: 'Dishub', collaborators: ['PUPR','Satpol PP','Diskominfo'], workflow: [
    {stage:'Laporan Masuk',status:'Done',sla:'1h',elapsed:'18m'},{stage:'Validasi',status:'Done',sla:'2h',elapsed:'1.2h'},{stage:'Assessment',status:'Done',sla:'8h',elapsed:'6.4h'},{stage:'Koordinasi Petugas',status:'Done',sla:'4h',elapsed:'2.1h'},{stage:'Tindakan',status:'Done',sla:'24h',elapsed:'18.6h'},{stage:'Monitoring',status:'Active',sla:'48h',elapsed:'31h'},{stage:'Selesai',status:'Waiting',sla:'—',elapsed:'—'},
  ],
  objective: 'Menyiapkan respons terkoordinasi untuk peningkatan percakapan negatif terkait kemacetan kawasan wisata.', dueDate: '08 Okt 2026', updatedAt: '04 Okt 2026 · 16:40',
  findings: [{ id: 'FND-ARCHIVE-001', title: 'Lonjakan keluhan kemacetan Kuta–Canggu', issue: 'Kemacetan & Transportasi', severity: 'High', evidence: 'Video demo, segmen 02:14–02:37', recommendation: 'Validasi kondisi lapangan dan siapkan informasi rekayasa lalu lintas.' }],
  actions: [{ id: 'ACT-001', type: 'Official Statement', channel: 'Instagram & Media Online', draft: 'Pemkab Badung sedang melakukan koordinasi penanganan kepadatan pada koridor Kuta–Canggu. Informasi rekayasa lalu lintas dan jalur alternatif akan diperbarui melalui kanal resmi.', status: 'Published', publishedAt: '04 Okt 2026 · 16:00', publishedUrl: 'Demo publication · no external URL' }],
  timeline: ['Finding FND-ARCHIVE-001 ditambahkan', 'Case ditugaskan ke Dinas Perhubungan', 'Official Statement disetujui', 'Action ditandai Published', 'Impact monitoring dimulai'],
  impact: { label: 'IMPROVING', beforeNegative: 72, after24: 49, after48: 31, beforeVolume: 1820, afterVolume: 1210 },
};

type CasesStore = {
  cases: CaseRecord[];
  createFromFinding: (finding: FindingSnapshot) => string;
  addAction: (caseId: string, action: Omit<CaseAction, 'id' | 'status'>) => void;
  publishAction: (caseId: string, actionId: string) => void;
};
const CasesContext = createContext<CasesStore | null>(null);

export function CasesProvider({children}:{children:ReactNode}) {
  const [cases,setCases]=useState<CaseRecord[]>([seedCase]);
  function createFromFinding(finding: FindingSnapshot) {
    const existing=cases.find(item=>item.findings.some(entry=>entry.id===finding.id));
    if(existing) return existing.id;
    const id=`CASE-BDG-${String(cases.length+1).padStart(3,'0')}`;
    const record:CaseRecord={id,title:finding.title,type:'Issue',severity:finding.severity,owner:'Belum ditugaskan',team:'Command Center Badung',status:'Open',primaryOpd:'Belum ditugaskan',collaborators:[],workflow:[{stage:'Laporan Masuk',status:'Active',sla:'1h',elapsed:'0h'},{stage:'Validasi',status:'Waiting',sla:'2h',elapsed:'—'},{stage:'Assessment',status:'Waiting',sla:'8h',elapsed:'—'},{stage:'Tindakan',status:'Waiting',sla:'24h',elapsed:'—'},{stage:'Monitoring',status:'Waiting',sla:'48h',elapsed:'—'},{stage:'Selesai',status:'Waiting',sla:'—',elapsed:'—'}],objective:`Menindaklanjuti finding terverifikasi: ${finding.issue}.`,dueDate:'Belum ditentukan',updatedAt:new Date().toLocaleString('id-ID'),findings:[finding],actions:[],timeline:[`Case dibuat dari ${finding.id}`],impact:{label:'AWAITING ACTION',beforeNegative:72,after24:72,after48:72,beforeVolume:1820,afterVolume:1820}};
    setCases(items=>[record,...items]); return id;
  }
  function addAction(caseId:string, action:Omit<CaseAction,'id'|'status'>){setCases(items=>items.map(item=>item.id===caseId?{...item,status:'Waiting Approval',updatedAt:new Date().toLocaleString('id-ID'),actions:[...item.actions,{...action,id:`${caseId}-ACT-${item.actions.length+1}`,status:'Draft'}],timeline:[...item.timeline,`${action.type} dibuat sebagai draft`]}:item));}
  function publishAction(caseId:string,actionId:string){setCases(items=>items.map(item=>item.id===caseId?{...item,status:'Monitoring',updatedAt:new Date().toLocaleString('id-ID'),actions:item.actions.map(action=>action.id===actionId?{...action,status:'Published',publishedAt:new Date().toLocaleString('id-ID'),publishedUrl:'Demo publication · no external URL'}:action),timeline:[...item.timeline,`${actionId} ditandai Published`,`Impact monitoring dimulai`]}:item));}
  return <CasesContext.Provider value={{cases,createFromFinding,addAction,publishAction}}>{children}</CasesContext.Provider>;
}

export function useCases(){const value=useContext(CasesContext);if(!value)throw new Error('Cases provider unavailable');return value;}

export function Cases(){
  const {cases}=useCases(); const [selected,setSelected]=useState<string|null>(null); const [status,setStatus]=useState('All');
  const shown=useMemo(()=>cases.filter(item=>status==='All'||item.status===status),[cases,status]);
  if(selected){const current=cases.find(item=>item.id===selected);if(current)return <CaseDetail value={current} close={()=>setSelected(null)}/>;}
  return <section className={styles.root}><div className={styles.heading}><div><h2>Cases</h2><p>Tindak lanjut operasional untuk finding yang sudah diverifikasi.</p></div><button className={styles.primary}>＋ Buat Case Manual</button></div>
    <div className={styles.metrics}><article><small>Open Cases</small><strong>{cases.filter(x=>x.status!=='Closed').length}</strong></article><article><small>Critical</small><strong>{cases.filter(x=>x.severity==='Critical').length}</strong></article><article><small>Waiting Approval</small><strong>{cases.filter(x=>x.status==='Waiting Approval').length}</strong></article><article><small>Monitoring</small><strong>{cases.filter(x=>x.status==='Monitoring').length}</strong></article></div>
    <div className={styles.filters}><label>Status<select value={status} onChange={event=>setStatus(event.target.value)}>{['All','Open','In Progress','Waiting Approval','Actioned','Monitoring','Closed'].map(value=><option key={value}>{value}</option>)}</select></label><label>Severity<select><option>Semua severity</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label><label>Owner<select><option>Semua owner</option><option>Dinas Perhubungan</option><option>Command Center</option></select></label><label>Type<select><option>Semua tipe</option><option>Issue</option><option>Crisis</option><option>Complaint</option></select></label></div>
    <section className={styles.table}><div className={styles.row}><b>CASE</b><b>TYPE</b><b>SEVERITY</b><b>OWNER</b><b>FINDINGS</b><b>STATUS</b><b>UPDATED</b></div>{shown.map(item=><button className={styles.row} key={item.id} onClick={()=>setSelected(item.id)}><span><strong>{item.title}</strong><small>{item.id}</small></span><span>{item.type}</span><span className={styles[item.severity.toLowerCase()]}>{item.severity}</span><span>{item.owner}</span><span>{item.findings.length}</span><span>{item.status}</span><span>{item.updatedAt}</span></button>)}</section>
  </section>;
}

function CaseDetail({value,close}:{value:CaseRecord;close:()=>void}){
  const {addAction,publishAction}=useCases(); const [tab,setTab]=useState('Overview'); const [draft,setDraft]=useState('');
  const tabs=['Overview','Workflow','Findings','Evidence','Actions','Timeline','Impact'];
  function generate(){setDraft(`Pemkab Badung menindaklanjuti ${value.title.toLowerCase()}. Tim terkait sedang memverifikasi kondisi lapangan dan menyiapkan langkah operasional. Pembaruan resmi akan disampaikan melalui kanal Pemerintah Kabupaten Badung.`);}
  return <section className={styles.root}><button className={styles.back} onClick={close}>← Kembali ke daftar Cases</button><div className={styles.caseHero}><div><small>{value.id} · {value.type}</small><h2>{value.title}</h2><p>{value.objective}</p></div><div><span>{value.severity}</span><b>{value.status}</b></div></div><nav className={styles.tabs}>{tabs.map(item=><button key={item} className={tab===item?styles.active:''} onClick={()=>setTab(item)}>{item}</button>)}</nav>
    {tab==='Overview'&&<div className={styles.grid}><section className={styles.panel}><h3>Case summary</h3><dl><div><dt>Owner</dt><dd>{value.owner}</dd></div><div><dt>Primary OPD</dt><dd>{value.primaryOpd}</dd></div><div><dt>Collaborating OPD</dt><dd>{value.collaborators.join(', ')||'Belum ditentukan'}</dd></div><div><dt>Team</dt><dd>{value.team}</dd></div><div><dt>Severity</dt><dd>{value.severity}</dd></div><div><dt>Status</dt><dd>{value.status}</dd></div><div><dt>Due / SLA</dt><dd>{value.dueDate}</dd></div><div><dt>Updated</dt><dd>{value.updatedAt}</dd></div></dl></section><section className={styles.panel}><h3>Operational objective</h3><p>{value.objective}</p><h3>Connected lifecycle</h3><p>Issue → approved Finding → Case → OPD workflow → Action → Impact.</p></section></div>}
    {tab==='Workflow'&&<section className={styles.panel}><h3>{value.primaryOpd} operational workflow</h3><p className={styles.muted}>Workflow, SLA, responsible team, dan escalation rule dapat dikonfigurasi per OPD.</p><div className={styles.workflow}>{value.workflow.map((step,index)=><article key={step.stage} className={styles[step.status.toLowerCase()]}><span>{index+1}</span><div><b>{step.stage}</b><small>{step.status}</small></div><p><small>SLA</small><strong>{step.sla}</strong></p><p><small>Elapsed</small><strong>{step.elapsed}</strong></p></article>)}</div></section>}
    {tab==='Findings'&&<section className={styles.panel}><h3>Related findings</h3>{value.findings.map(finding=><article className={styles.finding} key={finding.id}><div><small>{finding.id} · {finding.issue}</small><h4>{finding.title}</h4><p>{finding.recommendation}</p></div><span>{finding.severity}</span></article>)}</section>}
    {tab==='Evidence'&&<section className={styles.panel}><h3>Evidence</h3>{value.findings.map(finding=><article className={styles.evidence} key={finding.id}><Image src="/demo-kuta-traffic.svg" alt="Frame ilustrasi demo kemacetan Kuta" width={800} height={450}/><div><b>{finding.title}</b><p>{finding.evidence}</p><small>Controlled demo evidence · sumber asli belum ditautkan</small></div></article>)}</section>}
    {tab==='Actions'&&<div className={styles.grid}><section className={styles.panel}><h3>Create Action</h3><label>Action type<select><option>Official Statement</option><option>Media / Social Post</option><option>Press Release</option><option>Internal Brief</option><option>Create Task</option></select></label><label>Target channel<select><option>Instagram & Media Online</option><option>WhatsApp Management Group</option><option>Internal</option></select></label><label>Draft<textarea rows={7} value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Generate atau tulis draft…"/></label><div className={styles.actions}><button onClick={generate}>✦ Generate AI Draft</button><button disabled={!draft.trim()} onClick={()=>{addAction(value.id,{type:'Official Statement',channel:'Instagram & Media Online',draft});setDraft('');}}>Simpan Draft</button></div><small>AI tidak mempublikasikan otomatis. Draft tetap membutuhkan review manusia.</small></section><section className={styles.panel}><h3>Action history</h3>{value.actions.map(action=><article className={styles.actionCard} key={action.id}><small>{action.id} · {action.channel}</small><h4>{action.type}</h4><p>{action.draft}</p><div><span>{action.status}</span>{action.status==='Draft'&&<button onClick={()=>publishAction(value.id,action.id)}>Mark as Published</button>}</div>{action.publishedAt&&<small>Published {action.publishedAt} · {action.publishedUrl}</small>}</article>)}</section></div>}
    {tab==='Timeline'&&<section className={styles.panel}><h3>Audit & activity timeline</h3><ol className={styles.timeline}>{value.timeline.map((entry,index)=><li key={`${entry}-${index}`}>{entry}</li>)}</ol></section>}
    {tab==='Impact'&&<section className={styles.panel}><div className={styles.impactHead}><div><small>POST ACTION MONITORING</small><h3>{value.impact.label} ↑</h3></div><p>Controlled demo data sampai pengukuran produksi tersedia.</p></div><div className={styles.impactMetrics}><article><small>Negative sentiment</small><strong>{value.impact.beforeNegative}%</strong><span>Before</span></article><i>→</i><article><small>24h after</small><strong>{value.impact.after24}%</strong><span>−{value.impact.beforeNegative-value.impact.after24} poin</span></article><i>→</i><article><small>48h after</small><strong>{value.impact.after48}%</strong><span>−{value.impact.beforeNegative-value.impact.after48} poin</span></article></div><div className={styles.bars}><p><span>Before action</span><i><em style={{width:`${value.impact.beforeNegative}%`}}/></i><b>{value.impact.beforeNegative}% negatif</b></p><p><span>24h after</span><i><em style={{width:`${value.impact.after24}%`}}/></i><b>{value.impact.after24}% negatif</b></p><p><span>48h after</span><i><em style={{width:`${value.impact.after48}%`}}/></i><b>{value.impact.after48}% negatif</b></p></div><p>Volume percakapan: {value.impact.beforeVolume.toLocaleString('id-ID')} sebelum respons → {value.impact.afterVolume.toLocaleString('id-ID')} setelah 48 jam.</p></section>}
  </section>;
}
