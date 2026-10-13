'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type LiveItem = {
  id:string; externalId:string|null; source:string; url:string; canonicalUrl:string; title:string; excerpt:string|null; body:string|null;
  author:string|null; publisher:string|null; platform:string|null; language:string|null; country:string|null; location:string|null;
  publishedAt:string|null; capturedAt:string; firstSeenAt:string; lastSeenAt:string; topic:string|null; sentiment:string|null; severity:string|null;
  village:string|null; actor:string|null; translation:string|null; sourceGroup:string|null; evidenceType:string|null; sourceNote:string|null;
  validationStatus:string; validatedBy:string|null; validatedAt:string|null; classificationHistory:unknown[];
  reach:number|null; engagement:number|null;
  ai:{summary:string|null;recommendation:string|null;emotion:string|null;confidence:number|null;entities:string[]};
};

type LiveRule = {id:string;code:string;rule_type:string;value:string;source:string;scope:string;status:string;last_run_at:string|null;result_count:number;updated_at:string};
type LiveRun = {id:string;status:string;started_at:string|null;completed_at:string|null;rules_requested:number;items_received:number;items_inserted:number;items_duplicate:number;items_revised:number;error_message:string|null;created_at:string};
type LiveStore = {configured:boolean;loading:boolean;error:string|null;generatedAt:string|null;items:LiveItem[];rules:LiveRule[];runs:LiveRun[];refresh:()=>Promise<void>};

const Context=createContext<LiveStore|null>(null);

export function LiveIntelligenceProvider({children}:{children:ReactNode}){
  const [state,setState]=useState<Omit<LiveStore,'refresh'>>({configured:false,loading:true,error:null,generatedAt:null,items:[],rules:[],runs:[]});
  const refresh=useCallback(async()=>{
    setState(current=>({...current,loading:true,error:null}));
    try{
      const response=await fetch('/api/intelligence/live',{cache:'no-store'});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Data live gagal dimuat.');
      setState({configured:Boolean(payload.configured),loading:false,error:null,generatedAt:payload.generatedAt||null,items:payload.items||[],rules:payload.rules||[],runs:payload.runs||[]});
    }catch(error){setState(current=>({...current,loading:false,error:error instanceof Error?error.message:'Data live gagal dimuat.'}));}
  },[]);
  useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(),60_000);return()=>window.clearInterval(timer);},[refresh]);
  const value=useMemo(()=>({...state,refresh}),[state,refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useLiveIntelligence(){const value=useContext(Context);if(!value)throw new Error('LiveIntelligenceProvider unavailable');return value;}

export function formatLiveTime(value:string|null){
  if(!value)return 'Waktu tidak tersedia';
  return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Makassar'}).format(new Date(value));
}

export function liveText(item:LiveItem){return item.body||item.excerpt||item.title;}
