'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { collectPartitionedLivePages, type LivePage } from '../../lib/live-pagination';

export type LiveItem = {
  id:string; externalId:string|null; source:string; url:string; canonicalUrl:string; title:string; excerpt:string|null; body:string|null;
  author:string|null; publisher:string|null; platform:string|null; language:string|null; country:string|null; location:string|null;
  publishedAt:string|null; capturedAt:string; firstSeenAt:string; lastSeenAt:string; topic:string|null; sentiment:string|null; severity:string|null;
  village:string|null; actor:string|null; translation:string|null; sourceGroup:string|null; evidenceType:string|null; sourceNote:string|null;
  validationStatus:string; validatedBy:string|null; validatedAt:string|null; viewedAt:string|null; classificationHistory:unknown[];
  reach:number|null; engagement:number|null; mediaPartner:boolean;
  ai:{summary:string|null;finding:string|null;recommendation:string|null;emotion:string|null;confidence:number|null;entities:string[];provider:string|null;model:string|null;enrichedAt:string|null};
};

type LiveRule = {id:string;code:string;rule_type:string;value:string;source:string;scope:string;status:string;last_run_at:string|null;result_count:number;updated_at:string};
type LiveRun = {id:string;status:string;started_at:string|null;completed_at:string|null;rules_requested:number;items_received:number;items_inserted:number;items_duplicate:number;items_revised:number;error_message:string|null;created_at:string};
type LiveStore = {configured:boolean;loading:boolean;error:string|null;generatedAt:string|null;items:LiveItem[];overviewItems:LiveItem[]|null;overviewAt:string|null;overviewCached:boolean;rules:LiveRule[];runs:LiveRun[];refresh:()=>Promise<void>};
type LiveResponse = LivePage<LiveItem> & { configured: boolean; generatedAt?: string; rules?: LiveRule[]; runs?: LiveRun[]; error?: string };

const Context=createContext<LiveStore|null>(null);
const overviewCacheKey='cluefy-overview-v1';
const overviewCacheMaxAge=2*60_000;
function cacheOverview(items:LiveItem[],at:string|null){
  if(!at)return;
  try{
    const compact=items.map(item=>({...item,url:item.canonicalUrl||item.url,canonicalUrl:'',externalId:null,body:null,excerpt:null,translation:null,sourceNote:null,actor:null,classificationHistory:[],ai:{summary:null,finding:null,recommendation:null,emotion:null,confidence:null,entities:[],provider:null,model:null,enrichedAt:null}}));
    sessionStorage.setItem(overviewCacheKey,JSON.stringify({savedAt:Date.now(),at,items:compact}));
  }catch{/* cache is optional */}
}

export function LiveIntelligenceProvider({children}:{children:ReactNode}){
  const [state,setState]=useState<Omit<LiveStore,'refresh'>>({configured:false,loading:true,error:null,generatedAt:null,items:[],overviewItems:null,overviewAt:null,overviewCached:false,rules:[],runs:[]});
  const inFlight=useRef<Promise<void>|null>(null);
  const hasFullData=useRef(false);
  const refresh=useCallback(()=>{
    if(inFlight.current)return inFlight.current;
    inFlight.current=(async()=>{
    setState(current=>({...current,loading:true,error:null}));
    try{
      const read=async(cursor:string|null,snapshot:string|null,shard:string,overview:boolean)=>{
        const params=new URLSearchParams();
        params.set('shard',shard);
        if(overview)params.set('overview','1');
        if(cursor)params.set('cursor',cursor);
        if(snapshot)params.set('snapshot',snapshot);
        const response=await fetch(`/api/intelligence/live${params.size?`?${params}`:''}`,{cache:'no-store'});
        const page:LiveResponse=await response.json();
        if(!response.ok)throw new Error(page.error||'Data live gagal dimuat.');
        return page;
      };
      let serverSnapshot:string|undefined;
      try{
        const response=await fetch('/api/intelligence/live?clock=1',{cache:'no-store'});
        const clock=await response.json();
        if(response.ok&&typeof clock.snapshot==='string'&&Number.isFinite(Date.parse(clock.snapshot)))serverSnapshot=clock.snapshot;
      }catch{/* Fall back to obtaining the snapshot from the first page. */}
      if(!hasFullData.current)try {
        const overview=await collectPartitionedLivePages<LiveItem,LiveResponse>((cursor,snapshot,shard)=>read(cursor,snapshot,shard,true),serverSnapshot);
        if(overview.configured){
          overview.items.sort((a,b)=>Date.parse(b.publishedAt||b.capturedAt)-Date.parse(a.publishedAt||a.capturedAt)||b.id.localeCompare(a.id));
          const at=overview.generatedAt||null;
          setState(current=>current.items.length?current:{...current,configured:true,overviewItems:overview.items,overviewAt:at,overviewCached:false});
          cacheOverview(overview.items,at);
        }
      } catch {/* Full data remains the fallback if the summary is unavailable. */}
      const payload=await collectPartitionedLivePages<LiveItem,LiveResponse>((cursor,snapshot,shard)=>read(cursor,snapshot,shard,false),serverSnapshot);
      if(!payload.configured)throw new Error('Sumber data belum terhubung.');
      payload.items.sort((a,b)=>Date.parse(b.publishedAt||b.capturedAt)-Date.parse(a.publishedAt||a.capturedAt)||b.id.localeCompare(a.id));
      hasFullData.current=true;
      cacheOverview(payload.items,payload.generatedAt||null);
      setState({configured:Boolean(payload.configured),loading:false,error:null,generatedAt:payload.generatedAt||null,items:payload.items||[],overviewItems:null,overviewAt:null,overviewCached:false,rules:payload.rules||[],runs:payload.runs||[]});
    }catch(error){setState(current=>({...current,loading:false,error:error instanceof Error?error.message:'Data live gagal dimuat.'}));}
    finally{inFlight.current=null;}
    })();
    return inFlight.current;
  },[]);
  useEffect(()=>{
    try{
      const cached=JSON.parse(sessionStorage.getItem(overviewCacheKey)||'null');
      if(cached&&Array.isArray(cached.items)&&typeof cached.savedAt==='number'&&Date.now()-cached.savedAt>=0&&Date.now()-cached.savedAt<overviewCacheMaxAge&&typeof cached.at==='string'&&Number.isFinite(Date.parse(cached.at)))
        setState(current=>({...current,configured:true,overviewItems:cached.items,overviewAt:cached.at,overviewCached:true}));
    }catch{/* cache is optional */}
    void refresh();const timer=window.setInterval(()=>void refresh(),60_000);return()=>window.clearInterval(timer);
  },[refresh]);
  const value=useMemo(()=>({...state,refresh}),[state,refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLiveIntelligence(){const value=useContext(Context);if(!value)throw new Error('LiveIntelligenceProvider unavailable');return value;}

export function formatLiveTime(value:string|null){
  if(!value)return 'Waktu tidak tersedia';
  return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Makassar'}).format(new Date(value));
}

export function liveText(item:LiveItem){return item.body||item.excerpt||item.title;}
