import test from 'node:test';
import assert from 'node:assert/strict';
import {gaokaoShelfPage, mountGaokaoShelf} from '../client/gaokao-shelf.mjs';

const sourceUrl = 'https://novel.quwanclass.com/gaokao/';
const book = (index, overrides = {}) => ({
  id:`gaokao-book-${index}`, sourceId:`book-${index}`, course:'高中',
  no:index, title:`高中故事 ${index}`, intro:`故事 ${index} 的公开简介。`,
  chapterCount:1, originalWordCount:120 + index, sourceUrl,
  chapters:[{no:1, title:`第一章 ${index}`, wordCount:24}], ...overrides
});
const fixture = {
  books:[{id:'story-0001', title:'本站四六级原创'}],
  stats:{loaded:3162, used:596, coverage:18.85},
  catalogs:[
    book(7, {title:'雨夜的车站', intro:'一张寄往车站的信笺。'}),
    book(8, {title:'清晨的回信'}),
    book(9, {title:'第三封信'}),
    book(1, {id:'cet-book-01', course:'四六级', title:'外课程独有标题'})
  ]
};
const articles = html => [...html.matchAll(/<article class="gaokao-card"[\s\S]*?<\/article>/g)].map(match => match[0]);
const libraryWith = catalogs => ({...fixture, catalogs});

test('the high-school shelf uses only its public course records and leaves originals and coverage unchanged', () => {
  const before = structuredClone(fixture);
  const html = gaokaoShelfPage(fixture);
  assert.equal(articles(html).length, 3);
  assert.match(html, /已显示 3 \/ 3 部目录/);
  assert.match(html, /<strong>0<\/strong><span>本站已导入正文<\/span>/);
  assert.match(html, /原站标注学习目标 · 非已导入词数/);
  assert.match(html, /正文尚未导入本站/);
  assert.doesNotMatch(html, /外课程独有标题|本站四六级原创|#reader\//);
  assert.deepEqual(fixture, before);
  assert.match(articles(html)[0], /No\.07/);
  assert.match(articles(html)[0], /1 章 · 原站标注 127 词/);
  assert.match(articles(html)[0], /第一章 7/);
});

test('missing source sequence, chapter count, word count and introduction remain visibly unknown', () => {
  const html = gaokaoShelfPage(libraryWith([book(1, {
    no:null, genre:null, chapterCount:null, originalWordCount:null, wordCount:null,
    intro:null, chapters:[], title:'只有标题的旧索引'
  })]));
  const card = articles(html)[0];
  assert.match(card, /章数未提供 · 词数未提供/);
  assert.match(card, /暂无故事简介/);
  assert.match(card, /暂未整理章节标题/);
  assert.doesNotMatch(card, /No\.01|原站标注 0 词|1 章|>null<|>undefined</);
});

test('untrusted titles, introductions and chapters are escaped, and links never use unsafe origins', () => {
  const html = gaokaoShelfPage(libraryWith([book(1, {
    title:'<script>alert("title")</script>', intro:'<img src=x onerror="attack()">',
    sourceUrl:'javascript:alert(1)', chapters:[{no:'<svg onload=attack()>', title:'<b>恶意章节</b>', wordCount:17}]
  }), book(2, {sourceUrl:'https://novel.quwanclass.com.attacker.invalid/'})]));
  const cards = articles(html).join('');
  assert.doesNotMatch(cards, /<script|<img|<svg|<b>/);
  assert.match(cards, /&lt;script&gt;alert\(&quot;title&quot;\)&lt;\/script&gt;/);
  assert.match(cards, /&lt;img src=x onerror=&quot;attack\(\)&quot;&gt;/);
  assert.match(cards, /&lt;b&gt;恶意章节&lt;\/b&gt;/);
  assert.doesNotMatch(cards, /href="javascript:|href="https:\/\/novel\.quwanclass\.com\.attacker/);
  for (const [, href] of cards.matchAll(/href="([^"]+)"/g)) {
    assert.equal(new URL(href).origin, 'https://novel.quwanclass.com');
  }
  assert.equal((cards.match(/rel="noopener noreferrer"/g) || []).length, 2);
});

function mounted(library) {
  class Element {
    constructor(dataset = {}) {
      this.dataset = dataset; this.value = ''; this.hidden = false;
      this.textContent = ''; this.attributes = new Map(); this.focusCalls = []; this.scrollCalls = [];
      this._html = '';
    }
    set innerHTML(value) { this._html = value; }
    get innerHTML() { return this._html; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    focus(options) { this.focusCalls.push(options); }
    scrollIntoView(options) { this.scrollCalls.push(options); }
    closest() { return this; }
    matches(selector) { return selector === '[data-gaokao-art]' && this.dataset.gaokaoArt === ''; }
  }
  const controls = new Map();
  for (const key of ['search', 'results', 'count', 'page-count', 'featured-title', 'featured-intro', 'featured-meta', 'featured-count']) {
    controls.set(`[data-gaokao-${key}]`, new Element());
  }
  const actions = new Map(['load-more', 'clear-search', 'previous', 'next', 'locate'].map(action => [action, new Element({gaokaoAction:action})]));
  for (const [action, element] of actions) controls.set(`[data-gaokao-action="${action}"]`, element);
  controls.set('.gaokao-search [data-gaokao-action="clear-search"]', actions.get('clear-search'));
  const art = new Element({gaokaoArt:''});
  art.complete = false;
  art.naturalWidth = 100;
  controls.set('[data-gaokao-art]', art);
  const cards = new Map();
  const results = controls.get('[data-gaokao-results]');
  Object.defineProperty(results, 'innerHTML', {
    get() { return this._html; },
    set(value) {
      this._html = value;
      cards.clear();
      for (const [, index] of value.matchAll(/data-gaokao-book="(\d+)"/g)) cards.set(index, new Element({gaokaoBook:index}));
    }
  });
  const page = gaokaoShelfPage(library);
  results.innerHTML = page.split('data-gaokao-results>')[1].split('</div><div class="gaokao-pagination">')[0];
  const count = library.catalogs.filter(item => item.course === '高中').length;
  controls.get('[data-gaokao-count]').textContent = `已显示 ${Math.min(count, 12)} / ${count} 部目录`;
  actions.get('load-more').hidden = count <= 12;
  actions.get('clear-search').hidden = true;
  const listeners = new Map();
  const container = {
    querySelector(selector) {
      const index = selector.match(/^\[data-gaokao-book="(\d+)"\]$/)?.[1];
      return index === undefined ? controls.get(selector) : cards.get(index);
    },
    contains: element => [...controls.values(), ...cards.values()].includes(element),
    addEventListener(type, listener) { const set = listeners.get(type) || new Set(); set.add(listener); listeners.set(type, set); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); }
  };
  const root = {querySelector: selector => selector === '[data-gaokao-shelf]' ? container : null};
  const cleanup = mountGaokaoShelf(root, library);
  const emit = (type, target, extra = {}) => {
    const event = {target, stopped:false, stopPropagation() { this.stopped = true; }, ...extra};
    for (const listener of listeners.get(type) || []) listener(event);
    return event;
  };
  return {root, listeners, actions, cards, cleanup, emit, get: selector => controls.get(selector), click: action => emit('click', actions.get(action))};
}

test('IME search updates after composition, stays inside its page and clears without replacing input', () => {
  const ui = mounted(fixture), search = ui.get('[data-gaokao-search]'), results = ui.get('[data-gaokao-results]');
  const original = results.innerHTML;
  search.value = '雨夜';
  ui.emit('compositionstart', search);
  assert.equal(ui.emit('input', search, {isComposing:true}).stopped, true);
  assert.equal(results.innerHTML, original);
  assert.equal(ui.emit('compositionend', search).stopped, true);
  assert.equal(articles(results.innerHTML).length, 1);
  assert.match(results.innerHTML, /雨夜的车站/);
  assert.equal(ui.get('[data-gaokao-count]').textContent, '已显示 1 / 1 部目录');
  assert.equal(search.focusCalls.length, 0);
  ui.click('clear-search');
  assert.equal(search.value, '');
  assert.equal(ui.get('[data-gaokao-search]'), search);
  assert.equal(search.focusCalls.length, 1);
  assert.equal(articles(results.innerHTML).length, 3);
  assert.equal(ui.actions.get('clear-search').hidden, true);
  assert.equal(ui.emit('input', {value:'unrelated field'}).stopped, false);
});

test('pagination stops at the real total and search or clearing resets the displayed batch', () => {
  const library = libraryWith(Array.from({length:25}, (_, index) => book(index + 1)));
  const before = structuredClone(library);
  const ui = mounted(library), results = ui.get('[data-gaokao-results]'), search = ui.get('[data-gaokao-search]');
  assert.equal(articles(results.innerHTML).length, 12);
  ui.click('load-more');
  assert.equal(articles(results.innerHTML).length, 24);
  ui.click('load-more');
  assert.equal(articles(results.innerHTML).length, 25);
  assert.equal(ui.actions.get('load-more').hidden, true);
  assert.equal(ui.get('[data-gaokao-page-count]').focusCalls.length, 1);
  search.value = '高中故事 25';
  ui.emit('input', search);
  assert.equal(articles(results.innerHTML).length, 1);
  assert.equal(ui.get('[data-gaokao-count]').textContent, '已显示 1 / 1 部目录');
  search.value = '';
  assert.equal(ui.emit('search', search).stopped, true);
  assert.equal(articles(results.innerHTML).length, 12);
  assert.equal(ui.actions.get('load-more').hidden, false);
  assert.deepEqual(library, before);
});

test('recommendations wrap and locating a later recommendation reveals its correct page and focuses that card', () => {
  const ui = mounted(libraryWith(Array.from({length:25}, (_, index) => book(index + 1))));
  ui.click('previous');
  assert.equal(ui.get('[data-gaokao-featured-title]').textContent, '高中故事 25');
  assert.equal(ui.get('[data-gaokao-featured-count]').textContent, '推荐 25 / 25');
  ui.click('next');
  assert.equal(ui.get('[data-gaokao-featured-title]').textContent, '高中故事 1');
  for (let index = 0; index < 13; index++) ui.click('next');
  assert.equal(ui.get('[data-gaokao-featured-title]').textContent, '高中故事 14');
  const search = ui.get('[data-gaokao-search]');
  search.value = 'does not exist';
  ui.emit('input', search);
  ui.click('locate');
  assert.equal(search.value, '');
  assert.equal(ui.get('[data-gaokao-count]').textContent, '已显示 24 / 25 部目录');
  const card = ui.cards.get('13');
  assert.deepEqual(card.focusCalls, [{preventScroll:true}]);
  assert.deepEqual(card.scrollCalls, [{block:'center'}]);
  assert.match(ui.get('[data-gaokao-results]').innerHTML, /高中故事 14/);
});

test('empty-course and no-match states are distinct and recovery never opens a nonexistent reader', () => {
  const empty = libraryWith([]), html = gaokaoShelfPage(empty);
  assert.match(html, /高中目录正在整理/);
  assert.match(html, /href="#library-catalog">返回课程总览/);
  assert.match(html, /data-gaokao-action="locate" disabled/);
  assert.match(html, /data-gaokao-action="previous"[^>]*disabled/);
  assert.match(html, /data-gaokao-action="next"[^>]*disabled/);
  assert.doesNotMatch(html, /#reader\/|>undefined<|>null</);
  const emptyUi = mounted(empty);
  assert.doesNotThrow(() => { emptyUi.click('previous'); emptyUi.click('next'); emptyUi.click('locate'); });
  const ui = mounted(fixture), search = ui.get('[data-gaokao-search]');
  search.value = 'unmatched title';
  ui.emit('input', search);
  assert.match(ui.get('[data-gaokao-results]').innerHTML, /没有找到这个标题/);
  assert.equal(ui.get('[data-gaokao-count]').textContent, '已显示 0 / 0 部目录');
  ui.click('clear-search');
  assert.equal(articles(ui.get('[data-gaokao-results]').innerHTML).length, 3);
});

test('mount cleanup is scoped and a broken hero image has a nonfatal fallback', () => {
  assert.doesNotThrow(() => mountGaokaoShelf({querySelector:() => null}, fixture)());
  const ui = mounted(fixture), image = ui.get('[data-gaokao-art]');
  ui.emit('error', image);
  assert.equal(image.hidden, true);
  const cleanup = mountGaokaoShelf(ui.root, fixture);
  assert.ok([...ui.listeners.values()].every(listeners => listeners.size === 1));
  cleanup();
  assert.ok([...ui.listeners.values()].every(listeners => listeners.size === 0));
});
