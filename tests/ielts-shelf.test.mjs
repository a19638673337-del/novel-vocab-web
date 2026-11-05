import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ieltsPage, mountIeltsPage} from '../client/ielts-shelf.mjs';

const sourceUrl = 'https://novel.quwanclass.com/?account=unified';
const shortBook = (index, overrides = {}) => ({
  id:`ielts-book-${index}`, course:'雅思', no:index, title:`短篇故事 ${index}`,
  genre:index % 2 ? '奇幻' : '都市', intro:`故事 ${index} 的公开简介。`,
  chapterCount:1, originalWordCount:100 + index, sourceUrl, ...overrides
});
const fixture = {
  books:[{id:'story-0001', title:'本站原创故事'}],
  stats:{loaded:3162, used:596, coverage:18.85},
  catalogs:[
    shortBook(1, {title:'雨夜的 LETTER'}),
    shortBook(2, {title:'清晨的回信'}),
    shortBook(3, {title:'月光下的账簿'}),
    shortBook(4, {id:'cet-book-04', course:'四六级', title:'外课程专属标题'})
  ],
  ielts:{courseUrl:sourceUrl, longNovel:{
    title:'从月台寄出的信', chapterCount:100, partCount:5,
    parts:[
      {id:'part-01', no:'第一篇', title:'新的身份', range:'第 1–20 章', intro:'城市中的第一封信。', chapterCount:2,
        chapters:[{no:1, title:'Letters at Dawn', wordCount:23}, {no:20, title:'雨夜的回信', wordCount:25}]},
      {id:'part-02', no:'第二篇', title:'另一端的灯火', range:'第 21 章', intro:'有人等着下一班车。', chapterCount:1,
        chapters:[{no:21, title:'清晨的站台', wordCount:28}]}
    ]
  }}
};
const shortCards = html => [...html.matchAll(/<article class="ielts-short-card">[\s\S]*?<\/article>/g)].map(match => match[0]);
const partCards = html => [...html.matchAll(/<article class="ielts-part">[\s\S]*?<\/article>/g)].map(match => match[0]);
const withCatalogs = catalogs => ({...fixture, catalogs});

const vocabularyFixture = {...fixture, ielts:{...fixture.ielts, vocabulary:{site_declared_total:9399, entries:[
  {ordinal:1, word:'A.D.', ipa_uk:'/eɪ diː/', ipa_us:'/eɪ diː/', pos:'abbr.', meaning:'公元'},
  {ordinal:2, word:'abandon', ipa_uk:'/əˈbændən/', ipa_us:'/əˈbændən/', pos:'vt.', meaning:'放弃；抛弃'},
  {ordinal:3, word:'abandonment', ipa_uk:'/əˈbændənmənt/', ipa_us:'/əˈbændənmənt/', pos:'n.', meaning:'放弃；遗弃'}
]}}};

test('IELTS vocabulary uses actual imported entries and separate downloads, never claims full coverage or playback', () => {
  const before = structuredClone(vocabularyFixture);
  const html = ieltsPage(vocabularyFixture, 'vocabulary');
  assert.match(html, /<strong>3<\/strong><span>实际收录词数/);
  assert.match(html, /目前导入其中 3 词，另有 9,396 词尚未提供/);
  assert.equal((html.match(/class="ielts-word-entry"/g) || []).length, 3);
  for (const kind of ['csv', 'json']) assert.ok(html.includes(`./downloads/ielts-vocabulary.${kind}`));
  assert.match(html, /lang="en-GB"/);
  assert.match(html, /lang="en-US"/);
  assert.match(html, /不计入四六级原创小说覆盖率/);
  assert.match(ieltsPage(vocabularyFixture), /已收录 3 词/);
  for (const view of ['home', 'long', 'short', 'vocabulary']) assert.match(ieltsPage(vocabularyFixture, view), /href="#ielts\/vocabulary"/);
  assert.doesNotMatch(html, /data-action="(?:pronounce|bookmark)"|#reader\//);
  assert.deepEqual(vocabularyFixture, before);
});

test('IELTS vocabulary escapes imported text and renders absent data without invented entries', () => {
  const html = ieltsPage({ielts:{vocabulary:{entries:[{word:'<script>word</script>', meaning:'<img onerror="x">', pos:'<b>n.</b>', ipa_uk:'<svg>'}]}}}, 'vocabulary');
  assert.doesNotMatch(html, /<script|<img|<svg|<b>n/);
  assert.match(html, /&lt;script&gt;word/);
  assert.match(html, /&lt;img onerror=&quot;x&quot;&gt;/);
  const empty = ieltsPage({}, 'vocabulary');
  assert.match(empty, /词表尚未导入/);
  assert.doesNotMatch(empty, /class="ielts-word-entry"|ielts-vocabulary\.csv/);
});

test('IELTS vocabulary supports English and Chinese search, IME, empty result and focus-preserving clear', () => {
  const ui = mounted(vocabularyFixture, 'vocabulary');
  const search = ui.get('[data-ielts-search]'), results = ui.get('[data-ielts-results]');
  search.value = ' ＡＢＡＮＤＯＮ '; ui.emit('input', search);
  assert.equal(ui.get('[data-ielts-count]').textContent, '找到 2 / 3 个词');
  assert.doesNotMatch(results.innerHTML, /A\.D\./);
  const previous = results.innerHTML;
  search.value = '公元'; ui.emit('compositionstart', search); ui.emit('input', search, {isComposing:true});
  assert.equal(results.innerHTML, previous);
  ui.emit('compositionend', search);
  assert.match(results.innerHTML, /A\.D\./);
  assert.equal(ui.get('[data-ielts-count]').textContent, '找到 1 / 3 个词');
  search.value = 'not-in-file'; ui.emit('search', search);
  assert.match(results.innerHTML, /已收录词表中没有找到/);
  ui.click('clear-search');
  assert.equal(search.value, '');
  assert.equal(search.focusCalls.length, 1);
  assert.equal(ui.get('[data-ielts-count]').textContent, '已收录 3 个词 · 按原词表顺序排列');
  assert.equal((results.innerHTML.match(/class="ielts-word-entry"/g) || []).length, 3);
  ui.cleanup();
  const cleaned = results.innerHTML;
  search.value = 'abandon'; ui.emit('input', search);
  assert.equal(results.innerHTML, cleaned);
});

test('home offers the three real routes and counts available records without changing learning data', () => {
  const before = structuredClone(fixture);
  const html = ieltsPage(fixture);
  for (const route of ['#library-catalog', '#ielts/long', '#ielts/short']) assert.ok(html.includes(`href="${route}"`));
  assert.match(html, /<strong>3<\/strong> 章目录/);
  assert.match(html, /<strong>2<\/strong> 个篇章/);
  assert.match(html, /<strong>3<\/strong> 篇公开目录/);
  assert.match(html, /正文尚未导入/);
  assert.match(html, /不计入你的阅读记录或词汇覆盖率/);
  assert.doesNotMatch(html, /<strong>100<\/strong>|<strong>5<\/strong>|#reader\/|外课程专属标题|本站原创故事/);
  assert.equal(ieltsPage(fixture, 'unknown-view'), html);
  assert.deepEqual(fixture, before);
});

test('long and short pages keep missing source values unknown rather than inventing chapters or reading access', () => {
  const library = {
    ...fixture,
    catalogs:[shortBook(1, {no:null, title:'只有标题', intro:null, genre:null, chapterCount:null, originalWordCount:null})],
    ielts:{courseUrl:sourceUrl, longNovel:{parts:[{title:'只有篇章标题', chapters:[{title:'只有章节标题'}]}]}}
  };
  const short = ieltsPage(library, 'short'), long = ieltsPage(library, 'long');
  assert.match(short, /序号未提供/);
  assert.match(short, /章数未提供 · 词数未提供/);
  assert.match(short, /暂无故事简介/);
  assert.doesNotMatch(short, /No\.01|原站标注 0 词/);
  assert.match(long, /篇章序号未提供/);
  assert.match(long, /章范围未提供/);
  assert.match(long, /1 个已整理标题/);
  assert.match(long, /class="ielts-chapter-number">章节<\/span>/);
  assert.match(long, /词数未提供/);
  assert.doesNotMatch(long + short, /#reader\/|>null<|>undefined<|第 1 章/);
});

test('all public metadata is escaped and external links accept only the exact HTTPS source origin', () => {
  const library = {
    ...fixture,
    catalogs:[
      shortBook(1, {title:'<script>alert("title")</script>', genre:'" onfocus="attack()', intro:'<img src=x onerror="attack()">', coverShortTitle:'<b>封面</b>', sourceUrl:'javascript:alert(1)'}),
      shortBook(2, {sourceUrl:'https://novel.quwanclass.com.attacker.invalid/'}),
      shortBook(3, {sourceUrl:'https://user:secret@novel.quwanclass.com/'}),
      shortBook(4, {sourceUrl:'https://novel.quwanclass.com/?book=1&view=short'})
    ],
    ielts:{courseUrl:'https://novel.quwanclass.com/?view=long&account=unified', longNovel:{
      title:'<script>unsafe</script>', parts:[{no:'<img src=x>', title:'<b>篇章</b>', range:'" onmouseover="x', intro:'<svg onload=attack()>',
        chapters:[{no:1, title:'<i>章节</i>', wordCount:9}]}]
    }}
  };
  const short = ieltsPage(library, 'short'), long = ieltsPage(library, 'long'), home = ieltsPage(library);
  assert.doesNotMatch(short + long, /<script|<img|<svg|<b>篇章|<i>章节/);
  assert.match(short, /&lt;script&gt;alert\(&quot;title&quot;\)&lt;\/script&gt;/);
  assert.match(short, /&lt;img src=x onerror=&quot;attack\(\)&quot;&gt;/);
  assert.match(long, /&lt;i&gt;章节&lt;\/i&gt;/);
  assert.match(home, /&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.equal((short.match(/来源链接暂不可用/g) || []).length, 3);
  for (const [, href] of (short + long).matchAll(/href="(https:[^"]+)"/g)) {
    const url = new URL(href.replaceAll('&amp;', '&'));
    assert.equal(url.origin, 'https://novel.quwanclass.com');
    assert.equal(url.username, '');
  }
  assert.match(short, /book=1&amp;view=short/);
  assert.equal((short.match(/rel="noopener noreferrer"/g) || []).length, 1);
  const unsafeLong = ieltsPage({...library, ielts:{...library.ielts, courseUrl:'http://novel.quwanclass.com/'}}, 'long');
  assert.match(unsafeLong, /来源链接暂不可用/);
  assert.doesNotMatch(unsafeLong, /href="http:/);
});

function mounted(library, view = 'home', partId) {
  class Element {
    constructor(dataset = {}) {
      this.dataset = dataset; this.value = ''; this.hidden = false; this.innerHTML = ''; this.textContent = '';
      this.attributes = new Map(); this.focusCalls = [];
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    focus(options) { this.focusCalls.push(options); }
    closest(selector) { return selector === '[data-ielts-action]' && this.dataset.ieltsAction ? this : null; }
    matches(selector) { return selector === '[data-ielts-art]' && this.dataset.ieltsArt === ''; }
  }
  const html = ieltsPage(library, view, partId);
  const controls = new Map();
  for (const key of ['search', 'genre', 'results', 'count', 'page-count']) {
    if (html.includes(`data-ielts-${key}`)) controls.set(`[data-ielts-${key}]`, new Element());
  }
  const actions = new Map();
  if (controls.has('[data-ielts-search]')) actions.set('clear-search', new Element({ieltsAction:'clear-search'}));
  if (view === 'short') {
    actions.set('load-more', new Element({ieltsAction:'load-more'}));
    actions.set('reset', new Element({ieltsAction:'reset'}));
  }
  for (const [action, element] of actions) controls.set(`[data-ielts-action="${action}"]`, element);
  controls.set('.ielts-search [data-ielts-action="clear-search"]', actions.get('clear-search'));
  if (actions.has('clear-search')) actions.get('clear-search').hidden = true;
  const results = controls.get('[data-ielts-results]');
  const resultEnd = view === 'short' ? '</div><div class="ielts-pagination">' : partId === undefined ? '</div></section>' : '</div><div class="ielts-part-page-source">';
  if (results) results.innerHTML = html.split('data-ielts-results>')[1].split(resultEnd)[0];
  const initialCount = html.match(/data-ielts-count[^>]*>([^<]+)<\/p>/)?.[1];
  if (initialCount) controls.get('[data-ielts-count]').textContent = initialCount;
  if (view === 'short') {
    controls.get('[data-ielts-genre]').value = '全部';
    controls.get('[data-ielts-page-count]').textContent = initialCount;
    actions.get('load-more').hidden = /data-ielts-action="load-more" hidden/.test(html);
  }
  const images = [...html.matchAll(/<img[^>]*data-ielts-art/g)].map(() => {
    const image = new Element({ieltsArt:''}); image.complete = false; image.naturalWidth = 100; return image;
  });
  const listeners = new Map();
  const container = {
    querySelector: selector => controls.get(selector),
    querySelectorAll: selector => selector === '[data-ielts-art]' ? images : [],
    contains: element => [...controls.values(), ...images].includes(element),
    addEventListener(type, handler) { const handlers = listeners.get(type) || new Set(); handlers.add(handler); listeners.set(type, handlers); },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); }
  };
  const root = {querySelector: selector => selector === '[data-ielts-shelf]' ? container : null};
  const cleanup = mountIeltsPage(root, library, view, partId);
  const emit = (type, target, extra = {}) => {
    const event = {target, stopped:false, stopPropagation() { this.stopped = true; }, ...extra};
    for (const listener of listeners.get(type) || []) listener(event);
    return event;
  };
  return {root, listeners, images, cleanup, emit, actions, get:selector => controls.get(selector), click:action => emit('click', actions.get(action))};
}

test('long chapter search matches exact source numbers, normalizes text and opens matching parts', () => {
  const ui = mounted(fixture, 'long'), search = ui.get('[data-ielts-search]'), results = ui.get('[data-ielts-results]');
  assert.equal(partCards(results.innerHTML).length, 2);
  assert.doesNotMatch(results.innerHTML, /class="ielts-part-details" open/);
  for (const query of ['20', '第20章', 'Chapter 20']) {
    search.value = query; ui.emit('input', search);
    assert.equal(partCards(results.innerHTML).length, 1);
    assert.match(results.innerHTML, /雨夜的回信/);
    assert.doesNotMatch(results.innerHTML, /清晨的站台|Letters at Dawn/);
    assert.match(results.innerHTML, /class="ielts-part-details" open/);
    assert.equal(ui.get('[data-ielts-count]').textContent, '找到 1 个章节标题 · 分布在 1 个篇章');
  }
  search.value = '2'; ui.emit('input', search);
  assert.match(results.innerHTML, /没有找到这个章节/);
  search.value = ' ＬＥＴＴＥＲＳ '; ui.emit('input', search);
  assert.match(results.innerHTML, /Letters at Dawn/);
  ui.click('clear-search');
  assert.equal(search.value, '');
  assert.equal(search.focusCalls.length, 1);
  assert.equal(partCards(results.innerHTML).length, 2);
  assert.doesNotMatch(results.innerHTML, /class="ielts-part-details" open/);
});

test('short IME search stays local, combines with genre and preserves the input while clearing', () => {
  const ui = mounted(fixture, 'short'), search = ui.get('[data-ielts-search]'), results = ui.get('[data-ielts-results]');
  const genre = ui.get('[data-ielts-genre]'), original = results.innerHTML;
  search.value = '雨夜';
  assert.equal(ui.emit('compositionstart', search).stopped, true);
  assert.equal(ui.emit('input', search, {isComposing:true}).stopped, true);
  assert.equal(results.innerHTML, original);
  assert.equal(ui.emit('compositionend', search).stopped, true);
  assert.equal(shortCards(results.innerHTML).length, 1);
  assert.match(results.innerHTML, /雨夜的 LETTER/);
  assert.equal(search.focusCalls.length, 0);
  genre.value = '都市';
  assert.equal(ui.emit('change', genre).stopped, true);
  assert.match(results.innerHTML, /没有找到匹配的故事/);
  ui.click('clear-search');
  assert.equal(search.value, '');
  assert.equal(genre.value, '都市');
  assert.equal(ui.get('[data-ielts-search]'), search);
  assert.equal(shortCards(results.innerHTML).length, 1);
  assert.match(results.innerHTML, /清晨的回信/);
  assert.equal(search.focusCalls.length, 1);
  ui.click('reset');
  assert.equal(genre.value, '全部');
  assert.equal(shortCards(results.innerHTML).length, 3);
  assert.equal(ui.actions.get('clear-search').hidden, true);
  assert.equal(ui.emit('input', {value:'unrelated'}).stopped, false);
  assert.equal(ui.emit('change', {value:'unrelated'}).stopped, false);
});

test('short pagination ends at the actual total, focuses its result count and resets after search or genre changes', () => {
  const library = withCatalogs(Array.from({length:25}, (_, index) => shortBook(index + 1)));
  const before = structuredClone(library), ui = mounted(library, 'short');
  const results = ui.get('[data-ielts-results]'), search = ui.get('[data-ielts-search]'), genre = ui.get('[data-ielts-genre]');
  assert.equal(shortCards(results.innerHTML).length, 12);
  ui.click('load-more');
  assert.equal(shortCards(results.innerHTML).length, 24);
  ui.click('load-more');
  assert.equal(shortCards(results.innerHTML).length, 25);
  assert.equal(ui.get('[data-ielts-count]').textContent, '已显示 25 / 25 篇目录');
  assert.equal(ui.actions.get('load-more').hidden, true);
  assert.deepEqual(ui.get('[data-ielts-page-count]').focusCalls, [{preventScroll:true}]);
  search.value = '短篇故事 25'; ui.emit('input', search);
  assert.equal(shortCards(results.innerHTML).length, 1);
  search.value = ''; assert.equal(ui.emit('search', search).stopped, true);
  assert.equal(shortCards(results.innerHTML).length, 12);
  assert.equal(ui.actions.get('load-more').hidden, false);
  ui.click('load-more');
  genre.value = '奇幻'; ui.emit('change', genre);
  assert.equal(shortCards(results.innerHTML).length, 12);
  assert.equal(ui.get('[data-ielts-count]').textContent, '已显示 12 / 13 篇目录');
  assert.deepEqual(library, before);
});

test('empty sources and unmatched searches have distinct recoverable states with no reader links', () => {
  const empty = {catalogs:[], ielts:{longNovel:{parts:[]}}};
  const long = ieltsPage(empty, 'long'), short = ieltsPage(empty, 'short');
  assert.match(long, /长篇目录正在整理/);
  assert.match(long, /href="#ielts\/short"/);
  assert.match(short, /短篇目录正在整理/);
  assert.match(short, /href="#ielts\/long"/);
  assert.doesNotMatch(long + short, /#reader\/|>null<|>undefined</);
  const emptyUi = mounted(empty, 'short');
  assert.doesNotThrow(() => emptyUi.click('reset'));
  const ui = mounted(fixture, 'short'), search = ui.get('[data-ielts-search]');
  search.value = 'unmatched'; ui.emit('input', search);
  assert.match(ui.get('[data-ielts-results]').innerHTML, /没有找到匹配的故事/);
  assert.equal(ui.get('[data-ielts-count]').textContent, '已显示 0 / 0 篇目录');
  ui.click('reset');
  assert.equal(shortCards(ui.get('[data-ielts-results]').innerHTML).length, 3);
});

test('mounts are scoped, image failures are nonfatal and remount plus cleanup remove all owned listeners', () => {
  assert.doesNotThrow(() => mountIeltsPage({querySelector:() => null}, fixture)());
  const home = mounted(fixture, 'unknown-view');
  assert.equal(home.images.length, 2);
  home.emit('error', home.images[0]);
  assert.equal(home.images[0].hidden, true);
  const ui = mounted(fixture, 'short');
  const cleanup = mountIeltsPage(ui.root, fixture, 'short');
  assert.ok([...ui.listeners.values()].every(handlers => handlers.size === 1));
  cleanup(); cleanup();
  assert.ok([...ui.listeners.values()].every(handlers => handlers.size === 0));
  const results = ui.get('[data-ielts-results]'), original = results.innerHTML;
  ui.get('[data-ielts-search]').value = '雨夜';
  ui.emit('input', ui.get('[data-ielts-search]'));
  assert.equal(results.innerHTML, original);
  home.cleanup();
  assert.ok([...home.listeners.values()].every(handlers => handlers.size === 0));
});

test('the long catalog offers direct part links while keeping chapters separate from readable stories', () => {
  const before = structuredClone(fixture), html = ieltsPage(fixture, 'long');
  for (const part of fixture.ielts.longNovel.parts) assert.ok(html.includes(`href="#ielts/long/${part.id}"`));
  assert.doesNotMatch(html, /#reader\//);
  assert.match(html, /正文尚未导入/);
  assert.deepEqual(fixture, before);
});

test('a direct part page shows only its own chapters and adjacent navigation stops at the real boundaries', () => {
  const before = structuredClone(fixture);
  const first = ieltsPage(fixture, 'long', 'part-01');
  const last = ieltsPage(fixture, 'long', 'part-02');
  assert.match(first, /<h1[^>]*>新的身份<\/h1>/);
  assert.match(first, /城市中的第一封信。/);
  assert.match(first, /Letters at Dawn/);
  assert.match(first, /雨夜的回信/);
  assert.doesNotMatch(first, /清晨的站台/);
  assert.match(first, /href="#ielts\/long\/part-02"/);
  assert.doesNotMatch(first, /href="#ielts\/long\/part-00"/);
  assert.match(last, /<h1[^>]*>另一端的灯火<\/h1>/);
  assert.match(last, /清晨的站台/);
  assert.doesNotMatch(last, /Letters at Dawn|雨夜的回信/);
  assert.match(last, /href="#ielts\/long\/part-01"/);
  assert.doesNotMatch(last, /href="#ielts\/long\/part-03"/);
  const adjacentLinks = html => [...html.match(/<nav[^>]*aria-label="篇章导航"[^>]*>([\s\S]*?)<\/nav>/)[1].matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(adjacentLinks(first), ['#ielts/long/part-02']);
  assert.deepEqual(adjacentLinks(last), ['#ielts/long/part-01']);
  for (const html of [first, last]) {
    assert.match(html, /href="#ielts\/long"/);
    assert.match(html, /正文尚未导入/);
    assert.doesNotMatch(html, /#reader\//);
  }
  assert.deepEqual(fixture, before);
});

test('unknown or hostile part identifiers cannot become image paths, links or another part chapter list', () => {
  for (const partId of ['part-99', '../../outside', '"><img src=x onerror="attack()">']) {
    const html = ieltsPage(fixture, 'long', partId);
    assert.match(html, /href="#ielts\/long"/);
    assert.doesNotMatch(html, /Letters at Dawn|雨夜的回信|清晨的站台|#reader\//);
    assert.doesNotMatch(html, /<img src=x|(?:src|href)="[^"\s]*(?:outside|part-99|attack)/);
  }
  const library = structuredClone(fixture);
  library.ielts.longNovel.parts[0].title = '<svg onload="attack()">';
  library.ielts.longNovel.parts[0].intro = '<script>attack()</script>';
  const html = ieltsPage(library, 'long', 'part-01');
  assert.match(html, /&lt;svg onload=&quot;attack\(\)&quot;&gt;/);
  assert.match(html, /&lt;script&gt;attack\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<svg|<script/);
});

test('direct-part IME and chapter search stay within the selected part and clear into the same input', () => {
  const ui = mounted(fixture, 'long', 'part-01');
  const search = ui.get('[data-ielts-search]'), results = ui.get('[data-ielts-results]');
  const original = results.innerHTML;
  assert.match(original, /Letters at Dawn/);
  assert.doesNotMatch(original, /清晨的站台/);
  search.value = '雨夜';
  assert.equal(ui.emit('compositionstart', search).stopped, true);
  assert.equal(ui.emit('input', search, {isComposing:true}).stopped, true);
  assert.equal(results.innerHTML, original);
  assert.equal(ui.emit('compositionend', search).stopped, true);
  assert.match(results.innerHTML, /雨夜的回信/);
  assert.doesNotMatch(results.innerHTML, /Letters at Dawn|清晨的站台/);
  search.value = '21'; ui.emit('input', search);
  assert.doesNotMatch(results.innerHTML, /清晨的站台|Letters at Dawn|雨夜的回信/);
  assert.match(results.innerHTML, /data-ielts-action="clear-search"/);
  ui.click('clear-search');
  assert.equal(search.value, '');
  assert.equal(ui.get('[data-ielts-search]'), search);
  assert.equal(search.focusCalls.length, 1);
  assert.match(results.innerHTML, /Letters at Dawn/);
  assert.match(results.innerHTML, /雨夜的回信/);
  assert.doesNotMatch(results.innerHTML, /清晨的站台/);
  assert.equal(ui.actions.get('clear-search').hidden, true);
});

test('the five known parts use fixed local 480 by 640 covers and never trust source cover URLs', () => {
  const parts = Array.from({length:5}, (_, index) => ({
    id:`part-0${index + 1}`, no:`Part 0${index + 1}`, title:`篇章 ${index + 1}`, chapterCount:1,
    cover:'https://attacker.invalid/track.webp',
    chapters:[{no:index + 1, title:`章节 ${index + 1}`, wordCount:100, sourceAvailable:true}]
  }));
  const library = {...fixture, ielts:{...fixture.ielts, longNovel:{title:'五个篇章', parts}}};
  const catalog = ieltsPage(library, 'long');
  for (const part of parts) {
    const path = `./assets/ielts-parts/${part.id}.webp`;
    for (const html of [catalog, ieltsPage(library, 'long', part.id)]) {
      const images = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
      const image = images.find(tag => tag.includes(`src="${path}"`));
      assert.ok(image, `missing fixed cover for ${part.id}`);
      assert.match(image, /width="480"/);
      assert.match(image, /height="640"/);
      assert.match(image, /data-ielts-art/);
      assert.doesNotMatch(html, /src="https:\/\/attacker|#reader\//);
    }
    const bytes = readFileSync(new URL(`../client/assets/ielts-parts/${part.id}.webp`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  const ui = mounted(library, 'long', 'part-01');
  assert.ok(ui.images.length >= 1);
  ui.emit('error', ui.images[0]);
  assert.equal(ui.images[0].hidden, true);
  const cleanup = mountIeltsPage(ui.root, library, 'long', 'part-01');
  assert.ok([...ui.listeners.values()].every(handlers => handlers.size === 1));
  cleanup();
  assert.ok([...ui.listeners.values()].every(handlers => handlers.size === 0));
});
