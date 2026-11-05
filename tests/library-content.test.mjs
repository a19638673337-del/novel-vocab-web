import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {library} from '../client/library-data.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const project=path.resolve(root,'..','小说背词项目');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const state=readJson(path.join(project,'state.json'));
const sources=Object.fromEntries(Object.keys(state.articles).map(id=>[id,readJson(path.join(project,'drafts',id,'source.json'))]));
const lexiconIds=new Set(state.lexicon.entries.map(entry=>entry.id));
const normalizeLines=text=>text.replace(/\r\n/g,'\n');
const token=/\[\[([^|]+)\|([^|]+)\|([^|]+)\|([^\]]+)\]\]/g;
const placeholders=/\[\[([\w-]+)\]\]/g;
const localPython=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe');
const python=process.env.CODEX_PYTHON||(fs.existsSync(localPython)?localPython:'python');

function verify(articleId,article=state.articles[articleId],source=sources[articleId]){
 const result=spawnSync(python,['-X','utf8','-c',
  'import json,runpy,sys; m=runpy.run_path(sys.argv[1]); x=json.load(sys.stdin); m["verify_source"](x["id"],x["article"],x["source"],{k:None for k in x["entries"]})',
  path.join(root,'scripts','build-library.py')],{
  input:JSON.stringify({id:articleId,article,source,entries:[...lexiconIds]}),encoding:'utf8',maxBuffer:1024*1024});
 if(result.error)throw result.error;
 return result;
}

test('every recorded original has complete exported narrative, token cards and matching download',()=>{
 assert.deepEqual(library.books.map(book=>book.id).sort(),Object.keys(state.articles).sort());
 for(const book of library.books){
  const source=sources[book.id],article=state.articles[book.id];
  assert.equal(book.kind,'original');assert.equal(book.title,article.title);
  assert.equal(book.paragraphs.length,source.paragraphs.length);
  assert.deepEqual(book.sections,source.paragraphs.map(paragraph=>paragraph.role));
  const focusIds=new Set();
  book.paragraphs.forEach((paragraph,index)=>{
   const expected=source.paragraphs[index].text.replace(token,(_,surface,id,zh)=>`${surface}（${zh}）`);
   const keys=[...paragraph.text.matchAll(placeholders)].map(match=>match[1]);
   assert.deepEqual(keys,Object.keys(paragraph.tokens));
   const actual=paragraph.text.replace(placeholders,(_,key)=>{
    const item=paragraph.tokens[key];assert.ok(lexiconIds.has(item.id));focusIds.add(item.id);
    return `${item.en}（${item.zh}）`;
   });
   assert.equal(actual,expected,`${book.id} paragraph ${index+1}`);
   assert.equal(paragraph.translation,source.paragraphs[index].zh||'');
  });
  assert.equal(book.focusCount,focusIds.size);
  assert.equal(book.words.length,focusIds.size);
  assert.deepEqual(new Set(book.words.map(word=>word.id)),focusIds);
  for(const word of book.words){
   assert.ok(Object.values(book.paragraphs[word.paragraph].tokens).some(item=>item.id===word.id&&item.en===word.en&&item.zh===word.zh));
  }
  const download=fs.readFileSync(path.join(root,'client','downloads',`${book.id}.md`),'utf8');
  assert.equal(normalizeLines(download),normalizeLines(article.article_markdown));
 }
});

test('coverage is the union of recorded uses, with the frozen lexicon as denominator',()=>{
 const used=new Set(Object.values(state.articles).flatMap(article=>article.usage.uses.map(row=>row.id)));
 assert.ok([...used].every(id=>lexiconIds.has(id)));
 assert.equal(library.stats.originalCount,Object.keys(state.articles).length);
 assert.equal(library.stats.loaded,lexiconIds.size);
 assert.equal(library.stats.used,used.size);
 assert.equal(library.stats.unused,lexiconIds.size-used.size);
 assert.equal(library.stats.coverage,Number((used.size/lexiconIds.size*100).toFixed(2)));
 assert.deepEqual(new Set(library.lexicon.map(word=>word.id)),lexiconIds);
 assert.equal(library.lexicon.length,lexiconIds.size);
 for(const word of library.lexicon)assert.equal(word.used,used.has(word.id));
 for(const book of library.books){
  const verified=new Set(state.articles[book.id].usage.uses.map(row=>row.id));
  assert.equal(book.verifiedCount,verified.size);
  assert.ok(book.words.every(word=>verified.has(word.id)));
 }
});

test('public catalog ids are unique across courses and preserve their original source metadata',()=>{
 assert.equal(new Set(library.catalogs.map(book=>book.id)).size,library.catalogs.length);
 assert.equal(library.stats.sourceCatalogCount,library.catalogs.length);
 for(const {file,course,prefix} of readJson(path.join(root,'catalog-sources.json'))){
  const source=readJson(path.join(root,file));
  const exported=library.catalogs.filter(book=>book.course===course);
  assert.equal(exported.length,source.books.length);
  for(const original of source.books){
   const item=exported.find(book=>book.sourceId===original.id);
   assert.ok(item);assert.equal(item.id,`${prefix}-${original.id}`);
   assert.equal(item.title,original.title);assert.equal(item.sourceUrl,source.courseUrl||source.source);
   assert.equal(item.originalWordCount,original.wordCount??null);assert.equal(item.status,'reference');
   assert.equal(item.sourceKind,source.kind);
   if(source.kind==='public-title-index'){
    assert.equal(item.originalWordCount,null);assert.equal(item.genre,null);assert.equal(item.chapterCount,null);
   }
   assert.ok(!library.books.some(book=>book.id===item.id));
  }
 }
 assert.deepEqual(readJson(path.join(root,'client','downloads','reference-catalog.json')),library.catalogs);
 assert.deepEqual(readJson(path.join(project,'reference-catalog.json')).entries,library.catalogs);
});

test('kaoyan enrichment preserves historical titles and separates reported counts from readable content',()=>{
 const source=readJson(path.join(root,'competitor-kaoyan-catalog-public.json'));
 const old=readJson(path.join(root,'competitor-kaoyan-title-index-public.json'));
 const books=library.catalogs.filter(book=>book.course==='考研');
 assert.equal(books.length,56);assert.equal(source.kind,'public-catalog');
 assert.deepEqual(source.books.map(book=>[book.id,book.title]),old.books.map(book=>[book.id,book.title]));
 assert.deepEqual(source.missingFields,['chapters']);
 for(const item of books){
  const original=source.books.find(book=>book.id===item.sourceId);
  for(const field of ['no','title','genre','intro','chapterCount','wordCount','cover'])assert.equal(item[field],original[field]);
  assert.equal(item.sourceKind,'public-catalog');assert.equal(item.status,'reference');
  assert.ok(item.intro.length>0&&item.genre.length>0);
  assert.equal(item.chapterCount,1);assert.ok(item.wordCount>=85&&item.wordCount<=130);
  assert.ok(!('chapters' in item));assert.ok(!('paragraphs' in item));assert.ok(!('words' in item));
 }
 const download=readJson(path.join(root,'client','downloads','kaoyan-catalog.json'));
 assert.deepEqual(download.books,books);assert.equal(download.contentAccess,'metadata-only');
 assert.equal(library.stats.sourceCatalogCount,247);assert.equal(library.stats.originalCount,7);
 assert.equal(library.stats.loaded,3162);assert.equal(library.stats.used,596);assert.equal(library.stats.coverage,18.85);
 assert.equal(library.ielts.vocabulary.entries.length,50);
});

test('high-school catalog applies public display corrections and keeps chapters as reference metadata',()=>{
 const source=readJson(path.join(root,'competitor-gaokao-catalog-public.json'));
 const historical=readJson(path.join(root,'competitor-gaokao-title-index-public.json'));
 const exported=library.catalogs.filter(book=>book.course==='高中');
 assert.equal(source.kind,'public-catalog');assert.equal(exported.length,38);
 assert.deepEqual(source.books.map(book=>[book.id,book.title]),historical.books.map(book=>[book.id,book.title]));
 assert.equal(exported.reduce((sum,book)=>sum+book.chapters.length,0),184);
 assert.equal(exported.reduce((sum,book)=>sum+book.wordCount,0),3849);
 assert.equal(source.extraction.correctedBookCount,28);
 for(const original of source.books){
  const item=exported.find(book=>book.sourceId===original.id),correction=source.countCorrections[original.id];
  assert.equal(item.chapterCount,correction.sectionCount??original.rawCounts.chapterCount);
  assert.equal(item.wordCount,correction.wordCount??original.rawCounts.wordCount);
  assert.equal(item.chapterCount,item.chapters.length);assert.equal(item.genre,null);
  assert.equal(item.intro,original.intro);assert.ok(item.intro.length>0);
  assert.equal(item.cover,original.cover);assert.equal(new URL(item.cover).hostname,'novel.quwanclass.com');
  assert.deepEqual(item.chapters,original.chapters);assert.equal(item.status,'reference');
  assert.ok(!('paragraphs' in item));assert.ok(!('words' in item));
  for(const chapter of item.chapters){
   assert.deepEqual(Object.keys(chapter).sort(),['id','no','sourceAvailable','title','wordCount'].sort());
   assert.match(chapter.id,/^story-\d{3}$/);assert.equal(typeof chapter.title,'string');
   assert.equal(typeof chapter.sourceAvailable,'boolean');assert.ok(!('available' in chapter));
  }
 }
 const download=readJson(path.join(root,'client','downloads','gaokao-catalog.json'));
 assert.equal(download.contentAccess,'metadata-only');assert.equal(download.source,source.source);
 assert.equal(download.sourceAsset,source.sourceAsset);assert.equal(download.sourceKind,'public-catalog');
 assert.deepEqual(download.books,exported);
 assert.equal(library.stats.loaded,3162);assert.equal(library.stats.used,596);assert.equal(library.stats.coverage,18.85);
});

test('IELTS preserves separate long-novel chapters and short-story catalog without changing coverage',()=>{
 const source=readJson(path.join(root,'competitor-ielts-catalog-public.json'));
 const historical=readJson(path.join(root,'competitor-catalog-public.json'));
 const shorts=library.catalogs.filter(book=>book.course==='雅思');
 assert.equal(source.kind,'public-catalog');assert.equal(shorts.length,100);
 assert.deepEqual(source.books.map(book=>[book.id,book.title]),historical.books.map(book=>[book.id,book.title]));
 assert.equal(library.ielts.shortBookCount,100);assert.equal(library.ielts.contentAccess,'metadata-only');
 assert.equal(library.ielts.sourceAsset,source.sourceAsset);assert.equal(library.ielts.courseUrl,source.courseUrl);
 assert.deepEqual(library.ielts.longNovel,source.longNovel);
 const novel=library.ielts.longNovel,chapters=novel.parts.flatMap(part=>part.chapters);
 assert.equal(novel.title,'京圈豪门弃女');assert.equal(novel.partCount,5);assert.equal(novel.parts.length,5);
 assert.equal(novel.chapterCount,100);assert.equal(chapters.length,100);
 assert.deepEqual(chapters.map(chapter=>chapter.no),Array.from({length:100},(_,index)=>index+1));
 assert.equal(new Set(chapters.map(chapter=>chapter.id)).size,100);
 for(const part of novel.parts){
  assert.equal(part.chapterCount,20);assert.equal(part.chapters.length,20);assert.ok(part.intro);
  assert.match(part.cover,/^https:\/\/novel\.quwanclass\.com\/assets\//);
  for(const chapter of part.chapters){
   assert.deepEqual(Object.keys(chapter).sort(),['id','no','sourceAvailable','title','wordCount'].sort());
   assert.equal(typeof chapter.sourceAvailable,'boolean');assert.ok(!('available' in chapter));
   assert.ok(!library.catalogs.some(book=>book.sourceId===chapter.id));
  }
 }
 for(const original of source.books){
  const item=shorts.find(book=>book.sourceId===original.id);
  assert.equal(item.intro,original.intro);assert.equal(item.cover,original.cover);
  assert.equal(item.coverShortTitle,original.coverShortTitle);assert.equal(item.chapterCount,1);
  assert.equal(item.wordCount,original.wordCount);assert.equal(item.status,'reference');
  assert.ok(!('paragraphs' in item));assert.ok(!('words' in item));
 }
 assert.equal(shorts.find(book=>book.sourceId==='book-61').wordCount,110);
 assert.equal(shorts.find(book=>book.sourceId==='book-62').wordCount,98);
 const download=readJson(path.join(root,'client','downloads','ielts-catalog.json'));
 assert.equal(download.contentAccess,'metadata-only');assert.equal(download.sourceAsset,source.sourceAsset);
 assert.deepEqual(download.longNovel,novel);assert.deepEqual(download.books,shorts);
 assert.deepEqual(download.reportedShortStats,source.reportedShortStats);
 assert.equal(library.stats.sourceCatalogCount,247);assert.equal(library.stats.originalCount,7);
 assert.equal(library.stats.loaded,3162);assert.equal(library.stats.used,596);assert.equal(library.stats.coverage,18.85);
});

test('all current sources pass ledger verification, including repeated English glosses',()=>{
 for(const id of Object.keys(state.articles)){
  const result=verify(id);assert.equal(result.status,0,result.stderr);
 }
});

test('changing Chinese prose without changing English vocabulary fails snapshot verification',()=>{
 const id=Object.keys(state.articles).find(id=>state.articles[id].article_markdown.includes('start mode=mixed'));
 assert.ok(id);const changed=structuredClone(sources[id]);changed.paragraphs[0].text+='这个行动从未出现在记账成稿中。';
 const result=verify(id,state.articles[id],changed);
 assert.notEqual(result.status,0);assert.match(result.stderr,/Chinese narrative differs/);
});

test('changing English narrative or the recorded body fails verification',()=>{
 const id=Object.keys(state.articles).find(id=>!state.articles[id].article_markdown.includes('start mode=mixed'));
 assert.ok(id);const changed=structuredClone(sources[id]);changed.paragraphs[0].text+=' This sentence was never recorded.';
 const result=verify(id,state.articles[id],changed);
 assert.notEqual(result.status,0);assert.match(result.stderr,/English narrative differs/);
 const article=structuredClone(state.articles[id]);article.body+=' unrecorded';
 const bodyResult=verify(id,article);
 assert.notEqual(bodyResult.status,0);assert.match(bodyResult.stderr,/recorded body differs/);
});

test('unrecorded glosses and malformed source tokens cannot become learning cards',()=>{
 const id=Object.keys(state.articles)[0];const changed=structuredClone(sources[id]);
 changed.paragraphs[0].text=changed.paragraphs[0].text.replace(token,(whole,surface,wordId,zh,pos)=>`[[${surface}|${wordId}|未经核验的释义|${pos}]]`);
 const result=verify(id,state.articles[id],changed);
 assert.notEqual(result.status,0);assert.match(result.stderr,/unrecorded token or gloss/);
 const malformed=structuredClone(sources[id]);malformed.paragraphs[0].text+=' [[broken-token]]';
 const malformedResult=verify(id,state.articles[id],malformed);
 assert.notEqual(malformedResult.status,0);assert.match(malformedResult.stderr,/malformed source token/);
});
