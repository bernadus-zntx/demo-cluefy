import {createContext,useContext,useState,useEffect,useCallback,useMemo,type ReactNode} from 'react';
export type {LiveItem} from '../../app/intelligence/LiveIntelligence';
import type {LiveItem} from '../../app/intelligence/LiveIntelligence';
const Context=createContext<any>(null);
// Only the existing seven-column endpoint is used. No privileged SDK or API routes.
export function LiveIntelligenceProvider({children}:{children:ReactNode}){
 const [state,setState]=useState({configured:false,loading:true,error:null as string|null,generatedAt:null as string|null,items:[] as LiveItem[],overviewItems:null,overviewAt:null,overviewCached:false,rules:[],runs:[]});
 const refresh=useCallback(async()=>{
  setState(s=>({...s,loading:true,error:null}));
  try{
   const response=await fetch('/api/items',{cache:'no-store'});const data=await response.json();
   if(!response.ok)throw Error(data.error||'Data Sales gagal dimuat.');
   const items:LiveItem[]=data.items.map((row:any)=>({
    id:row.id,title:row.title||'',excerpt:row.excerpt,publisher:row.publisher,platform:row.platform,location:row.location,
    publishedAt:row.published_at,capturedAt:row.published_at||data.fetchedAt,firstSeenAt:row.published_at||data.fetchedAt,lastSeenAt:row.published_at||data.fetchedAt,
    source:row.platform||row.publisher||'Tidak diketahui',url:'',canonicalUrl:'',externalId:null,body:null,author:null,language:null,country:null,
    topic:null,sentiment:null,severity:null,village:null,actor:null,translation:null,sourceGroup:null,evidenceType:null,sourceNote:null,comments:null,
    validationStatus:'unreviewed',validatedBy:null,validatedAt:null,viewedAt:null,classificationHistory:[],reach:null,engagement:null,mediaPartner:false,
    ai:{summary:null,finding:null,recommendation:null,emotion:null,confidence:null,entities:[],provider:null,model:null,enrichedAt:null}
   }));
   setState(s=>({...s,configured:true,loading:false,error:null,generatedAt:data.fetchedAt,items}));
  }catch(error){setState(s=>({...s,items:[],configured:false,loading:false,error:error instanceof Error?error.message:'Data gagal dimuat.'}));}
 },[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),60000);return()=>clearInterval(timer)},[refresh]);
 const value=useMemo(()=>({...state,refresh}),[state,refresh]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLiveIntelligence(){const value=useContext(Context);if(!value)throw Error('LiveIntelligenceProvider unavailable');return value;}
export function formatLiveTime(value:string|null){
  if(!value)return 'Waktu tidak tersedia';
  return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Makassar'}).format(new Date(value));
}

export function liveText(item:LiveItem){return item.body||item.excerpt||item.title;}
