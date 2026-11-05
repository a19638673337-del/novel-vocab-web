import {filterCatalog, safeReferenceUrl} from './reference-catalog.mjs';
import {vocabularyBanner, vocabularyContent, vocabularyResults, vocabularySummary} from './ielts-vocabulary.mjs';

const PAGE_SIZE = 12;
const mounts = new WeakMap();
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
const normalized = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
const array = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const validCount = value => Number.isInteger(value) && value >= 0 ? value : null;
const formatted = value => value.toLocaleString('zh-CN');
const viewName = value => ['long', 'short', 'vocabulary'].includes(value) ? value : 'home';
const PART_COVERS = new Set(['part-01', 'part-02', 'part-03', 'part-04', 'part-05']);
const hasPartId = partId => partId !== undefined && partId !== null && partId !== '';
const partIdFor = part => typeof part?.id === 'string' && /^part-[a-z0-9-]{1,40}$/.test(part.id) ? part.id : null;
const selectedPart = (data, partId) => typeof partId === 'string' ? data.parts.find(part => partIdFor(part) === partId) : undefined;
const partHref = part => partIdFor(part) ? `#ielts/long/${partIdFor(part)}` : null;

function dataFor(library) {
  const ielts = library?.ielts || {};
  const longNovel = ielts.longNovel || {};
  const parts = array(longNovel.parts);
  return {shorts:filterCatalog(library?.catalogs, {course:'雅思'}), longNovel, parts, vocabulary:ielts.vocabulary, courseUrl:safeReferenceUrl(ielts.courseUrl)};
}

function longCounts(data) {
  const listedChapters = data.parts.reduce((total, part) => total + array(part.chapters).length, 0);
  return {parts:data.parts.length, chapters:listedChapters};
}

function sourceLink(url, label, accessibleLabel = label) {
  return url ? `<a class="ielts-source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(accessibleLabel)}">${esc(label)} <span aria-hidden="true">↗</span></a>` : '<span class="ielts-source-unavailable">来源链接暂不可用</span>';
}

function shellStart(view, partPage = false) {
  const navigation = [['home', '雅思首页'], ['long', '长篇目录'], ['short', '短篇目录'], ['vocabulary', '雅思词表']].map(([id, label]) => `<a href="${id === 'home' ? '#ielts' : `#ielts/${id}`}" ${view === id ? 'aria-current="page"' : ''}>${label}</a>`).join('');
  return `<section class="ielts-shelf ielts-view-${view}${partPage ? ' ielts-view-part' : ''}" data-ielts-shelf data-ielts-view="${view}"><div class="ielts-top"><a class="back-link" href="${partPage ? '#ielts/long' : view === 'home' ? '#library-catalog' : '#ielts'}"><span aria-hidden="true">←</span> ${partPage ? '返回长篇目录' : view === 'home' ? '返回全站' : '返回雅思书架'}</a><span>ToTo趣味英语 · 雅思专区</span><a class="ielts-download" href="./downloads/ielts-catalog.json" download>导出雅思目录 <span aria-hidden="true">↓</span></a></div><nav class="ielts-section-nav" aria-label="雅思专区导航">${navigation}</nav>`;
}

function notice() {
  return '<div class="ielts-notice"><strong>当前收录公开目录，正文尚未导入。</strong><p>可浏览故事简介、篇章与章节标题；原站标注词数不等于本站已导入词库，也不计入你的阅读记录或词汇覆盖率。</p></div>';
}

function homePage(data) {
  const counts = longCounts(data);
  return `${shellStart('home')}<header class="ielts-heading"><p class="ielts-eyebrow">IELTS · A STORY FOR EVERY MOMENT</p><h1>我的雅思小说</h1><p>喜欢长篇的层层展开，也喜欢短篇的一次心动。</p></header>
    <div class="ielts-home-grid"><article class="ielts-home-card"><a class="ielts-home-art" href="#ielts/long" aria-label="浏览雅思长篇目录"><img src="./assets/ielts-long.png" alt="都市宴会主题的原创雅思长篇插画" width="1086" height="1448" data-ielts-art><div class="ielts-art-title"><span>IELTS LONG NOVEL</span><strong>雅思英语<br>长篇小说</strong></div></a><div class="ielts-home-copy"><p class="ielts-eyebrow">LONG-FORM NOVEL</p><h2>雅思长篇</h2><p class="ielts-home-subtitle">${esc(data.longNovel.title || '长篇故事目录')}</p><p class="ielts-home-description">从故事的开端，一路看到命运转折。按篇章浏览，找到想继续追下去的情节。</p><div class="ielts-home-meta"><span><strong>${counts.chapters}</strong> 章目录</span><span><strong>${counts.parts}</strong> 个篇章</span></div><a class="btn ielts-primary" href="#ielts/long">浏览长篇目录 <span aria-hidden="true">→</span></a></div></article>
    <article class="ielts-home-card"><a class="ielts-home-art" href="#ielts/short" aria-label="浏览雅思短篇目录"><img src="./assets/ielts-short.png" alt="阳光书店主题的原创雅思短篇插画" width="1086" height="1448" data-ielts-art><div class="ielts-art-title"><span>IELTS SHORT STORIES</span><strong>雅思英语<br>短篇合集</strong></div></a><div class="ielts-home-copy"><p class="ielts-eyebrow">SHORT STORY COLLECTION</p><h2>雅思短篇</h2><p class="ielts-home-subtitle">每个故事，都是一次新的遇见。</p><p class="ielts-home-description">古风、都市、奇幻与冒险，从一个喜欢的标题出发。按题材挑选，随时发现下一篇故事。</p><div class="ielts-home-meta"><span><strong>${data.shorts.length}</strong> 篇公开目录</span><span>按标题与题材查找</span></div><a class="btn ielts-primary" href="#ielts/short">浏览短篇目录 <span aria-hidden="true">→</span></a></div></article></div>${vocabularyBanner(data.vocabulary)}${notice()}</section>`;
}

function filteredParts(parts, query) {
  const needle = normalized(query);
  const numeric = needle.match(/^(?:第\s*|chapter\s*)?(\d+)(?:\s*[章话回])?$/i);
  return parts.map(part => {
    const chapters = array(part.chapters);
    const matching = !needle ? chapters : chapters.filter(chapter => numeric ? Number(chapter.no) === Number(numeric[1]) : normalized(chapter.title).includes(needle));
    return {part, chapters:matching};
  }).filter(item => !needle || item.chapters.length);
}

function chapterMarkup(chapter) {
  const no = validCount(chapter.no);
  const count = validCount(chapter.wordCount);
  return `<li><span class="ielts-chapter-number">${no === null ? '章节' : `第 ${no} 章`}</span><span class="ielts-chapter-title">${esc(chapter.title || '章节标题未提供')}</span><small>${count === null ? '词数未提供' : `原站标注 ${formatted(count)} 词`}</small></li>`;
}

function partCoverMarkup(part, index = 0) {
  const title = part.title || '篇章标题未提供';
  const coverTitle = Array.from(title).slice(0, 16).join('') + (Array.from(title).length > 16 ? '…' : '');
  const id = partIdFor(part);
  const image = PART_COVERS.has(id) ? `<img src="./assets/ielts-parts/${id}.webp" alt="" width="480" height="640" loading="lazy" data-ielts-art>` : '';
  return `<div class="ielts-part-cover ielts-part-cover-${index % 3}" aria-hidden="true"><span>IELTS · 长篇小说</span><b>${esc(part.no || '篇章')}</b><strong>${esc(coverTitle)}</strong><small>故事目录 · ToTo趣味英语</small>${image}</div>`;
}

function partCountLabel(part) {
  const count = validCount(part.chapterCount);
  return count === null ? `${array(part.chapters).length} 个已整理标题` : `${count} 章`;
}

function partMarkup(item, index, data, searching) {
  const {part, chapters} = item;
  const count = validCount(part.chapterCount);
  const title = part.title || '篇章标题未提供';
  const href = partHref(part);
  return `<article class="ielts-part">${partCoverMarkup(part, index)}<div class="ielts-part-copy"><div class="ielts-part-topline"><span>${esc(part.no || '篇章序号未提供')} · ${partCountLabel(part)}</span><span>${esc(part.range || '章范围未提供')}</span></div><h2>${esc(title)}</h2><p class="ielts-part-intro">${esc(part.intro || '暂无篇章简介，可以展开已整理的章节目录。')}</p>${href ? `<a class="btn ielts-primary ielts-part-enter" href="${href}" aria-label="查看章节：${esc(title)}">查看章节 <span aria-hidden="true">→</span></a>` : ''}<details class="ielts-part-details" ${searching ? 'open' : ''}><summary>快速展开章节 <span>${searching ? `${chapters.length} 章匹配` : count === null ? `${chapters.length} 个已整理标题` : `${count} 章`} <b aria-hidden="true">＋</b></span></summary><div class="ielts-part-detail-body">${chapters.length ? `<ol class="ielts-chapters">${chapters.map(chapterMarkup).join('')}</ol>` : '<p class="ielts-empty-detail">暂未整理章节标题。</p>'}${sourceLink(data.courseUrl, '到原站雅思专区', `到原站查看篇章：${title}`)}</div></details></div></article>`;
}

function longResults(data, query) {
  const matching = filteredParts(data.parts, query);
  if (matching.length) return matching.map((item, index) => partMarkup(item, index, data, Boolean(normalized(query)))).join('');
  if (!data.parts.length) return '<div class="ielts-empty"><h2>长篇目录正在整理</h2><p>目前没有可展示的篇章资料，你可以先看看短篇目录。</p><a class="btn" href="#ielts/short">浏览短篇目录</a></div>';
  return '<div class="ielts-empty"><h2>没有找到这个章节</h2><p>试试章节标题中的关键词，或输入章号，例如 20。</p><button class="btn" type="button" data-ielts-action="clear-search">清空搜索</button></div>';
}

function longSummary(data, query) {
  const matching = filteredParts(data.parts, query);
  const count = matching.reduce((total, item) => total + item.chapters.length, 0);
  return normalized(query) ? `找到 ${count} 个章节标题 · 分布在 ${matching.length} 个篇章` : `${matching.length} 个篇章 · 已整理 ${count} 个章节标题`;
}

function searchMarkup(view) {
  const long = view === 'long';
  return `<div class="search-box ielts-search"><label class="ielts-visually-hidden" for="ielts-search">${long ? '搜索章节标题或章号' : '搜索短篇标题或题材'}</label><input id="ielts-search" type="search" placeholder="${long ? '搜索章节标题或章号，例如 20' : '搜索短篇标题或题材'}" autocomplete="off" data-ielts-search><button class="clear-search" type="button" data-ielts-action="clear-search" aria-label="清空${long ? '章节' : '短篇'}搜索" hidden>×</button></div>`;
}

function longPage(data) {
  const counts = longCounts(data);
  return `${shellStart('long')}<header class="ielts-long-intro"><p class="ielts-eyebrow">IELTS LONG NOVEL</p><h1>${esc(data.longNovel.title || '雅思长篇目录')}</h1><p>一部长篇，${counts.parts} 个篇章。从开篇到终章，沿着故事的转折挑选想看的章节。</p><div class="ielts-long-meta"><span>${counts.chapters} 章公开目录</span><span>${counts.parts} 个篇章</span><a href="#ielts/short">换一本短篇看看 <span aria-hidden="true">→</span></a></div></header>${notice()}<div class="ielts-tools"><h2>篇章目录</h2>${searchMarkup('long')}</div><p class="ielts-result-count" data-ielts-count role="status" aria-live="polite" aria-atomic="true">${longSummary(data, '')}</p><div class="ielts-parts" data-ielts-results>${longResults(data, '')}</div></section>`;
}

function partResults(part, query) {
  const chapters = filteredParts([part], query)[0]?.chapters || [];
  if (chapters.length) return `<ol class="ielts-chapters">${chapters.map(chapterMarkup).join('')}</ol>`;
  if (!array(part.chapters).length) return '<div class="ielts-empty"><h2>这个篇章的章节目录尚未整理</h2><p>你可以返回长篇目录，浏览其他篇章。</p><a class="btn" href="#ielts/long">返回长篇目录</a></div>';
  return '<div class="ielts-empty"><h2>本篇没有找到这个章节</h2><p>这里仅搜索当前篇章。清空关键词，或返回长篇目录跨篇查找。</p><button class="btn" type="button" data-ielts-action="clear-search">清空搜索</button></div>';
}

function partSummary(part, query) {
  const total = array(part.chapters).length;
  const count = filteredParts([part], query)[0]?.chapters.length || 0;
  return normalized(query) ? `本篇找到 ${count} / ${total} 个章节标题` : `本篇已整理 ${total} 个章节标题`;
}

function partPage(data, partId) {
  const part = selectedPart(data, partId);
  if (!part) return `${shellStart('long', true)}<div class="ielts-empty"><h1>没有找到这个篇章</h1><p>这个篇章地址无效或资料尚未整理。请从长篇目录选择一个篇章。</p><a class="btn" href="#ielts/long">返回长篇目录</a></div></section>`;
  const navigable = data.parts.filter(item => partIdFor(item));
  const index = navigable.indexOf(part);
  const previous = navigable[index - 1];
  const next = navigable[index + 1];
  return `${shellStart('long', true)}<header class="ielts-part-page-header">${partCoverMarkup(part, data.parts.indexOf(part))}<div><p class="ielts-eyebrow">${esc(data.longNovel.title || '雅思长篇')}</p><div class="ielts-part-topline"><span>${esc(part.no || '篇章序号未提供')} · ${partCountLabel(part)}</span><span>${esc(part.range || '章范围未提供')}</span></div><h1>${esc(part.title || '篇章标题未提供')}</h1><p class="ielts-part-page-intro">${esc(part.intro || '暂无篇章简介，可以在下方浏览已整理的章节标题。')}</p></div></header>${notice()}<div class="ielts-tools"><h2>本篇章节目录</h2>${searchMarkup('long')}</div><p class="ielts-result-count" data-ielts-count role="status" aria-live="polite" aria-atomic="true">${partSummary(part, '')}</p><div class="ielts-part-page-chapters" data-ielts-results>${partResults(part, '')}</div><div class="ielts-part-page-source">${sourceLink(data.courseUrl, '到原站雅思专区')}</div><nav class="ielts-part-navigation" aria-label="篇章导航">${previous ? `<a href="${partHref(previous)}"><span>← 上一篇</span><strong>${esc(previous.title || '篇章标题未提供')}</strong></a>` : '<span class="ielts-part-boundary">已是第一篇</span>'}${next ? `<a href="${partHref(next)}"><span>下一篇 →</span><strong>${esc(next.title || '篇章标题未提供')}</strong></a>` : '<span class="ielts-part-boundary">已是最后一篇</span>'}</nav></section>`;
}

function shortMeta(book) {
  const chapters = validCount(book.chapterCount);
  const words = validCount(book.originalWordCount ?? book.wordCount);
  return `${chapters === null ? '章数未提供' : `${chapters} 章`} · ${words === null ? '词数未提供' : `原站标注 ${formatted(words)} 词`}`;
}

function shortCard(book, index) {
  const title = book.title || '未命名目录条目';
  const no = validCount(book.no);
  const source = safeReferenceUrl(book.sourceUrl);
  const coverTitle = book.coverShortTitle || title;
  const abbreviated = Array.from(coverTitle).slice(0, 14).join('') + (Array.from(coverTitle).length > 14 ? '…' : '');
  return `<article class="ielts-short-card"><div class="ielts-short-cover ielts-part-cover-${index % 3}" aria-hidden="true"><span>雅思英语短篇</span><b>${no === null ? '目录' : String(no).padStart(2, '0')}</b><strong>${esc(abbreviated)}</strong><small>故事目录 · ToTo趣味英语</small></div><div class="ielts-short-copy"><div class="ielts-short-topline"><span>${esc(book.genre || '雅思短篇')}</span><span>${no === null ? '序号未提供' : `No.${String(no).padStart(2, '0')}`}</span></div><h3>${esc(title)}</h3><p>${esc(book.intro || '暂无故事简介，可到原站课程页查看目录资料。')}</p><span class="ielts-short-meta">${shortMeta(book)}</span><div class="ielts-short-footer">${sourceLink(source, '到原站查看', `到原站查看：${title}`)}</div></div></article>`;
}

function shortMatches(data, state) {
  return filterCatalog(data.shorts, {course:'雅思', query:state.query, genre:state.genre});
}

function shortResults(data, state) {
  const matching = shortMatches(data, state);
  if (matching.length) return matching.slice(0, state.page * PAGE_SIZE).map(book => shortCard(book, data.shorts.indexOf(book))).join('');
  if (!data.shorts.length) return '<div class="ielts-empty"><h2>短篇目录正在整理</h2><p>目前没有可展示的短篇资料，你可以先看看长篇目录。</p><a class="btn" href="#ielts/long">浏览长篇目录</a></div>';
  return '<div class="ielts-empty"><h2>没有找到匹配的故事</h2><p>试试更短的关键词，或清空搜索和题材筛选。</p><button class="btn" type="button" data-ielts-action="reset">清空筛选</button></div>';
}

function shortSummary(data, state) {
  const count = shortMatches(data, state).length;
  return `已显示 ${Math.min(count, state.page * PAGE_SIZE)} / ${count} 篇目录`;
}

function shortPage(data) {
  const state = {query:'', genre:'全部', page:1};
  const genres = [...new Set(data.shorts.map(book => book.genre).filter(value => typeof value === 'string' && value.trim()))].sort((left, right) => left.localeCompare(right, 'zh-CN'));
  return `${shellStart('short')}<header class="ielts-heading ielts-short-heading"><p class="ielts-eyebrow">IELTS SHORT STORIES</p><h1>雅思短篇小说</h1><p>${data.shorts.length} 篇公开故事目录，找一篇此刻想看的。</p></header>${notice()}<div class="ielts-tools"><h2>全部故事</h2><div class="ielts-short-filters">${searchMarkup('short')}<label class="ielts-genre-label" for="ielts-genre">题材<select id="ielts-genre" data-ielts-genre><option value="全部">全部题材</option>${genres.map(genre => `<option value="${esc(genre)}">${esc(genre)}</option>`).join('')}</select></label></div></div><p class="ielts-result-count" data-ielts-count role="status" aria-live="polite" aria-atomic="true">${shortSummary(data, state)}</p><div class="ielts-short-grid" data-ielts-results>${shortResults(data, state)}</div><div class="ielts-pagination"><p data-ielts-page-count>${shortSummary(data, state)}</p><button class="btn" type="button" data-ielts-action="load-more" ${data.shorts.length <= PAGE_SIZE ? 'hidden' : ''}>再看 12 篇故事</button></div></section>`;
}

export function ieltsPage(library, view = 'home', partId) {
  const data = dataFor(library);
  if (viewName(view) === 'vocabulary') return `${shellStart('vocabulary')}${vocabularyContent(data.vocabulary)}</section>`;
  if (viewName(view) === 'long') return hasPartId(partId) ? partPage(data, partId) : longPage(data);
  return viewName(view) === 'short' ? shortPage(data) : homePage(data);
}

export function mountIeltsPage(root, library, view = 'home', partId) {
  const container = root.querySelector('[data-ielts-shelf]');
  if (!container) return () => {};
  mounts.get(container)?.();
  const currentView = viewName(view);
  const data = dataFor(library);
  const activePart = currentView === 'long' && hasPartId(partId) ? selectedPart(data, partId) : null;
  const state = {query:'', genre:'全部', page:1};
  const search = container.querySelector('[data-ielts-search]');
  const genre = container.querySelector('[data-ielts-genre]');
  const results = container.querySelector('[data-ielts-results]');
  const clear = container.querySelector('.ielts-search [data-ielts-action="clear-search"]');
  const more = container.querySelector('[data-ielts-action="load-more"]');
  const pageCount = container.querySelector('[data-ielts-page-count]');
  let composing = false;

  function update() {
    if (!results) return;
    if (currentView === 'vocabulary') {
      results.innerHTML = vocabularyResults(data.vocabulary, state.query);
      container.querySelector('[data-ielts-count]').textContent = vocabularySummary(data.vocabulary, state.query);
    } else if (currentView === 'long') {
      results.innerHTML = activePart ? partResults(activePart, state.query) : longResults(data, state.query);
      container.querySelector('[data-ielts-count]').textContent = activePart ? partSummary(activePart, state.query) : longSummary(data, state.query);
    } else {
      const total = shortMatches(data, state).length;
      results.innerHTML = shortResults(data, state);
      container.querySelector('[data-ielts-count]').textContent = shortSummary(data, state);
      pageCount.textContent = shortSummary(data, state);
      more.hidden = state.page * PAGE_SIZE >= total;
    }
    clear.hidden = !search.value;
    hideBrokenImages();
  }
  function runSearch() {
    state.query = search.value;
    state.page = 1;
    update();
  }
  function onInput(event) {
    if (!search || event.target !== search) return;
    event.stopPropagation();
    clear.hidden = !search.value;
    if (!composing && !event.isComposing) runSearch();
  }
  function onCompositionStart(event) {
    if (!search || event.target !== search) return;
    event.stopPropagation();
    composing = true;
  }
  function onCompositionEnd(event) {
    if (!search || event.target !== search) return;
    event.stopPropagation();
    composing = false;
    runSearch();
  }
  function onSearch(event) {
    if (!search || event.target !== search) return;
    event.stopPropagation();
    if (!composing) runSearch();
  }
  function onChange(event) {
    if (!genre || event.target !== genre) return;
    event.stopPropagation();
    state.genre = genre.value;
    state.page = 1;
    update();
  }
  function onClick(event) {
    const button = event.target.closest('[data-ielts-action]');
    if (!button || !container.contains(button)) return;
    event.stopPropagation();
    const action = button.dataset.ieltsAction;
    if (action === 'load-more') state.page += 1;
    else if (action === 'clear-search' || action === 'reset') {
      state.query = '';
      state.page = 1;
      composing = false;
      search.value = '';
      if (action === 'reset' && genre) {state.genre = '全部'; genre.value = '全部';}
      search.focus();
    } else return;
    update();
    if (button === more && more?.hidden) {
      pageCount.setAttribute('tabindex', '-1');
      pageCount.focus({preventScroll:true});
    }
  }
  function onImageError(event) {
    if (event.target?.matches?.('[data-ielts-art]')) event.target.hidden = true;
  }
  function hideBrokenImages() {
    container.querySelectorAll('[data-ielts-art]').forEach(image => {if (image.complete && image.naturalWidth === 0) image.hidden = true;});
  }
  const listeners = {input:onInput, compositionstart:onCompositionStart, compositionend:onCompositionEnd, search:onSearch, change:onChange, click:onClick};
  for (const [type, handler] of Object.entries(listeners)) container.addEventListener(type, handler);
  container.addEventListener('error', onImageError, true);
  hideBrokenImages();
  const cleanup = () => {
    for (const [type, handler] of Object.entries(listeners)) container.removeEventListener(type, handler);
    container.removeEventListener('error', onImageError, true);
    mounts.delete(container);
  };
  mounts.set(container, cleanup);
  return cleanup;
}
