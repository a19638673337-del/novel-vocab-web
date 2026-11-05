import {filterCatalog, safeReferenceUrl} from './reference-catalog.mjs';

const PAGE_SIZE = 12;
const SOURCE_URL = 'https://novel.quwanclass.com/gaokao/?account=unified';
const mounts = new WeakMap();
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
const booksFor = library => filterCatalog(library?.catalogs, {course:'高中'});
const titleFor = book => book?.title || '未命名目录条目';
const numberFor = book => Number.isInteger(book?.no) && book.no > 0 ? book.no : null;
const countFor = value => Number.isInteger(value) && value >= 0 ? value.toLocaleString('zh-CN') : null;
const chaptersFor = book => Array.isArray(book?.chapters) ? book.chapters.filter(item => item && typeof item === 'object') : [];

function metaFor(book) {
  const words = countFor(book.originalWordCount ?? book.wordCount);
  const chapters = countFor(book.chapterCount);
  return `${chapters === null ? '章数未提供' : `${chapters} 章`} · ${words === null ? '词数未提供' : `原站标注 ${words} 词`}`;
}

function chapterMarkup(book) {
  const chapters = chaptersFor(book);
  if (!chapters.length) return '<p class="gaokao-chapters-empty">暂未整理章节标题。</p>';
  return `<ol class="gaokao-chapters">${chapters.map((chapter, index) => {
    const count = countFor(chapter.wordCount);
    return `<li><span class="gaokao-chapter-no">${esc(chapter.no ?? index + 1)}</span><span>${esc(chapter.title || '章节标题未提供')}</span>${count !== null ? `<small>原站标注 ${count} 词</small>` : ''}</li>`;
  }).join('')}</ol>`;
}

function cardMarkup(book, index) {
  const no = numberFor(book);
  const title = titleFor(book);
  const source = safeReferenceUrl(book.sourceUrl) || SOURCE_URL;
  const coverTitle = Array.from(title).slice(0, 14).join('') + (Array.from(title).length > 14 ? '…' : '');
  return `<article class="gaokao-card" data-gaokao-book="${index}" tabindex="-1" aria-labelledby="gaokao-book-title-${index}">
    <div class="gaokao-text-cover gaokao-cover-${index % 4}" aria-hidden="true"><span class="gaokao-cover-kicker">高中英语小说</span><span class="gaokao-cover-number">${no === null ? '目录' : String(no).padStart(2, '0')}</span><strong>${esc(coverTitle)}</strong><span class="gaokao-cover-footer">故事目录 · ToTo趣味英语</span></div>
    <div class="gaokao-card-copy"><div class="gaokao-card-topline"><span>高中英语</span><span>${no === null ? '序号未提供' : `No.${String(no).padStart(2, '0')}`}</span></div><h3 id="gaokao-book-title-${index}">${esc(title)}</h3><p class="gaokao-card-intro">${esc(book.intro || '暂无故事简介，可展开资料查看已整理的信息。')}</p><p class="gaokao-card-meta">${metaFor(book)}</p>
      <details class="gaokao-details"><summary>资料详情 <span aria-hidden="true">＋</span></summary><div class="gaokao-details-body"><h4>章节目录</h4>${chapterMarkup(book)}<a class="gaokao-source-link" href="${esc(source)}" target="_blank" rel="noopener noreferrer" aria-label="到原站高中专区查看：${esc(title)}">到原站高中专区 <span aria-hidden="true">↗</span></a></div></details>
    </div>
  </article>`;
}

function matchingBooks(data, query) {
  return filterCatalog(data, {course:'高中', query});
}

function resultsMarkup(data, state) {
  const matching = matchingBooks(data, state.query);
  if (matching.length) return matching.slice(0, state.page * PAGE_SIZE).map(book => cardMarkup(book, data.indexOf(book))).join('');
  if (!data.length) return '<div class="gaokao-empty"><h3>高中目录正在整理</h3><p>目前没有可展示的资料条目。你可以先浏览其他课程。</p><a class="btn" href="#library-catalog">返回课程总览</a></div>';
  return '<div class="gaokao-empty"><h3>没有找到这个标题</h3><p>换一个关键词，或清空搜索看看全部故事。</p><button class="btn" type="button" data-gaokao-action="clear-search">清空搜索</button></div>';
}

function summary(data, state) {
  const total = matchingBooks(data, state.query).length;
  return `已显示 ${Math.min(total, state.page * PAGE_SIZE)} / ${total} 部目录`;
}

export function gaokaoShelfPage(library) {
  const data = booksFor(library);
  const featured = data[0];
  const state = {query:'', page:1};
  return `<section class="gaokao-shelf" data-gaokao-shelf>
    <div class="gaokao-top"><a class="back-link" href="#library-catalog"><span aria-hidden="true">←</span> 返回全站</a><span>ToTo趣味英语 · 高中专区</span><a class="gaokao-download" href="./downloads/gaokao-catalog.json" download>导出资料目录 <span aria-hidden="true">↓</span></a></div>
    <div class="gaokao-heading"><div><p class="section-eyebrow">SENIOR HIGH · STORY COLLECTION</p><h1>高中英语小说</h1><p>把喜欢的故事放进书架，从一个标题开始探索。</p></div><span class="gaokao-heading-label">高中学习方向</span></div>
    <section class="gaokao-hero" aria-labelledby="gaokao-featured-title"><div class="gaokao-hero-art"><img src="./assets/course-gaokao.png" alt="黄昏樱花长廊中的校园故事原创插画" width="1086" height="1448" data-gaokao-art><span class="gaokao-art-caption">在故事里，遇见新的自己。</span></div><div class="gaokao-hero-copy"><p class="gaokao-hero-kicker">本期目录推荐</p><h2 id="gaokao-featured-title" data-gaokao-featured-title>${esc(featured ? titleFor(featured) : '下一篇故事，正在路上')}</h2><p class="gaokao-hero-intro" data-gaokao-featured-intro>${esc(featured?.intro || '浏览高中小说资料，找到你感兴趣的故事。')}</p><p class="gaokao-hero-meta" data-gaokao-featured-meta>${featured ? metaFor(featured) : '暂无推荐目录'}</p><button class="btn gaokao-primary" type="button" data-gaokao-action="locate" ${featured ? '' : 'disabled'}>查看这篇资料 <span aria-hidden="true">→</span></button><div class="gaokao-hero-pagination"><div class="gaokao-hero-controls"><button type="button" data-gaokao-action="previous" aria-label="上一篇推荐" ${data.length < 2 ? 'disabled' : ''}>←</button><button type="button" data-gaokao-action="next" aria-label="下一篇推荐" ${data.length < 2 ? 'disabled' : ''}>→</button></div><span data-gaokao-featured-count role="status" aria-live="polite">${data.length ? `推荐 1 / ${data.length}` : '暂无推荐'}</span></div></div></section>
    <div class="gaokao-stats" aria-label="高中专区资料统计"><div><strong>${data.length}</strong><span>已整理小说目录</span></div><div><strong>3,500</strong><span>原站标注学习目标 · 非已导入词数</span></div><div><strong>0</strong><span>本站已导入正文</span></div></div>
    <div class="gaokao-notice"><strong>先选故事，浏览公开资料。</strong><p>这里展示小说简介、原站标注词数与章节标题；正文尚未导入本站。目录数量和原站学习目标不计入你的已学词汇或覆盖率。</p></div>
    <section class="gaokao-catalog" aria-labelledby="gaokao-catalog-title"><div class="gaokao-catalog-tools"><h2 id="gaokao-catalog-title">全部故事目录 <span>${data.length} 部</span></h2><div class="search-box gaokao-search"><label class="gaokao-visually-hidden" for="gaokao-search">搜索高中小说标题</label><input id="gaokao-search" type="search" placeholder="搜索小说标题" autocomplete="off" data-gaokao-search><button class="clear-search" type="button" data-gaokao-action="clear-search" aria-label="清空高中目录搜索" hidden>×</button></div></div><p class="gaokao-result-count" data-gaokao-count role="status" aria-live="polite" aria-atomic="true">${summary(data, state)}</p><div class="gaokao-grid" data-gaokao-results>${resultsMarkup(data, state)}</div><div class="gaokao-pagination"><p data-gaokao-page-count>${summary(data, state)}</p><button class="btn" type="button" data-gaokao-action="load-more" ${data.length <= PAGE_SIZE ? 'hidden' : ''}>再看 12 部故事</button></div></section>
  </section>`;
}

export function mountGaokaoShelf(root, library) {
  const container = root.querySelector('[data-gaokao-shelf]');
  if (!container) return () => {};
  mounts.get(container)?.();
  const data = booksFor(library);
  const state = {query:'', page:1, featured:0};
  const search = container.querySelector('[data-gaokao-search]');
  const results = container.querySelector('[data-gaokao-results]');
  const more = container.querySelector('[data-gaokao-action="load-more"]');
  const clear = container.querySelector('.gaokao-search [data-gaokao-action="clear-search"]');
  const pageCount = container.querySelector('[data-gaokao-page-count]');
  let composing = false;

  function updateResults() {
    const total = matchingBooks(data, state.query).length;
    results.innerHTML = resultsMarkup(data, state);
    container.querySelector('[data-gaokao-count]').textContent = summary(data, state);
    pageCount.textContent = summary(data, state);
    clear.hidden = !search.value;
    more.hidden = state.page * PAGE_SIZE >= total;
  }
  function updateFeatured() {
    const book = data[state.featured];
    if (!book) return;
    container.querySelector('[data-gaokao-featured-title]').textContent = titleFor(book);
    container.querySelector('[data-gaokao-featured-intro]').textContent = book.intro || '暂无故事简介，可查看这篇资料了解已整理的信息。';
    container.querySelector('[data-gaokao-featured-meta]').textContent = metaFor(book);
    container.querySelector('[data-gaokao-featured-count]').textContent = `推荐 ${state.featured + 1} / ${data.length}`;
  }
  function runSearch() {
    state.query = search.value;
    state.page = 1;
    updateResults();
  }
  function onInput(event) {
    if (event.target !== search) return;
    event.stopPropagation();
    clear.hidden = !search.value;
    if (!composing && !event.isComposing) runSearch();
  }
  function onCompositionStart(event) {
    if (event.target !== search) return;
    event.stopPropagation();
    composing = true;
  }
  function onCompositionEnd(event) {
    if (event.target !== search) return;
    event.stopPropagation();
    composing = false;
    runSearch();
  }
  function onSearch(event) {
    if (event.target !== search) return;
    event.stopPropagation();
    if (!composing) runSearch();
  }
  function onClick(event) {
    const button = event.target.closest('[data-gaokao-action]');
    if (!button || !container.contains(button)) return;
    event.stopPropagation();
    const action = button.dataset.gaokaoAction;
    if (action === 'previous' || action === 'next') {
      if (data.length < 2) return;
      state.featured = (state.featured + (action === 'next' ? 1 : -1) + data.length) % data.length;
      updateFeatured();
      return;
    }
    if (action === 'load-more') state.page += 1;
    else if (action === 'clear-search' || action === 'locate') {
      search.value = '';
      state.query = '';
      composing = false;
      state.page = action === 'locate' ? Math.floor(state.featured / PAGE_SIZE) + 1 : 1;
      if (action === 'clear-search') search.focus();
    } else return;
    updateResults();
    if (action === 'locate') {
      const card = container.querySelector(`[data-gaokao-book="${state.featured}"]`);
      card?.focus({preventScroll:true});
      card?.scrollIntoView({block:'center'});
    } else if (button === more && more.hidden) {
      pageCount.setAttribute('tabindex', '-1');
      pageCount.focus({preventScroll:true});
    }
  }
  function onImageError(event) {
    if (!event.target?.matches?.('[data-gaokao-art]')) return;
    event.target.hidden = true;
  }
  const listeners = {input:onInput, compositionstart:onCompositionStart, compositionend:onCompositionEnd, search:onSearch, click:onClick};
  for (const [type, handler] of Object.entries(listeners)) container.addEventListener(type, handler);
  container.addEventListener('error', onImageError, true);
  const art = container.querySelector('[data-gaokao-art]');
  if (art?.complete && art.naturalWidth === 0) art.hidden = true;
  const cleanup = () => {
    for (const [type, handler] of Object.entries(listeners)) container.removeEventListener(type, handler);
    container.removeEventListener('error', onImageError, true);
    mounts.delete(container);
  };
  mounts.set(container, cleanup);
  return cleanup;
}
