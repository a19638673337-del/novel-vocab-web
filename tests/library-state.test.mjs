import test from 'node:test';
import assert from 'node:assert/strict';
import {STORAGE_KEY,validateLibrary,loadLibrary,migrateLegacy} from '../client/library-state.mjs';
import {summarizeExercise,exerciseAnswerKeys} from '../client/exercise.mjs';

const wordIds=['repair','proposal','signature'];
const storyIds=['story-0001','story-0002','last-page-excerpt'];
const keys={'story-0001':['t0-0','t1-0'],'story-0002':['t0-0'],'last-page-excerpt':['proposal','signature']};

test('each book retains its allowed occurrence answers without accepting another book’s tokens',()=>{
 const data=validateLibrary({version:2,answers:{'story-0001':{'t0-0':'repairs','t1-0':'repair',repair:'repair'},'story-0002':{'t0-0':'repair','t1-0':'repairs'}}},wordIds,storyIds,keys);
 assert.deepEqual(data.answers,{'story-0001':{'t0-0':'repairs','t1-0':'repair'},'story-0002':{'t0-0':'repair'}});
});

test('loading a saved token answer preserves it after refresh',()=>{
 const records=new Map([[STORAGE_KEY,JSON.stringify({version:2,bookmarks:['repair'],answers:{'story-0001':{'t1-0':'repair'}}})]]);
 const result=loadLibrary({getItem:key=>records.get(key)??null},wordIds,storyIds,keys);
 assert.equal(result.error,null);
 assert.deepEqual(result.data.answers,{'story-0001':{'t1-0':'repair'}});
});

test('legacy excerpt preserves its answers, bookmarks, familiarity and reading position',()=>{
 const raw={version:1,bookmarks:['signature'],familiarity:{signature:'known'},answers:{proposal:'proposal'},scrollY:428,readRatio:.6,mode:'cloze',fontSize:26};
 const result=migrateLegacy(raw,wordIds,storyIds,keys);
 assert.deepEqual(result.answers,{'last-page-excerpt':{proposal:'proposal'}});
 assert.deepEqual(result.bookmarks,['signature']);
 assert.deepEqual(result.familiarity,{signature:'known'});
 assert.deepEqual(result.readings,{'last-page-excerpt':{scrollY:428,ratio:.6}});
 assert.equal(result.lastStory,'last-page-excerpt');
 assert.equal(result.mode,'cloze');
});

test('exercise totals count visible markers rather than every entry in a shared token dictionary',()=>{
 const tokens={proposal:{id:'proposal',en:'proposal'},signature:{id:'signature',en:'signature'}};
 const book={id:'last-page-excerpt',paragraphs:[{text:'The [[proposal]].',tokens},{text:'The [[signature]].',tokens}]};
 assert.deepEqual(summarizeExercise(book,{proposal:'proposal',signature:'signature'}),{total:2,filled:2,correct:2});
 assert.deepEqual(exerciseAnswerKeys([book]),{'last-page-excerpt':['proposal','signature']});
});
