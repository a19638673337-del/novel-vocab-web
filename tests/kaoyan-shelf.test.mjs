import test from 'node:test';
import assert from 'node:assert/strict';
import {kaoyanShelfPage, mountKaoyanShelf} from '../client/kaoyan-shelf.mjs';

const book = (index, overrides = {}) => ({
  id:`kaoyan-book-${index}`, course:'考研', no:index, title:`考研故事 ${index}`,
  genre:index % 2 ? '都市' : '奇幻', intro:`故事 ${index} 的公开简介。`,
  chapterCount:10, originalWordCount:100 + index,
  sourceUrl:'https://novel.quwanclass.com/kaoyan/?account=unified', ...overrides
});
const fixture = {
  books:[{id:'story-0001', title:'本站四六级原创'}],
  stats:{loaded:3162, used:596, coverage:18.85},
  catalogs:[book(1, {title:'雨夜的车站'}), book(2, {title:'清晨的回信'}), book(3, {title:'第三封信'}), book(4, {course:'雅思', title:'雅思独有标题'})]
};
const libraryWith = catalogs => ({...fixture, catalogs});
const articles = html => [...html.matchAll(/<article class="kaoyan-card"[\s\S]*?<\/article>/g)].map(match => match[0]);

test('catalog scope and statistics reflect imported records without implying available prose or vocabulary', () => {
  const before = structuredClone(fixture);
  const html = kaoyanShelfPage(fixture);
  assert.equal(articles(html).length, 3);
  assert.match(html, /已显示 3 \/ 3 部目录/);
  assert.match(html, /<strong>2<\/strong><span>已收录故事题材/);
  assert.match(html, /<strong>0<\/strong><span>本站已导入正文/);
  assert.match(html, /公开目录；正文与考研词表尚未导入/);
  assert.match(html, /不计入阅读进度或词汇覆盖率/);
  assert.doesNotMatch(html, /雅思独有标题|本站四六级原创|#reader\/|5,?500|已掌握|开始阅读/);
  assert.match(articles(html)[0], /No\.01/);
  assert.match(articles(html)[0], /10 章 · 原站标注 101 词/);
  assert.match(html, /href="\.\/downloads\/kaoyan-catalog\.json" download/);
  assert.deepEqual(fixture, before);
});

test('missing catalog fields are unknown rather than fabricated chapters or counts', () => {
  const html = kaoyanShelfPage(libraryWith([book(1, {no:null, genre:null, intro:null, chapterCount:null, originalWordCount:null})]));
  const card = articles(html)[0];
  assert.match(card, /题材未提供/);
  assert.match(card, /序号未提供/);
  assert.match(card, /故事简介尚未提供/);
  assert.match(card, /章数未提供 · 词数未提供/);
  assert.doesNotMatch(card, /No\.01|第[一二三]章|>null<|>undefined<|原站标注 0 词/);
  assert.doesNotThrow(() => kaoyanShelfPage(undefined));
  assert.doesNotThrow(() => kaoyanShelfPage({catalogs:[null, false, 'text']}));
});

test('catalog text and genre options are escaped and source links remain on the allowed HTTPS origin', () => {
  const html = kaoyanShelfPage(libraryWith([
    book(1, {title:'<script>alert("title")</script>', genre:'"><svg onload=attack()>', intro:'<img src=x onerror="attack()">', sourceUrl:'javascript:alert(1)'}),
    book(2, {sourceUrl:'https://novel.quwanclass.com.attacker.invalid/'}),
    book(3, {sourceUrl:'https://user:pass@novel.quwanclass.com/kaoyan/'})
  ]));
  assert.doesNotMatch(articles(html).join(''), /<script|<img|<svg/);
  assert.match(html, /&lt;script&gt;alert\(&quot;title&quot;\)&lt;\/script&gt;/);
  assert.match(html, /value="&quot;&gt;&lt;svg onload=attack\(\)&gt;"/);
  assert.match(html, /&lt;img src=x onerror=&quot;attack\(\)&quot;&gt;/);
  for (const [, href] of articles(html).join('').matchAll(/href="([^"]+)"/g)) {
    const url = new URL(href.replaceAll('&amp;', '&'));
    assert.equal(url.origin, 'https://novel.quwanclass.com');
    assert.equal(url.username, '');
  }
  assert.equal((html.match(/rel="noopener noreferrer"/g) || []).length, 3);
});

function mounted(library) {
  class Element {
    constructor(dataset = {}) { this.dataset = dataset; this.value = ''; this.hidden = false; this.textContent = ''; this.innerHTML = ''; this.attributes = new Map(); this.focusCalls = []; this.scrollCalls = []; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    focus(options) { this.focusCalls.push(options); }
    scrollIntoView(options) { this.scrollCalls.push(options); }
    closest() { return this; }
    matches(selector) { return selector === '[data-kaoyan-art]' && this.dataset.kaoyanArt === ''; }
  }
  const controls = new Map();
  for (const key of ['search', 'genre', 'results', 'count', 'page-count', 'catalog-title']) controls.set(`[data-kaoyan-${key}]`, new Element());
  controls.get('[data-kaoyan-genre]').value = '全部';
  const actions = new Map(['load-more', 'clear-search', 'reset', 'browse'].map(action => [action, new Element({kaoyanAction:action})]));
  for (const [action, element] of actions) controls.set(`[data-kaoyan-action="${action}"]`, element);
  controls.set('.kaoyan-search [data-kaoyan-action="clear-search"]', actions.get('clear-search'));
  const art = new Element({kaoyanArt:''}); art.complete = false; art.naturalWidth = 100;
  controls.set('[data-kaoyan-art]', art);
  const page = kaoyanShelfPage(library);
  controls.get('[data-kaoyan-results]').innerHTML = page.split('data-kaoyan-results>')[1].split('</div><div class="kaoyan-pagination">')[0];
  const count = library.catalogs.filter(item => item.course === '考研').length;
  controls.get('[data-kaoyan-count]').textContent = `已显示 ${Math.min(count, 12)} / ${count} 部目录`;
  actions.get('load-more').hidden = count <= 12; actions.get('clear-search').hidden = true;
  const listeners = new Map();
  const container = {
    querySelector: selector => controls.get(selector),
    contains: element => [...controls.values()].includes(element),
    addEventListener(type, listener) { const set = listeners.get(type) || new Set(); set.add(listener); listeners.set(type, set); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); }
  };
  const root = {querySelector: selector => selector === '[data-kaoyan-shelf]' ? container : null};
  const cleanup = mountKaoyanShelf(root, library);
  const emit = (type, target, extra = {}) => {
    const event = {target, stopped:false, stopPropagation() { this.stopped = true; }, ...extra};
    for (const handler of listeners.get(type) || []) handler(event);
    return event;
  };
  return {root, listeners, actions, cleanup, emit, get: selector => controls.get(selector), click: action => emit('click', actions.get(action))};
}

test('Chinese composition waits for completion and searching title or genre stays scoped to this page', () => {
  const ui = mounted(fixture), search = ui.get('[data-kaoyan-search]'), results = ui.get('[data-kaoyan-results]');
  const original = results.innerHTML;
  search.value = '雨夜';
  ui.emit('compositionstart', search);
  assert.equal(ui.emit('input', search, {isComposing:true}).stopped, true);
  assert.equal(results.innerHTML, original);
  ui.emit('compositionend', search);
  assert.equal(articles(results.innerHTML).length, 1);
  assert.match(results.innerHTML, /雨夜的车站/);
  assert.equal(search.focusCalls.length, 0);
  search.value = '都市'; ui.emit('input', search);
  assert.equal(articles(results.innerHTML).length, 2);
  assert.equal(ui.emit('input', {value:'unrelated field'}).stopped, false);
  ui.click('clear-search');
  assert.equal(search.value, '');
  assert.equal(search.focusCalls.length, 1);
  assert.equal(ui.get('[data-kaoyan-search]'), search);
  assert.equal(articles(results.innerHTML).length, 3);
});

test('title and genre filters compose; clearing text preserves genre and resetting restores all records', () => {
  const ui = mounted(fixture), search = ui.get('[data-kaoyan-search]'), genre = ui.get('[data-kaoyan-genre]'), results = ui.get('[data-kaoyan-results]');
  genre.value = '都市'; assert.equal(ui.emit('change', genre).stopped, true);
  assert.equal(articles(results.innerHTML).length, 2);
  search.value = '回信'; ui.emit('input', search);
  assert.equal(articles(results.innerHTML).length, 0);
  assert.match(results.innerHTML, /没有找到匹配的故事/);
  ui.click('clear-search');
  assert.equal(genre.value, '都市');
  assert.equal(articles(results.innerHTML).length, 2);
  ui.click('reset');
  assert.equal(genre.value, '全部');
  assert.equal(articles(results.innerHTML).length, 3);
  assert.equal(ui.get('[data-kaoyan-count]').textContent, '已显示 3 / 3 部目录');
});

test('batches stop at the actual total and filtering resets the batch without changing the source data', () => {
  const library = libraryWith(Array.from({length:25}, (_, i) => book(i + 1)));
  const before = structuredClone(library);
  const ui = mounted(library), results = ui.get('[data-kaoyan-results]'), search = ui.get('[data-kaoyan-search]');
  assert.equal(articles(results.innerHTML).length, 12);
  ui.click('load-more'); assert.equal(articles(results.innerHTML).length, 24);
  ui.click('load-more'); assert.equal(articles(results.innerHTML).length, 25);
  assert.equal(ui.actions.get('load-more').hidden, true);
  assert.equal(ui.get('[data-kaoyan-page-count]').focusCalls.length, 1);
  search.value = '考研故事 25'; ui.emit('input', search);
  assert.equal(articles(results.innerHTML).length, 1);
  search.value = ''; assert.equal(ui.emit('search', search).stopped, true);
  assert.equal(articles(results.innerHTML).length, 12);
  assert.equal(ui.actions.get('load-more').hidden, false);
  const genre = ui.get('[data-kaoyan-genre]'); genre.value = '都市'; ui.emit('change', genre);
  assert.equal(articles(results.innerHTML).length, 12);
  assert.equal(ui.get('[data-kaoyan-count]').textContent, '已显示 12 / 13 部目录');
  assert.deepEqual(library, before);
});

test('search normalizes fullwidth Latin characters and case', () => {
  const ui = mounted(libraryWith([book(1, {title:'Project A 的回信'}), book(2)]));
  const search = ui.get('[data-kaoyan-search]'); search.value = '  ＰＲＯＪＥＣＴ ａ  '; ui.emit('input', search);
  assert.equal(articles(ui.get('[data-kaoyan-results]').innerHTML).length, 1);
  assert.match(ui.get('[data-kaoyan-results]').innerHTML, /Project A 的回信/);
});

test('empty catalog differs from no-match state and browse focuses its catalog heading without changing routes', () => {
  const html = kaoyanShelfPage(libraryWith([]));
  assert.match(html, /考研目录正在整理/);
  assert.match(html, /href="#library-catalog">返回课程总览/);
  assert.match(html, /data-kaoyan-action="browse" disabled/);
  assert.doesNotMatch(html, /#reader\/|>undefined<|>null</);
  const ui = mounted(fixture);
  ui.click('browse');
  assert.deepEqual(ui.get('[data-kaoyan-catalog-title]').focusCalls, [{preventScroll:true}]);
  assert.deepEqual(ui.get('[data-kaoyan-catalog-title]').scrollCalls, [{block:'start'}]);
});

test('mounting is idempotent, cleanup removes scoped listeners, and failed artwork remains nonfatal', () => {
  assert.doesNotThrow(() => mountKaoyanShelf({querySelector:() => null}, fixture)());
  const ui = mounted(fixture), art = ui.get('[data-kaoyan-art]');
  ui.emit('error', art); assert.equal(art.hidden, true);
  const cleanup = mountKaoyanShelf(ui.root, fixture);
  assert.ok([...ui.listeners.values()].every(set => set.size === 1));
  assert.doesNotThrow(() => ui.emit('click', {}));
  cleanup(); assert.ok([...ui.listeners.values()].every(set => set.size === 0));
});
