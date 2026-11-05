import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemberStorage,memberStorageKey,SESSION_CHANGED_KEY} from '../client/member-storage.mjs';
import {STORAGE_KEY,loadLibrary,saveLibrary,freshLibrary} from '../client/library-state.mjs';

const session=id=>({user:{id,phone:'13800000000',active:true},admin:false});
function memory(initial={}){
 const records=new Map(Object.entries(initial)),reads=[];
 return {records,reads,getItem:key=>{reads.push(key);return records.get(key)??null;},setItem:(key,value)=>records.set(key,String(value)),removeItem:key=>records.delete(key)};
}

test('learning storage fails closed for missing, malformed and inactive users',()=>{
 const raw=memory();
 for(const value of [undefined,{}, {user:{}},session(''),session(' alice'),session(1),{user:{id:'alice',active:false}},{user:{id:'alice',active:'true'}}]){
  assert.throws(()=>createMemberStorage(raw,value));
 }
 assert.equal(raw.reads.length,0);
 assert.equal(raw.records.size,0);
});

test('two authenticated users cannot read, overwrite or remove each other’s progress',()=>{
 const raw=memory(),alice=createMemberStorage(raw,session('alice')),bob=createMemberStorage(raw,session('bob'));
 const data=freshLibrary();data.bookmarks=['proposal'];data.answers={'story-0001':{a:'proposal'}};
 assert.equal(saveLibrary(alice,data),true);
 assert.deepEqual(loadLibrary(bob,['proposal'],['story-0001'],{'story-0001':['a']}).data.bookmarks,[]);
 const b=freshLibrary();b.bookmarks=['signature'];assert.equal(saveLibrary(bob,b),true);
 assert.equal(JSON.parse(alice.getItem(STORAGE_KEY)).answers['story-0001'].a,'proposal');
 bob.removeItem(STORAGE_KEY);
 assert.deepEqual(JSON.parse(alice.getItem(STORAGE_KEY)).bookmarks,['proposal']);
 assert.equal(bob.getItem(STORAGE_KEY),null);
 assert.equal(raw.getItem(STORAGE_KEY),null);
});

test('loading a new account never reads or migrates unowned legacy keys',()=>{
 const old=freshLibrary();old.bookmarks=['proposal'];
 const raw=memory({[STORAGE_KEY]:JSON.stringify(old),'cijian-progress-v1':'{"version":1,"bookmarks":["signature"]}'});
 const scoped=createMemberStorage(raw,session('alice'));
 assert.deepEqual(loadLibrary(scoped,['proposal'],['story-0001']).data.bookmarks,[]);
 assert.ok(raw.reads.every(key=>key.startsWith('cijian-member:alice:')));
 assert.equal(raw.records.get(STORAGE_KEY),JSON.stringify(old));
 assert.equal(raw.records.size,2);
});

test('legacy records are available only through the explicit read method and remain untouched',()=>{
 const raw=memory({[STORAGE_KEY]:'{"version":2,"bookmarks":["proposal"]}','cijian-progress-v1':'v1'});
 const scoped=createMemberStorage(raw,session('alice'));
 assert.equal(raw.reads.length,0);
 assert.deepEqual(scoped.readLegacy(),{key:STORAGE_KEY,value:'{"version":2,"bookmarks":["proposal"]}'});
 scoped.setItem(STORAGE_KEY,'new account data');
 assert.equal(raw.records.get(STORAGE_KEY),'{"version":2,"bookmarks":["proposal"]}');
 assert.equal(raw.records.get('cijian-progress-v1'),'v1');
 assert.deepEqual(createMemberStorage(memory({'cijian-progress-v1':'v1'}),session('alice')).readLegacy(),{key:'cijian-progress-v1',value:'v1'});
 assert.equal(createMemberStorage(memory(),session('alice')).readLegacy(),null);
});

test('key encoding keeps arbitrary user IDs and logical keys in separate namespaces',()=>{
 assert.notEqual(memberStorageKey('a:b','c'),memberStorageKey('a','b:c'));
 assert.notEqual(memberStorageKey('a%3Ab','c'),memberStorageKey('a:b','c'));
 assert.notEqual(memberStorageKey('alice',SESSION_CHANGED_KEY),SESSION_CHANGED_KEY);
 assert.throws(()=>memberStorageKey('alice',''));
});

test('storage denial still preserves the existing library error handling',()=>{
 const scoped=createMemberStorage({getItem(){throw Error('denied');},setItem(){throw Error('denied');}},session('alice'));
 assert.match(loadLibrary(scoped,[],[]).error,/无法读取/);
 assert.equal(saveLibrary(scoped,freshLibrary()),false);
 assert.throws(()=>scoped.readLegacy(),/denied/);
});
