import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../client/engine.mjs';
import { story as oldStory, words as oldWords } from '../client/story-data.mjs';
import { library } from '../client/library-data.mjs';
import * as libraryState from '../client/library-state.mjs';
import * as memberStorage from '../client/member-storage.mjs';
import * as exercise from '../client/exercise.mjs';
import * as membership from '../client/membership.mjs';
import * as libraryPortal from '../client/library-portal.mjs';
import * as referenceCatalog from '../client/reference-catalog.mjs';
import * as gaokaoShelf from '../client/gaokao-shelf.mjs';
import * as ieltsShelf from '../client/ielts-shelf.mjs';
import { createPronunciationPlayer } from '../client/pronunciation.mjs';
import { pronunciationSources } from '../client/pronunciations.mjs';

const logicalKey = libraryState.STORAGE_KEY;
const key = memberStorage.memberStorageKey('test-user',logicalKey);
const appCode = fs.readFileSync(new URL('../client/app.mjs', import.meta.url), 'utf8')
  .replace(/^import .*\r?\n/gm, '');

// Run the shipped app's real listeners in two independent tab contexts.
// Only browser surfaces are doubled; persistence and event handlers stay real.
function sharedStorage() {
  const records = new Map();
  return {
    getItem: name => records.get(name) ?? null,
    setItem: (name, value) => records.set(name, value),
  };
}

function tab(storage,userId='test-user') {
  let reloads=0;
  const windowEvents = {};
  const documentEvents = {};
  const elements = new Map();
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: '', textContent: '', hidden: false, open: false,
      classList: { add() {}, remove() {} },
      addEventListener() {}, focus() {}, querySelector() { return null; },
    });
    return elements.get(selector);
  }
  const document = {
    title: '', activeElement: { matches() { return false; } },
    querySelector: element,
    querySelectorAll() { return []; },
    addEventListener: (name, listener) => { documentEvents[name] = listener; },
  };
  const window = {
    cijianSession:{user:{id:userId,phone:'13800000000',active:true},admin:false,csrf:'test-csrf'},
    localStorage: storage, scrollY: 0, innerHeight: 800,
    scrollTo() {},
    addEventListener: (name, listener) => { windowEvents[name] = listener; },
  };
  const context = vm.createContext({
    ...engine, ...libraryState, ...memberStorage, ...exercise, ...membership, ...libraryPortal, ...referenceCatalog, ...gaokaoShelf, ...ieltsShelf, library, oldStory, oldWords,
    createPronunciationPlayer, pronunciationSources, document, window, location: { hash: '#reader',reload(){reloads++;} },
    requestAnimationFrame: callback => callback(),
    setTimeout: () => 1, clearTimeout() {},
  });
  vm.runInContext(appCode, context, { filename: 'dist/app.mjs' });
  return {
    focusInput(focused = true) { document.activeElement = { matches: () => focused }; },
    receiveStorageChange(changedKey=memberStorage.memberStorageKey(userId,logicalKey)) { windowEvents.storage({ key:changedKey }); },
    reloads(){return reloads;},
    content(){return element('#main').innerHTML;},
    close() { windowEvents.pagehide(); },
    notice() { return element('#storage-notice').textContent; },
    bookmark(id) {
      documentEvents.click({ target: { closest: () => ({ disabled: false, dataset: { action: 'bookmark', id } }) } });
    },
  };
}

test('refreshing a tab with an input conflict preserves the other tab’s new bookmark', () => {
  const storage = sharedStorage();
  const a = tab(storage);
  const b = tab(storage);
  a.focusInput();
  b.bookmark('proposal');
  a.receiveStorageChange();
  a.close();
  assert.deepEqual(JSON.parse(storage.getItem(key)).bookmarks, ['proposal']);
});

test('saving stays paused after a conflict even if focus changes and more updates arrive', () => {
  const storage = sharedStorage();
  const a = tab(storage);
  const b = tab(storage);
  a.focusInput();
  b.bookmark('proposal');
  a.receiveStorageChange();
  a.focusInput(false);
  b.bookmark('signature');
  a.receiveStorageChange();
  a.bookmark('executive');
  a.close();
  assert.deepEqual(JSON.parse(storage.getItem(key)).bookmarks, ['proposal', 'signature']);
});

test('a tab with no focused field also pauses saving when another tab changes the library', () => {
  const storage = sharedStorage();
  const a = tab(storage);
  const b = tab(storage);
  b.bookmark('proposal');
  a.receiveStorageChange();
  a.bookmark('signature');
  a.close();
  assert.deepEqual(JSON.parse(storage.getItem(key)).bookmarks, ['proposal']);
  assert.match(a.notice(), /暂停保存/);
});

test('reloading after a conflict adopts the latest library before accepting a new bookmark', () => {
  const storage = sharedStorage();
  const a = tab(storage);
  const b = tab(storage);
  b.bookmark('proposal');
  a.receiveStorageChange();
  a.close();
  const reloaded = tab(storage);
  reloaded.bookmark('signature');
  reloaded.close();
  assert.deepEqual(JSON.parse(storage.getItem(key)).bookmarks, ['proposal', 'signature']);
});


test('another account’s scoped update never pauses this account or leaks its bookmarks',()=>{
 const storage=sharedStorage(),alice=tab(storage,'alice'),bob=tab(storage,'bob');
 bob.bookmark('proposal');alice.receiveStorageChange(memberStorage.memberStorageKey('bob',logicalKey));
 alice.bookmark('signature');alice.close();
 assert.deepEqual(JSON.parse(storage.getItem(memberStorage.memberStorageKey('alice',logicalKey))).bookmarks,['signature']);
 assert.deepEqual(JSON.parse(storage.getItem(memberStorage.memberStorageKey('bob',logicalKey))).bookmarks,['proposal']);
 assert.equal(alice.notice(),'');
});

test('unowned legacy updates do not overwrite or pause an authenticated account',()=>{
 const storage=sharedStorage(),alice=tab(storage,'alice');
 storage.setItem(logicalKey,JSON.stringify({...libraryState.freshLibrary(),bookmarks:['proposal']}));
 alice.receiveStorageChange(logicalKey);alice.bookmark('signature');alice.close();
 assert.deepEqual(JSON.parse(storage.getItem(memberStorage.memberStorageKey('alice',logicalKey))).bookmarks,['signature']);
 assert.deepEqual(JSON.parse(storage.getItem(logicalKey)).bookmarks,['proposal']);
});

test('a session-change signal hides protected content and blocks stale writes before reload',()=>{
 const storage=sharedStorage(),alice=tab(storage,'alice');alice.bookmark('proposal');
 alice.receiveStorageChange(memberStorage.SESSION_CHANGED_KEY);
 assert.equal(alice.reloads(),1);assert.match(alice.content(),/正在重新确认账号/);
 alice.bookmark('signature');alice.close();
 assert.deepEqual(JSON.parse(storage.getItem(memberStorage.memberStorageKey('alice',logicalKey))).bookmarks,['proposal']);
 alice.receiveStorageChange(memberStorage.SESSION_CHANGED_KEY);assert.equal(alice.reloads(),1);
});

test('clearing browser storage pauses stale tabs instead of recreating deleted records',()=>{
 const storage=sharedStorage(),alice=tab(storage,'alice');alice.receiveStorageChange(null);alice.bookmark('proposal');alice.close();
 assert.deepEqual(JSON.parse(storage.getItem(memberStorage.memberStorageKey('alice',logicalKey))).bookmarks,[]);
 assert.match(alice.notice(),/暂停保存/);
});
