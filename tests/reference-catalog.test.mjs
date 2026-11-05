import test from 'node:test';
import assert from 'node:assert/strict';
import {filterCatalog, safeReferenceUrl, referenceCatalogPage, mountReferenceCatalog} from '../client/reference-catalog.mjs';

const fixture = [
  {id:'cet-book-01', no:1, title:'火车站的 LETTER', course:'四六级', genre:'悬疑', chapterCount:1, originalWordCount:105, sourceUrl:'https://novel.quwanclass.com/cet/'},
  {id:'ielts-book-01', no:1, title:'月光下的账簿', course:'雅思', genre:'奇幻', originalWordCount:112, sourceUrl:'https://novel.quwanclass.com/'},
  {id:'senior-book-01', no:1, title:'校园里的最后一课', course:'高中', genre:'校园', wordCount:87, sourceUrl:'https://novel.quwanclass.com/senior/'}
];

test('local catalog filtering combines course, genre and normalized title search without changing source data', () => {
  const before = structuredClone(fixture);
  assert.deepEqual(filterCatalog(fixture, {query:' ｌｅｔｔｅｒ ', course:'四六级', genre:'悬疑'}), [fixture[0]]);
  assert.deepEqual(filterCatalog(fixture, {query:'奇幻'}), [fixture[1]]);
  assert.deepEqual(filterCatalog(fixture, {course:'考研'}), []);
  assert.deepEqual(filterCatalog(fixture, {course:'雅思', genre:'悬疑'}), []);
  assert.deepEqual(fixture, before);
  assert.deepEqual(filterCatalog(null), []);
});

test('external links allow only HTTPS on the exact source origin without credentials', () => {
  assert.equal(safeReferenceUrl('https://novel.quwanclass.com/cet/?account=unified#library-catalog'), 'https://novel.quwanclass.com/cet/?account=unified#library-catalog');
  for (const url of ['http://novel.quwanclass.com/', 'javascript:alert(1)', '//novel.quwanclass.com/', 'https://novel.quwanclass.com.attacker.test/', 'https://user:secret@novel.quwanclass.com/', 'https://novel.quwanclass.com:8443/', '/cet/', '', null]) {
    assert.equal(safeReferenceUrl(url), null, String(url));
  }
});

test('rendering escapes metadata and disables invalid links without inventing chapter counts', () => {
  const html = referenceCatalogPage([{title:'<img src=x onerror="alert(1)">', course:'雅思', genre:'" onfocus="attack', originalWordCount:107, sourceUrl:'javascript:alert(1)'}]);
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /来源链接暂不可用/);
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes('1 章'));
  assert.match(html, /原站标注 107 词/);
  assert.match(html, /仅目录参考/);
  assert.ok(!html.includes('#reader'));
});

test('course counts are dynamic, unknown initial course falls back to all, and unavailable courses offer a route back', () => {
  const html = referenceCatalogPage(fixture, 'unknown');
  assert.match(html, /已整理 <strong>3<\/strong>/);
  assert.match(html, /data-ref-course="全部" aria-pressed="true"/);
  assert.match(html, /data-ref-course="高中" aria-pressed="false"><span>高中<\/span><span class="ref-course-count">1<\/span>/);
  assert.match(html, /显示 3 \/ 3 条目录/);
  const empty = referenceCatalogPage(fixture, '考研');
  assert.match(empty, /这个专区的目录还未整理/);
  assert.match(empty, /href="#library-catalog">返回课程总览/);
  assert.match(empty, /id="reference-load-more"[^>]*hidden/);
});

function mounted(catalogs, initialCourse = '全部') {
  class Element {
    constructor(dataset = {}) { this.dataset = dataset; this.value = ''; this.hidden = false; this.innerHTML = ''; this.textContent = ''; this.attributes = new Map(); this.focusCalls = 0; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    focus() { this.focusCalls += 1; }
    closest() { return this; }
  }
  const controls = new Map([
    ['#reference-search', new Element()], ['#reference-genre', new Element()], ['#reference-results', new Element()],
    ['#reference-load-more', new Element({refAction:'load-more'})], ['[data-ref-action="clear-search"]', new Element({refAction:'clear-search'})],
    ['#reference-count', new Element()], ['#reference-page-count', new Element()], ['#reference-course-title', new Element()]
  ]);
  const courses = new Map(['全部', '四六级', '雅思', '高中', '考研'].map(course => [course, new Element({refCourse:course})]));
  const listeners = new Map();
  const container = {
    querySelector: selector => controls.get(selector),
    querySelectorAll: () => [...courses.values()],
    contains: element => [...controls.values(), ...courses.values()].includes(element),
    addEventListener(type, handler) { const handlers = listeners.get(type) || new Set(); handlers.add(handler); listeners.set(type, handlers); },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); }
  };
  const root = {querySelector: selector => selector === '[data-reference-catalog]' ? container : null};
  const cleanup = mountReferenceCatalog(root, catalogs, initialCourse);
  const emit = (type, target, extra = {}) => {
    const event = {target, stopped:false, stopPropagation() { this.stopped = true; }, ...extra};
    for (const listener of listeners.get(type) || []) listener(event);
    return event;
  };
  return {controls, courses, listeners, root, cleanup, emit, get: selector => controls.get(selector)};
}

test('IME waits until composition ends, search updates locally, and clearing restores focus', () => {
  const ui = mounted(fixture), search = ui.get('#reference-search'), results = ui.get('#reference-results');
  search.value = '火车';
  ui.emit('compositionstart', search);
  assert.equal(ui.emit('input', search, {isComposing:true}).stopped, true);
  assert.equal(results.innerHTML, '');
  assert.equal(ui.emit('compositionend', search).stopped, true);
  assert.match(results.innerHTML, /火车站的 LETTER/);
  assert.ok(!results.innerHTML.includes('月光下的账簿'));
  assert.equal(ui.get('#reference-count').textContent, '显示 1 / 1 条目录');
  assert.equal(search.focusCalls, 0);
  ui.emit('click', ui.get('[data-ref-action="clear-search"]'));
  assert.equal(search.value, '');
  assert.equal(search.focusCalls, 1);
  assert.equal(ui.get('#reference-count').textContent, '显示 3 / 3 条目录');
  assert.equal(ui.get('[data-ref-action="clear-search"]').hidden, true);
});

test('load more adds 24 entries, course switching resets pagination and genre, and the last batch moves focus to its count', () => {
  const data = [...Array.from({length:50}, (_, index) => ({...fixture[0], id:`cet-${index}`, title:`故事 ${index}`, no:index + 1})), fixture[1]];
  const ui = mounted(data, '四六级'), more = ui.get('#reference-load-more');
  const genre = ui.get('#reference-genre');
  genre.value = '悬疑';
  ui.emit('change', genre);
  assert.equal(ui.get('#reference-count').textContent, '显示 24 / 50 条目录');
  ui.emit('click', more);
  assert.equal(ui.get('#reference-count').textContent, '显示 48 / 50 条目录');
  ui.emit('click', more);
  assert.equal(ui.get('#reference-count').textContent, '显示 50 / 50 条目录');
  assert.equal(more.hidden, true);
  assert.equal(ui.get('#reference-page-count').focusCalls, 1);
  ui.emit('click', ui.courses.get('雅思'));
  assert.equal(genre.value, '全部');
  assert.ok(!genre.innerHTML.includes('悬疑'));
  assert.match(genre.innerHTML, /奇幻/);
  assert.equal(ui.get('#reference-count').textContent, '显示 1 / 1 条目录');
  assert.equal(ui.courses.get('雅思').attributes.get('aria-pressed'), 'true');
  ui.emit('click', ui.courses.get('四六级'));
  assert.equal(ui.get('#reference-count').textContent, '显示 24 / 50 条目录');
  assert.equal(more.hidden, false);
});

test('mount owns only its container, remount removes old listeners, and cleanup is reusable', () => {
  assert.doesNotThrow(() => mountReferenceCatalog({querySelector:() => null}, fixture)());
  const ui = mounted(fixture);
  const outside = {value:'outside'};
  assert.equal(ui.emit('input', outside).stopped, false);
  const cleanup = mountReferenceCatalog(ui.root, fixture);
  assert.ok([...ui.listeners.values()].every(handlers => handlers.size === 1));
  cleanup();
  assert.ok([...ui.listeners.values()].every(handlers => handlers.size === 0));
  cleanup();
});
