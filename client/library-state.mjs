import {validateProgress} from './engine.mjs';

export const STORAGE_KEY='cijian-library-v2';
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const bounded=(v,min,max,fallback)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
export function freshLibrary(){return {version:2,bookmarks:[],familiarity:{},readings:{},answers:{},fontSize:22,mode:'study',lastStory:'story-0001'};}
export function validateLibrary(raw,wordIds,storyIds,answerKeys){
 const next=freshLibrary(),ids=new Set(wordIds),books=new Set(storyIds);
 if(!record(raw)||raw.version!==2)return next;
 next.bookmarks=[...new Set((Array.isArray(raw.bookmarks)?raw.bookmarks:[]).filter(id=>ids.has(id)))];
 for(const [id,value] of Object.entries(record(raw.familiarity)?raw.familiarity:{}))if(ids.has(id)&&['new','fuzzy','known'].includes(value))next.familiarity[id]=value;
 for(const [id,value] of Object.entries(record(raw.readings)?raw.readings:{}))if(books.has(id)&&record(value))next.readings[id]={scrollY:bounded(value.scrollY,0,1e7,0),ratio:bounded(value.ratio,0,1,0)};
 for(const [id,value] of Object.entries(record(raw.answers)?raw.answers:{}))if(books.has(id)&&record(value)){
  const allowed=answerKeys===undefined?ids:new Set(Array.isArray(answerKeys?.[id])?answerKeys[id]:[]);
  next.answers[id]=Object.fromEntries(Object.entries(value).filter(([key,v])=>allowed.has(key)&&typeof v==='string'&&v.length<200));
 }
 next.fontSize=bounded(raw.fontSize,18,30,22);next.mode=['study','hide','cloze'].includes(raw.mode)?raw.mode:'study';
 if(books.has(raw.lastStory))next.lastStory=raw.lastStory;
 return next;
}
export function migrateLegacy(raw,wordIds,storyIds,answerKeys){
 const old=validateProgress(raw,wordIds),next=freshLibrary();
 Object.assign(next,{bookmarks:old.bookmarks,familiarity:old.familiarity,fontSize:old.fontSize,mode:old.mode,lastStory:'last-page-excerpt'});
 next.readings['last-page-excerpt']={scrollY:old.scrollY,ratio:old.readRatio};next.answers['last-page-excerpt']=old.answers;
 return validateLibrary(next,wordIds,storyIds,answerKeys);
}
export function loadLibrary(storage,wordIds,storyIds,answerKeys){
 try{const raw=storage.getItem(STORAGE_KEY);if(raw!==null){const parsed=JSON.parse(raw);if(parsed.version!==2)throw Error('version');return {data:validateLibrary(parsed,wordIds,storyIds,answerKeys),error:null};}
 const old=storage.getItem('cijian-progress-v1');return {data:old?migrateLegacy(JSON.parse(old),wordIds,storyIds,answerKeys):freshLibrary(),error:null};
 }catch{return {data:freshLibrary(),error:'学习记录暂时无法读取。可从设置导入备份；原记录未被删除。'};}
}
export function saveLibrary(storage,data){try{storage.setItem(STORAGE_KEY,JSON.stringify(data));return true;}catch{return false;}}
