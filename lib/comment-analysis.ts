export type PublicComment={id:string;text:string;author:string|null;sentiment:'Positive'|'Neutral'|'Negative'|null;likes:number|null};
export function parsePublicComments(value:unknown):PublicComment[]|null{
  if(!Array.isArray(value))return null;
  return value.flatMap((entry,index)=>{
    if(!entry||typeof entry!=='object')return [];
    const comment=entry as Record<string,unknown>;const text=typeof comment.text==='string'?comment.text.trim():'';
    if(!text)return [];
    const sentiment=comment.sentiment==='Positive'||comment.sentiment==='Neutral'||comment.sentiment==='Negative'?comment.sentiment:null;
    return [{id:typeof comment.id==='string'?comment.id:String(index),text,author:typeof comment.author==='string'?comment.author:null,sentiment,likes:typeof comment.likes==='number'&&Number.isFinite(comment.likes)&&comment.likes>=0?comment.likes:null}];
  });
}
export function summarizeComments(comments:PublicComment[]){
  const ranked=(sentiment:'Positive'|'Negative')=>comments.filter(comment=>comment.sentiment===sentiment).sort((a,b)=>(b.likes??-1)-(a.likes??-1)).slice(0,5);
  return {total:comments.length,positive:comments.filter(comment=>comment.sentiment==='Positive').length,negative:comments.filter(comment=>comment.sentiment==='Negative').length,neutral:comments.filter(comment=>comment.sentiment==='Neutral').length,unknown:comments.filter(comment=>!comment.sentiment).length,positiveTop:ranked('Positive'),negativeTop:ranked('Negative')};
}
