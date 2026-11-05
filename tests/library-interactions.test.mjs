import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {freshLibrary} from '../client/library-state.mjs';
import {memberStorageKey} from '../client/member-storage.mjs';

const appUrl=new URL('../client/app.mjs',import.meta.url);
const source=fs.readFileSync(appUrl,'utf8');
const imports={};
for(const match of source.matchAll(/^import \{([^}]+)\} from '([^']+)';/gm)){
 const module=await import(new URL(match[2],appUrl));
 for(const part of match[1].split(',')){const [name,alias]=part.trim().split(/\s+as\s+/);imports[alias||name]=module[name];}
}
const fixture={id:'story-0001',title:'两处修理',genre:'日常',label:'完整短篇',kind:'original',coverIndex:0,focusCount:1,sections:['先前','现在'],words:[{id:'repair',en:'repairs',zh:'修理',pos:'n.',paragraph:0,accepted:['repairs','repair']}],paragraphs:[{text:'The [[t0-0]] were finished.',tokens:{'t0-0':{id:'repair',en:'repairs',zh:'修理',pos:'n.'}}},{text:'We [[t1-0]] the door.',tokens:{'t1-0':{id:'repair',en:'repair',zh:'修复',pos:'v.'}}}]};

async function app(hash='#reader/story-0001', catalogs=[], ielts={}, overrides={}){
 const events={},windowEvents={},elements=new Map(),records=new Map(Object.entries(overrides.records||{}));let downloaded,reloads=0;
 function element(){
  let html='',buttons=[];const listeners={};
  return {textContent:'',open:false,hidden:false,scrollCalls:0,classList:{add(){},remove(){}},focus(){},addEventListener(name,fn){listeners[name]=fn;},querySelector(){return null;},showModal(){this.open=true;},close(){this.open=false;listeners.close?.();},scrollIntoView(){this.scrollCalls++;},
   get innerHTML(){return html;},set innerHTML(value){html=value;buttons=[...value.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([,attrs,body])=>{const values=Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));return {dataset:Object.fromEntries(Object.entries(values).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5),v])),disabled:false,innerHTML:body,setAttribute(k,v){values[k]=String(v);},getAttribute:k=>values[k]};});},
   querySelectorAll(selector){const action=selector.match(/^\[data-action="([^"]+)"\]$/)?.[1];return action?buttons.filter(b=>b.dataset.action===action):[];}};
 }
 const get=selector=>{if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);};
 const context={...imports,...overrides.imports,library:{books:[fixture],lexicon:[{id:'repair',en:'repair',zh:'修理',tracks:['cet4'],used:true}],catalogs,ielts,stats:{loaded:1,used:1,unused:0,target:5500,coverage:100},...overrides.library},createPronunciationPlayer:()=>({stop(){},play(){}}),pronunciationSources:{},
  document:{querySelector:get,getElementById:id=>get(`#${id}`),querySelectorAll:selector=>[...elements.values()].flatMap(e=>e.querySelectorAll(selector)),addEventListener:(name,fn)=>events[name]=fn,createElement:()=>({click(){}}),activeElement:null},
  window:{cijianSession:{user:{id:'test-user',phone:'13800000000',active:true},admin:false,csrf:'test-csrf'},localStorage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)},scrollY:0,scrollTo(){},addEventListener:(name,fn)=>windowEvents[name]=fn},location:{hash,reload(){reloads++;}},requestAnimationFrame:fn=>fn(),setTimeout:()=>1,clearTimeout(){},Blob,URL:{createObjectURL:blob=>{downloaded=blob;return 'blob:test';},revokeObjectURL(){}}};
 vm.runInNewContext(source.replace(/^import .*?;\r?\n/gm,''),context);
 const click=dataset=>events.click({target:{closest:()=>({dataset,disabled:false})}});
 return {click,get,records,navigate(hash){context.location.hash=hash;windowEvents.hashchange();},reloads:()=>reloads,hash:()=>context.location.hash,title:()=>context.document.title,input:(key,value)=>events.input({target:{dataset:{answer:key},value}}),search:value=>events.input({target:{id:'notebook-search',type:'search',dataset:{},value,selectionStart:value.length}}),download:()=>downloaded.text()};
}

test('notebook search matches case, surrounding spaces, full-width English and Chinese without changing records',async()=>{
 const reader=await app();reader.click({action:'bookmark',id:'repair'});
 const saved=Object.fromEntries(reader.records);
 const ui=await app('#notebook',[],{},{records:saved});
 for(const query of ['repairs','REPAIRS','  repairs  ','ＲＥＰＡＩＲＳ','修理']){
  ui.search(query);
  assert.match(ui.get('#main').innerHTML,/class="notebook-row"/,query);
 }
 ui.search('unmatched');
 assert.doesNotMatch(ui.get('#main').innerHTML,/class="notebook-row"/);
 ui.click({action:'clear-search'});
 assert.match(ui.get('#main').innerHTML,/class="notebook-row"/);
 assert.deepEqual(Object.fromEntries(ui.records),saved);
});

test('two occurrences of one lemma have independent correct answers and are counted as two blanks',async()=>{
 const ui=await app();ui.click({action:'mode',mode:'cloze'});
 assert.match(ui.get('#main').innerHTML,/data-answer="t0-0"/);
 assert.match(ui.get('#main').innerHTML,/data-answer="t1-0"/);
 ui.input('t0-0','repairs');ui.input('t1-0','repair');ui.click({action:'check-answers'});
 assert.match(ui.get('#main').innerHTML,/已填写 2\/2 处 · 正确 2 处/);
 assert.equal((ui.get('#main').innerHTML.match(/class="cloze-input correct"/g)||[]).length,2);
 ui.input('t0-0','repair');ui.click({action:'check-answers'});
 assert.match(ui.get('#main').innerHTML,/已填写 2\/2 处 · 正确 1 处/);
});

test('bookmarking in the mobile vocabulary modal updates its button in place',async()=>{
 const ui=await app();ui.click({action:'words'});
 const button=ui.get('#modal-content').querySelectorAll('[data-action="bookmark"]')[0];
 ui.click({action:'bookmark',id:'repair'});
 assert.equal(button.getAttribute('aria-pressed'),'true');assert.match(button.innerHTML,/已收藏/);
 ui.click({action:'bookmark',id:'repair'});
 assert.equal(button.getAttribute('aria-pressed'),'false');assert.match(button.innerHTML,/加入生词本/);
});

test('exported notebook CSV keeps version-two familiarity and bookmark state',async()=>{
 const ui=await app();ui.click({action:'bookmark',id:'repair'});ui.click({action:'familiarity',id:'repair',level:'known'});ui.click({action:'export-csv'});
 assert.match(await ui.download(),/"repairs","修理","已掌握","是"/);
});

test('bookmarking and rating a later occurrence retain its word form and contextual meaning',async()=>{
 const ui=await app();ui.click({action:'word',id:'repair',book:'story-0001',paragraph:'1',token:'t1-0'});
 for(const action of [{action:'bookmark',id:'repair'},{action:'familiarity',id:'repair',level:'known'}]){
  ui.click(action);
  assert.match(ui.get('#modal-content').innerHTML,/<h2 id="modal-title" lang="en">repair<\/h2>/);
  assert.match(ui.get('#modal-content').innerHTML,/<h3 class="modal-meaning">v\. 修复<\/h3>/);
 }
});

test('returning from a word card scrolls to the selected occurrence instead of the first lemma match',async()=>{
 const ui=await app();ui.click({action:'word',id:'repair',book:'story-0001',paragraph:'1',token:'t1-0'});
 const button=ui.get('#modal-content').querySelectorAll('[data-action="context"]')[0];
 ui.click(button.dataset);
 assert.equal(ui.get('#paragraph-1').scrollCalls,1);
 assert.equal(ui.get('#paragraph-0').scrollCalls,0);
});


test('high school route displays its catalog without recording it as a read original', async()=>{
 const catalog={id:'gaokao-book-01',course:'高中',no:1,title:'雨后的图书馆',intro:'公开目录简介',chapterCount:2,originalWordCount:100,sourceKind:'public-catalog',sourceUrl:'https://novel.quwanclass.com/gaokao/',chapters:[{no:1,title:'一封信'}]};
 const ui=await app('#gaokao',[catalog]);
 assert.equal(ui.title(),'高中英语小说 · ToTo趣味英语');
 assert.match(ui.get('#main').innerHTML,/雨后的图书馆/);
 assert.doesNotMatch(ui.get('#main').innerHTML,/#reader\/gaokao-book-01/);
 assert.equal(ui.records.size,0);
});


test('kaoyan route uses enriched reference data without adding reading or vocabulary records',async()=>{
 const catalog={id:'kaoyan-book-01',course:'考研',no:1,title:'考研目录测试标题',genre:'校园',intro:'目录简介',chapterCount:1,originalWordCount:99,sourceKind:'public-catalog',sourceUrl:'https://novel.quwanclass.com/kaoyan/'};
 const ui=await app('#kaoyan',[catalog]);
 assert.match(ui.title(),/考研英语小说/);
 assert.match(ui.get('#main').innerHTML,/考研目录测试标题/);
 assert.match(ui.get('#main').innerHTML,/kaoyan-catalog\.json/);
 assert.doesNotMatch(ui.get('#main').innerHTML,/#reader\/kaoyan-book-01/);
 assert.equal(ui.records.size,0);
});

test('IELTS home and subroutes render independent catalogs and never create learning records', async()=>{
 const catalogs=[{id:'ielts-book-01',course:'雅思',title:'短篇目录示例',no:1,genre:'奇幻',intro:'短篇简介'}];
 const ielts={courseUrl:'https://novel.quwanclass.com/ielts/',longNovel:{title:'京圈豪门弃女',parts:[{id:'part-01',no:'Part 01',title:'绝境觉醒',chapters:[{id:'story-001',no:1,title:'长篇开端',wordCount:100}]}]}};
 for(const [hash,title,expected] of [
  ['#ielts','我的雅思小说','浏览长篇目录'],
  ['#ielts/long','雅思长篇书架','长篇开端'],
  ['#ielts/long/part-01','绝境觉醒 · 雅思长篇','长篇开端'],
  ['#ielts/long/invalid','篇章未找到','href="#ielts/long"'],
  ['#ielts/long/part-01/extra','篇章未找到','href="#ielts/long"'],
  ['#ielts/short','雅思短篇合集','短篇目录示例'],
  ['#ielts/unknown','我的雅思小说','浏览短篇目录']
 ]){
  const ui=await app(hash,catalogs,ielts);
  assert.equal(ui.title(),`${title} · ToTo趣味英语`);
  assert.ok(ui.get('#main').innerHTML.includes(expected));
  assert.doesNotMatch(ui.get('#main').innerHTML,/#reader\//);
  assert.equal(ui.records.size,0);
 }
});

test('CET home offers real reading and learning links without writing progress',async()=>{
 const ui=await app('#cet');
 assert.equal(ui.title(),'我的四六级小说 · ToTo趣味英语');
 assert.match(ui.get('#main').innerHTML,/#reader\/story-0001/);
 assert.match(ui.get('#main').innerHTML,/#vocabulary\/cet4\/all/);
 assert.match(ui.get('#main').innerHTML,/#review\/notebook/);
 assert.equal(ui.records.size,0);
});

test('a saved answer enables consistent continuation in the CET hero and shared book card',async()=>{
 const reader=await app();
 reader.input('t0-0','repairs');
 const stored=Object.fromEntries(reader.records);
 const ui=await app('#cet',[],{},{records:stored});
 assert.match(ui.get('#main').innerHTML,/继续阅读/);
 assert.doesNotMatch(ui.get('#main').innerHTML,/开始阅读/);
 assert.deepEqual(Object.fromEntries(ui.records),stored);
});

test('unknown and inherited story identifiers cannot crash reader or review routes',async()=>{
 for(const route of ['reader','review'])for(const id of ['constructor','__proto__','toString','missing']){
  const ui=await app(`#${route}/${id}`);
  assert.match(ui.get('#main').innerHTML,/两处修理/);
  if(route==='review')assert.equal(ui.records.size,0);
 }
});

test('vocabulary deep links apply the requested track and usage, count shared words once, and clear text preserves scope',async()=>{
 const lexicon=[{id:'shared',en:'shared',zh:'共同',tracks:['cet4','cet6'],used:true},{id:'basic',en:'basic',zh:'基本',tracks:['cet4'],used:false},{id:'advanced',en:'advanced',zh:'进阶',tracks:['cet6'],used:false}];
 const override={library:{lexicon,stats:{loaded:3,used:1,unused:2,target:5500,coverage:33.33}}};
 const ui=await app('#vocabulary/cet4/unused',[],{},override);
 assert.equal(ui.title(),'四级词表 · ToTo趣味英语');
 let html=ui.get('#main').innerHTML;
 assert.match(html,/本词库 2 词 · 已使用 1 · 未使用 1/);
 assert.match(html,/<strong lang="en">basic<\/strong>/);
 assert.doesNotMatch(html,/<strong lang="en">(?:shared|advanced)<\/strong>/);
 ui.click({action:'clear-search'});
 html=ui.get('#main').innerHTML;
 assert.match(html,/value="cet4" selected/);
 assert.match(html,/value="unused" selected/);
 ui.click({action:'reset-vocabulary'});
 assert.match(ui.get('#main').innerHTML,/本词库 3 词/);
 assert.equal(ui.records.size,0);
 const invalid=await app('#vocabulary/nope/nope',[],{},override);
 assert.match(invalid.get('#main').innerHTML,/本词库 3 词/);
 assert.equal(invalid.title(),'四六级总词表 · ToTo趣味英语');
});

test('direct notebook review uses bookmarks, while direct story review uses that story without changing the last reading',async()=>{
 const empty=await app('#review/notebook');
 assert.match(empty.get('#main').innerHTML,/生词本还没有词/);
 assert.match(empty.get('#main').innerHTML,/切换至本篇词汇/);
 assert.equal(empty.records.size,0);
 const ui=await app('#review/story-0001');
 assert.match(ui.get('#main').innerHTML,/两处修理/);
 assert.match(ui.get('#main').innerHTML,/切换至生词本/);
 assert.equal(ui.records.size,0);
});


test('legacy progress is previewed before explicit import, scoped to this account, and preserved globally',async()=>{
 const legacy=JSON.stringify({...freshLibrary(),bookmarks:['repair']});
 const key=memberStorageKey('test-user',imports.STORAGE_KEY);
 const other=memberStorageKey('other-user',imports.STORAGE_KEY);
 const ui=await app('#cet',[],{},{records:{[imports.STORAGE_KEY]:legacy,[other]:'other account'}});
 assert.equal(ui.records.has(key),false);
 ui.click({action:'settings'});
 assert.match(ui.get('#modal-content').innerHTML,/不会自动归入任何账号/);
 ui.click({action:'import-legacy'});
 assert.match(ui.get('#modal-content').innerHTML,/将导入 1 个收藏词/);
 assert.equal(ui.records.has(key),false);
 ui.click({action:'close'});ui.click({action:'apply-import'});
 assert.equal(ui.records.has(key),false);
 ui.click({action:'settings'});ui.click({action:'import-legacy'});ui.click({action:'apply-import'});
 assert.deepEqual(JSON.parse(ui.records.get(key)).bookmarks,['repair']);
 assert.equal(ui.records.get(imports.STORAGE_KEY),legacy);
 assert.equal(ui.records.get(other),'other account');
});

test('membership administration uses its explicit route and disposes the previous page before mounting',async()=>{
 const calls=[];
 const ui=await app('#membership',[],{},{imports:{
  membershipPage:session=>{calls.push(['page',session.user.id]);return 'account page';},
  mountMembership:(_root,options)=>{calls.push(['mount',options.session.user.id]);return ()=>calls.push(['cleanup']);},
  membershipAdminPage:session=>{calls.push(['admin-page',session.user.id]);return 'admin page';},
  mountMembershipAdmin:(_root,options)=>{calls.push(['admin-mount',options.session.user.id]);return ()=>calls.push(['admin-cleanup']);},
 }});
 ui.navigate('#membership/admin');
 assert.equal(ui.title(),'会员管理 · ToTo趣味英语');assert.equal(ui.get('#main').innerHTML,'admin page');
 assert.deepEqual(calls,[['page','test-user'],['mount','test-user'],['cleanup'],['admin-page','test-user'],['admin-mount','test-user']]);
 ui.navigate('#cet');assert.deepEqual(calls.at(-1),['admin-cleanup']);
});

test('successful logout cleans the membership view, broadcasts session change, and reloads the sign-in route',async()=>{
 let options,cleanups=0;
 const ui=await app('#membership',[],{},{imports:{mountMembership:(_root,value)=>{options=value;return ()=>cleanups++;}}});
 options.onLogout();
 assert.equal(cleanups,1);assert.equal(ui.reloads(),1);assert.equal(ui.hash(),'#membership');
 assert.ok(ui.records.has(imports.SESSION_CHANGED_KEY));assert.match(ui.get('#main').innerHTML,/正在重新确认账号/);
 ui.navigate('#cet');assert.match(ui.get('#main').innerHTML,/正在重新确认账号/);
 assert.equal(ui.records.has(memberStorageKey('test-user',imports.STORAGE_KEY)),false);
});
