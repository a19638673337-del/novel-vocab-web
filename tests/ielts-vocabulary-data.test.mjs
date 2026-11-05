import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {library} from '../client/library-data.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const source=readJson(path.join(root,'ielts-vocabulary-source.json'));
const extracted=readJson(path.resolve(root,'..','分析与规则','词表抽取文本','2026-11-01-雅思总词表-已加载50词.json'));
const download=readJson(path.join(root,'client','downloads','ielts-vocabulary.json'));
const localPython=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe');
const python=process.env.CODEX_PYTHON||(fs.existsSync(localPython)?localPython:'python');

function parseCsv(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;
  }else if(char===','&&!quoted){row.push(field);field='';}
  else if(char==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}
  else field+=char;
 }
 if(field||row.length){row.push(field);rows.push(row);}
 return rows;
}

test('IELTS glossary exports all 50 provided PDF rows without inventing the missing 9349',()=>{
 assert.equal(source.entries.length,50);
 assert.equal(new Set(source.entries.map(row=>row.word.toLowerCase())).size,50);
 assert.equal(source.site_declared_total,9399);assert.equal(source.is_complete,false);
 assert.deepEqual(source.entries,extracted.entries);
 assert.equal(source.source_sha256,extracted.source_sha256);
 assert.deepEqual(library.ielts.vocabulary,source);assert.deepEqual(download,source);
 assert.equal(source.entries[0].word,'A.D.');assert.equal(source.entries.at(-1).word,'accede');
 for(const [index,row] of source.entries.entries()){
  assert.equal(row.ordinal,index+1);
  for(const field of ['word','ipa_uk','ipa_us','meaning','pos'])assert.ok(row[field].trim(),`${row.word}: ${field}`);
  assert.ok(row.pages.length&&row.pages.every(page=>Number.isInteger(page)&&page>0));
 }
 const abuse=source.entries.find(row=>row.word==='abuse');
 assert.deepEqual(abuse.pages,[3,4]);assert.ok(abuse.meaning.endsWith('虐待'));
});

test('downloadable glossary CSV preserves both pronunciations, full meanings and PDF page references',()=>{
 const bytes=fs.readFileSync(path.join(root,'client','downloads','ielts-vocabulary.csv'));
 assert.deepEqual([...bytes.subarray(0,3)],[0xef,0xbb,0xbf]);
 const rows=parseCsv(bytes.toString('utf8').replace(/^\uFEFF/,''));
 assert.deepEqual(rows[0],['序号','英文','英式音标','美式音标','中文释义','词性','原PDF页码']);
 assert.deepEqual(rows.slice(1),source.entries.map(row=>[
  String(row.ordinal),row.word,row.ipa_uk,row.ipa_us,row.meaning,row.pos,row.pages.join('、')
 ]));
});

test('public glossary contains only safe source provenance and leaves CET coverage and catalog exports separate',()=>{
 const topKeys=['schema_version','source_type','source_label','source_url','source_sha256','site_declared_total','is_complete','entries'].sort();
 const entryKeys=['ordinal','word','ipa_uk','ipa_us','meaning','pos','pages'].sort();
 for(const glossary of [source,download,library.ielts.vocabulary]){
  assert.deepEqual(Object.keys(glossary).sort(),topKeys);
  for(const row of glossary.entries)assert.deepEqual(Object.keys(row).sort(),entryKeys);
  assert.doesNotMatch(JSON.stringify(glossary),/[A-Z]:[\\/]|source_path|archived_pdf|readRatio|scrollY|readings|audio_url/);
 }
 assert.equal(library.ielts.contentAccess,'metadata-only');
 const catalog=readJson(path.join(root,'client','downloads','ielts-catalog.json'));
 assert.ok(!('vocabulary' in catalog));assert.equal(catalog.books.length,100);
 assert.equal(catalog.longNovel.parts.flatMap(part=>part.chapters).length,100);
 assert.equal(library.stats.loaded,3162);assert.equal(library.stats.used,596);
 assert.equal(library.stats.unused,2566);assert.equal(library.stats.coverage,18.85);
 assert.equal(library.stats.originalCount,7);assert.equal(library.stats.sourceCatalogCount,247);
});

test('build rejects duplicate words, missing fields, false completeness and leaked local metadata',()=>{
 const invalid=[];
 const duplicate=structuredClone(source);duplicate.entries[1].word=' ａ．ｄ． ';invalid.push(duplicate);
 const missing=structuredClone(source);missing.entries[0].meaning=' ';invalid.push(missing);
 const privatePath=structuredClone(source);privatePath.source_path='C:\\Users\\example\\Desktop\\input.pdf';invalid.push(privatePath);
 const wrongComplete=structuredClone(source);wrongComplete.is_complete=true;invalid.push(wrongComplete);
 const wrongPage=structuredClone(source);wrongPage.entries[0].pages=[true];invalid.push(wrongPage);
 const wrongRow=structuredClone(source);wrongRow.entries[0].ordinal=2;invalid.push(wrongRow);
 const result=spawnSync(python,['-X','utf8','-c',[
  'import json,runpy,sys',
  'validate=runpy.run_path(sys.argv[1])["validate_ielts_vocabulary"]',
  'inputs=json.load(sys.stdin)',
  'validate(inputs["valid"])',
  'for index,source in enumerate(inputs["invalid"]):',
  '    try: validate(source)',
  '    except ValueError: continue',
  '    raise AssertionError(f"invalid fixture {index} accepted")'
 ].join('\n'),path.join(root,'scripts','build-library.py')],{input:JSON.stringify({valid:source,invalid}),encoding:'utf8'});
 if(result.error)throw result.error;
 assert.equal(result.status,0,result.stderr);
});
