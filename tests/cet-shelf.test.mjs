import test from 'node:test';
import assert from 'node:assert/strict';
import {cetShelfPage, mountCetShelf} from '../client/cet-shelf.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const makeBook = (index, overrides = {}) => ({id:`story-${index}`, title:`原创故事 ${index}`, description:`这是第 ${index} 个完整故事`, genre:index % 2 ? '悬疑' : '奇幻', kind:'original', focusCount:100 + index, words:[{id:'shared'}, {id:`word-${index}`}], ...overrides});
const books = [makeBook(1, {title:'雨夜回信', description:'火车站的最后一封信'}), makeBook(2, {title:'Project A 的旅程'}), makeBook(3), makeBook(4), makeBook(99, {kind:'excerpt', title:'截图里的故事'})];
const library = {stats:{target:5500, loaded:3162, used:596, unused:2566, coverage:18.85}, lexicon:[{id:'shared', tracks:['cet4','cet6']}, {id:'four', tracks:['cet4']}, {id:'six', tracks:['cet6']}, {id:'six', tracks:['cet6']}], catalogs:[{course:'四六级'}, {course:'四六级'}, {course:'雅思'}]};
const fresh = () => ({lastStory:'story-4', readings:{}, answers:{}, bookmarks:[], familiarity:{}});
const renderCard = book => `<article class="shelf-book" data-rendered-book="${esc(book.id)}"><h2>${esc(book.title)}</h2><p>${esc(book.description)}</p></article>`;
const page = (progress = fresh(), list = books, data = library) => cetShelfPage(data, list, progress, renderCard);
const articles = html => [...html.matchAll(/data-rendered-book="([^"]+)"/g)].map(match => match[1]);
const hero = html => html.split('class="cet-continue"')[1].split('</div>')[0];

test('CET shelf reuses original cards, separates excerpts and catalog, and explains actual coverage', () => {
  const original = structuredClone({library, books});
  const html = page();
  assert.deepEqual(articles(html), ['story-1', 'story-2', 'story-3', 'story-4']);
  assert.match(html, /原创背词短篇 · 4 篇可读/);
  assert.match(html, /每篇 101–104 个重点词/);
  assert.match(html, /<strong>3,162<\/strong><span>已导入词库/);
  assert.match(html, /<strong>596<\/strong><span>正文已使用/);
  assert.match(html, /<strong>2,566<\/strong><span>正文未使用/);
  assert.match(html, /<strong>18\.85<small>%/);
  assert.match(html, /不代表你已掌握/);
  assert.match(html, /5,500 词是学习目标，当前实际入库 3,162 词/);
  assert.match(html, /href="#reader\/story-99"/);
  assert.match(html, /不计入原创篇数与正文覆盖台账/);
  assert.match(html, /2 条四六级来源目录/);
  assert.match(html, /href="#catalog\/cet"/);
  assert.match(html, /href="#review\/story-1"/);
  assert.deepEqual({library, books}, original);
});

test('default lastStory does not invent reading history; only an actually started original resumes', () => {
  assert.match(hero(page()), /href="#reader\/story-1">开始阅读/);
  assert.doesNotMatch(hero(page()), /继续阅读|上次读到/);
  let progress = {...fresh(), readings:{'story-4':{ratio:.42}}};
  assert.match(hero(page(progress)), /href="#reader\/story-4">继续阅读/);
  progress = {...fresh(), answers:{'story-4':{token:'  submitted  '}}};
  assert.match(hero(page(progress)), /href="#reader\/story-4">继续阅读/);
  progress.answers['story-4'].token = '  ';
  assert.match(hero(page(progress)), /href="#reader\/story-1">开始阅读/);
  progress = {...fresh(), lastStory:'story-99', readings:{'story-99':{ratio:1}, 'story-2':{ratio:.5}}};
  assert.match(hero(page(progress)), /href="#reader\/story-1">开始阅读/);
});

test('track entries are deduplicated within tracks and shared words are not summed into total', () => {
  const html = page();
  assert.match(html, /href="#vocabulary\/cet4\/all"[\s\S]*?<h3>四级词汇<\/h3><p>2 词/);
  assert.match(html, /href="#vocabulary\/cet6\/all"[\s\S]*?<h3>六级词汇<\/h3><p>2 词/);
  assert.match(html, /href="#vocabulary\/all\/unused"/);
  assert.match(html, /共享词会分别出现，总词库按单词去重/);
});

test('local familiarity and bookmarks count only unique current-site word cards and leave progress untouched', () => {
  const progress = {...fresh(), bookmarks:['shared','shared','word-99','deleted-word','four'], familiarity:{shared:'known','word-99':'known','deleted-word':'known','word-2':'fuzzy'}, readings:{'story-1':{ratio:1},'story-2':{ratio:.999},'story-99':{ratio:1}}, answers:{'story-3':{token:'answer'}}};
  const before = structuredClone(progress);
  const html = page(progress);
  assert.match(html, /本站 6 张词卡范围/);
  assert.match(html, /<dt>我的生词<\/dt><dd>2<\/dd>/);
  assert.match(html, /<dt>自评掌握<\/dt><dd>2<\/dd>/);
  assert.match(html, /<dt>原创读到末尾<\/dt><dd>1<small> \/ 4/);
  assert.match(html, /阅读中 · 阅读位置 99%/);
  assert.match(html, /href="#review\/notebook"/);
  assert.match(html, /href="#notebook"/);
  assert.deepEqual(progress, before);
});

test('empty or missing data stays usable and untrusted titles, descriptions, genres and IDs are escaped', () => {
  const empty = cetShelfPage(undefined);
  assert.match(empty, /原创故事正在准备中/);
  assert.match(empty, /原创故事正在整理/);
  assert.match(empty, /href="#vocabulary">先浏览词表/);
  assert.doesNotMatch(empty, /undefined|NaN|#reader\/|5,500/);
  const malicious = makeBook(1, {id:'bad"/><script>', title:'<img src=x onerror=attack()>', description:'<script>attack()</script>', genre:'"><svg onload=attack()>'});
  const html = page(fresh(), [malicious]);
  assert.doesNotMatch(html, /<script>|<svg |<img src=x/);
  assert.match(html, /&lt;img src=x onerror=attack\(\)&gt;/);
  assert.match(html, /value="&quot;&gt;&lt;svg onload=attack\(\)&gt;"/);
  assert.match(html, /href="#reader\/bad%22%2F%3E%3Cscript%3E"/);
});

function mounted(list = books, progress = fresh()) {
  class Element {
    constructor(dataset = {}) { this.dataset = dataset; this.value = ''; this.hidden = false; this.textContent = ''; this.innerHTML = ''; this.attributes = new Map(); this.focusCalls = []; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    focus(options) { this.focusCalls.push(options); }
    closest() { return this; }
    matches(selector) { return selector === '[data-cet-art]' && this.dataset.cetArt === ''; }
  }
  const controls = new Map();
  for (const key of ['search','genre','reading','results','count','page-count']) controls.set(`[data-cet-${key}]`, new Element());
  controls.get('[data-cet-genre]').value = 'all'; controls.get('[data-cet-reading]').value = 'all';
  const actions = new Map(['load-more','clear-search','reset'].map(action => [action, new Element({cetAction:action})]));
  for (const [action, element] of actions) controls.set(`[data-cet-action="${action}"]`, element);
  const art = new Element({cetArt:''}); art.complete = false; art.naturalWidth = 100; controls.set('[data-cet-art]', art);
  const html = page(progress, list);
  controls.get('[data-cet-results]').innerHTML = html.split('data-cet-results>')[1].split('</div><div class="cet-pagination">')[0];
  const count = list.filter(book => book.kind === 'original').length;
  controls.get('[data-cet-count]').textContent = `已显示 ${Math.min(count, 12)} / ${count} 篇原创`;
  actions.get('load-more').hidden = count <= 12; actions.get('clear-search').hidden = true;
  const listeners = new Map();
  const container = {
    querySelector:selector => controls.get(selector), contains:element => [...controls.values()].includes(element),
    addEventListener(type, listener) { const set = listeners.get(type) || new Set(); set.add(listener); listeners.set(type, set); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); }
  };
  const root = {querySelector:selector => selector === '[data-cet-shelf]' ? container : null};
  const cleanup = mountCetShelf(root, library, list, progress, renderCard);
  const emit = (type, target, extra = {}) => { const event = {target, stopped:false, stopPropagation() { this.stopped = true; }, ...extra}; for (const handler of listeners.get(type) || []) handler(event); return event; };
  return {root, listeners, actions, cleanup, emit, get:selector => controls.get(selector), click:action => emit('click', actions.get(action))};
}

test('Chinese IME searches only after composition and searches title, description and normalized Latin text', () => {
  const ui = mounted(), search = ui.get('[data-cet-search]'), results = ui.get('[data-cet-results]');
  const before = results.innerHTML;
  search.value = '火车站'; ui.emit('compositionstart', search); assert.equal(ui.emit('input', search, {isComposing:true}).stopped, true);
  assert.equal(results.innerHTML, before);
  ui.emit('compositionend', search); assert.deepEqual(articles(results.innerHTML), ['story-1']);
  assert.equal(search.focusCalls.length, 0);
  search.value = ' ＰＲＯＪＥＣＴ ａ '; ui.emit('input', search); assert.deepEqual(articles(results.innerHTML), ['story-2']);
  search.value = '悬疑'; ui.emit('input', search); assert.deepEqual(articles(results.innerHTML), ['story-1','story-3']);
  assert.equal(ui.emit('input', {value:'outside'}).stopped, false);
});

test('genre and actual reading filters compose with search; clear preserves filters and reset clears all', () => {
  const progress = {...fresh(), readings:{'story-1':{ratio:1}, 'story-2':{ratio:.5}}, answers:{'story-3':{token:'answer'}, 'story-4':{token:' '}}};
  const ui = mounted(books, progress), search = ui.get('[data-cet-search]'), genre = ui.get('[data-cet-genre]'), reading = ui.get('[data-cet-reading]'), results = ui.get('[data-cet-results]');
  reading.value = 'started'; ui.emit('change', reading); assert.deepEqual(articles(results.innerHTML), ['story-2','story-3']);
  genre.value = '悬疑'; ui.emit('change', genre); assert.deepEqual(articles(results.innerHTML), ['story-3']);
  search.value = 'no match'; ui.emit('input', search); assert.match(results.innerHTML, /没有找到匹配的故事/);
  ui.click('clear-search'); assert.deepEqual(articles(results.innerHTML), ['story-3']);
  assert.equal(genre.value, '悬疑'); assert.equal(reading.value, 'started'); assert.equal(search.focusCalls.length, 1);
  ui.click('reset'); assert.equal(genre.value, 'all'); assert.equal(reading.value, 'all'); assert.equal(articles(results.innerHTML).length, 4);
  reading.value = 'finished'; ui.emit('change', reading); assert.deepEqual(articles(results.innerHTML), ['story-1']);
  reading.value = 'unread'; ui.emit('change', reading); assert.deepEqual(articles(results.innerHTML), ['story-4']);
});

test('paging adds actual originals, resets on search and focuses result count at the last page', () => {
  const list = Array.from({length:25}, (_, index) => makeBook(index + 1));
  const ui = mounted(list), results = ui.get('[data-cet-results]'), search = ui.get('[data-cet-search]');
  assert.equal(articles(results.innerHTML).length, 12);
  ui.click('load-more'); assert.equal(articles(results.innerHTML).length, 24);
  ui.click('load-more'); assert.equal(articles(results.innerHTML).length, 25);
  assert.equal(ui.actions.get('load-more').hidden, true);
  assert.equal(ui.get('[data-cet-page-count]').focusCalls.length, 1);
  search.value = '原创故事 25'; ui.emit('input', search); assert.deepEqual(articles(results.innerHTML), ['story-25']);
  search.value = ''; assert.equal(ui.emit('search', search).stopped, true);
  assert.equal(articles(results.innerHTML).length, 12); assert.equal(ui.actions.get('load-more').hidden, false);
  assert.equal(ui.get('[data-cet-count]').textContent, '已显示 12 / 25 篇原创');
});

test('mount and teardown are scoped and idempotent; artwork failure does not remove reading links', () => {
  assert.doesNotThrow(() => mountCetShelf({querySelector:() => null}, library, books, fresh(), renderCard)());
  const ui = mounted(), art = ui.get('[data-cet-art]');
  ui.emit('error', art); assert.equal(art.hidden, true);
  const cleanup = mountCetShelf(ui.root, library, books, fresh(), renderCard);
  assert.ok([...ui.listeners.values()].every(set => set.size === 1));
  assert.doesNotThrow(() => ui.emit('click', {}));
  cleanup(); assert.ok([...ui.listeners.values()].every(set => set.size === 0));
});
