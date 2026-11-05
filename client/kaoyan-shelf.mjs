import {filterCatalog, safeReferenceUrl} from './reference-catalog.mjs';

const PAGE_SIZE = 12;
const SOURCE_URL = 'https://novel.quwanclass.com/kaoyan/?account=unified';
const mounts = new WeakMap();
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
const booksFor = library => filterCatalog(library?.catalogs, {course:'考研'});
const titleFor = book => book?.title || '未命名目录条目';
const countFor = value => Number.isInteger(value) && value >= 0 ? value.toLocaleString('zh-CN') : null;
const genresFor = books => [...new Set(books.map(book => book.genre).filter(value => typeof value === 'string' && value.trim()))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
const matchingBooks = (books, state) => filterCatalog(books, {course:'考研', query:state.query, genre:state.genre});

function metadata(book) {
  const chapters = countFor(book.chapterCount);
  const words = countFor(book.originalWordCount ?? book.wordCount);
  return `${chapters === null ? '章数未提供' : `${chapters} 章`} · ${words === null ? '词数未提供' : `原站标注 ${words} 词`}`;
}

function cardMarkup(book, index) {
  const title = titleFor(book);
  const sequence = Number.isInteger(book.no) && book.no > 0 ? String(book.no).padStart(2, '0') : null;
  const letters = Array.from(String(title));
  const coverTitle = letters.slice(0, 16).join('') + (letters.length > 16 ? '…' : '');
  const sourceUrl = safeReferenceUrl(book.sourceUrl) || SOURCE_URL;
  return `<article class="kaoyan-card" aria-labelledby="kaoyan-book-title-${index}">
    <div class="kaoyan-text-cover kaoyan-cover-${index % 3}" aria-hidden="true"><span>考研英语小说</span><b>${sequence || '目录'}</b><strong>${esc(coverTitle)}</strong><small>故事目录 · ToTo趣味英语</small></div>
    <div class="kaoyan-card-copy"><div class="kaoyan-card-topline"><span>${esc(book.genre || '题材未提供')}</span><span>${sequence ? `No.${sequence}` : '序号未提供'}</span></div><h3 id="kaoyan-book-title-${index}">${esc(title)}</h3><p class="kaoyan-card-intro">${esc(book.intro || '故事简介尚未提供。')}</p><p class="kaoyan-card-meta">${metadata(book)}</p><details class="kaoyan-details"><summary>资料详情 <span aria-hidden="true">＋</span></summary><div><p>已整理公开目录信息；章节标题、小说正文与考研词表尚未导入。</p><a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="到原站考研专区查看：${esc(title)}">到原站考研专区 <span aria-hidden="true">↗</span></a></div></details></div>
  </article>`;
}

function resultsMarkup(books, state) {
  const matching = matchingBooks(books, state);
  if (matching.length) return matching.slice(0, state.page * PAGE_SIZE).map(book => cardMarkup(book, books.indexOf(book))).join('');
  if (!books.length) return '<div class="kaoyan-empty"><h3>考研目录正在整理</h3><p>目前没有可展示的资料条目，可以先浏览其他课程。</p><a class="btn" href="#library-catalog">返回课程总览</a></div>';
  return '<div class="kaoyan-empty"><h3>没有找到匹配的故事</h3><p>换一个标题关键词，或清空题材筛选看看全部目录。</p><button class="btn" type="button" data-kaoyan-action="reset">清空筛选</button></div>';
}

function summary(books, state) {
  const total = matchingBooks(books, state).length;
  return `已显示 ${Math.min(total, state.page * PAGE_SIZE)} / ${total} 部目录`;
}

export function kaoyanShelfPage(library) {
  const books = booksFor(library);
  const genres = genresFor(books);
  const state = {query:'', genre:'全部', page:1};
  return `<section class="kaoyan-shelf" data-kaoyan-shelf>
    <div class="kaoyan-top"><a class="back-link" href="#library-catalog">← 返回全站</a><span>ToTo趣味英语 · 考研专区</span><a href="./downloads/kaoyan-catalog.json" download>导出资料目录 ↓</a></div>
    <header class="kaoyan-heading"><p class="section-eyebrow">POSTGRADUATE · STORY COLLECTION</p><h1>我的考研小说</h1><p>从喜欢的题材出发，找到下一段想读的故事。</p></header>
    <section class="kaoyan-hero" aria-labelledby="kaoyan-hero-title"><div class="kaoyan-hero-copy"><p class="kaoyan-hero-kicker">考研英语 · 故事目录</p><h2 id="kaoyan-hero-title">让下一次翻页，<br>也成为向前一步。</h2><p>都市、校园、古风与奇幻，先选一部感兴趣的小说，看看故事的开场。</p><button class="btn kaoyan-primary" type="button" data-kaoyan-action="browse" ${books.length ? '' : 'disabled'}>浏览全部目录 <span aria-hidden="true">→</span></button><span class="kaoyan-hero-caption">已整理 ${books.length} 部公开目录</span></div><div class="kaoyan-hero-art"><img src="./assets/course-kaoyan.png" alt="考研英语小说专区插画" width="1086" height="1448" data-kaoyan-art></div></section>
    <div class="kaoyan-stats" aria-label="考研专区资料统计"><div><strong>${books.length}</strong><span>已整理小说目录</span></div><div><strong>${genres.length}</strong><span>已收录故事题材</span></div><div><strong>0</strong><span>本站已导入正文</span></div></div>
    <div class="kaoyan-notice"><strong>公开目录；正文与考研词表尚未导入。</strong><p>可浏览小说标题、题材、简介、章数与原站标注词数。原站标注词数不等于本站已导入词数，目录资料不计入阅读进度或词汇覆盖率。</p></div>
    <section class="kaoyan-catalog" aria-labelledby="kaoyan-catalog-title"><div class="kaoyan-catalog-heading"><h2 id="kaoyan-catalog-title" tabindex="-1" data-kaoyan-catalog-title>全部故事目录 <span>${books.length} 部</span></h2><p>选择题材，慢慢翻阅。</p></div><div class="kaoyan-tools"><div class="search-box kaoyan-search"><label class="kaoyan-visually-hidden" for="kaoyan-search">搜索考研小说标题或题材</label><input id="kaoyan-search" type="search" placeholder="搜索标题或题材" autocomplete="off" data-kaoyan-search><button class="clear-search" type="button" data-kaoyan-action="clear-search" aria-label="清空考研目录搜索" hidden>×</button></div><label class="kaoyan-genre" for="kaoyan-genre">题材<select id="kaoyan-genre" data-kaoyan-genre><option value="全部">全部题材</option>${genres.map(genre => `<option value="${esc(genre)}">${esc(genre)}</option>`).join('')}</select></label></div><p class="kaoyan-result-count" data-kaoyan-count role="status" aria-live="polite" aria-atomic="true">${summary(books, state)}</p><div class="kaoyan-grid" data-kaoyan-results>${resultsMarkup(books, state)}</div><div class="kaoyan-pagination"><p data-kaoyan-page-count>${summary(books, state)}</p><button class="btn" type="button" data-kaoyan-action="load-more" ${books.length <= PAGE_SIZE ? 'hidden' : ''}>再看 12 部故事</button></div></section>
  </section>`;
}

export function mountKaoyanShelf(root, library) {
  const container = root.querySelector('[data-kaoyan-shelf]');
  if (!container) return () => {};
  mounts.get(container)?.();
  const books = booksFor(library);
  const state = {query:'', genre:'全部', page:1};
  const search = container.querySelector('[data-kaoyan-search]');
  const genre = container.querySelector('[data-kaoyan-genre]');
  const results = container.querySelector('[data-kaoyan-results]');
  const more = container.querySelector('[data-kaoyan-action="load-more"]');
  const clear = container.querySelector('.kaoyan-search [data-kaoyan-action="clear-search"]');
  const pageCount = container.querySelector('[data-kaoyan-page-count]');
  let composing = false;

  function update() {
    results.innerHTML = resultsMarkup(books, state);
    const message = summary(books, state);
    container.querySelector('[data-kaoyan-count]').textContent = message;
    pageCount.textContent = message;
    clear.hidden = !search.value;
    more.hidden = state.page * PAGE_SIZE >= matchingBooks(books, state).length;
  }
  function runSearch() { state.query = search.value; state.page = 1; update(); }
  function onInput(event) {
    if (event.target !== search) return;
    event.stopPropagation();
    clear.hidden = !search.value;
    if (!composing && !event.isComposing) runSearch();
  }
  function onCompositionStart(event) {
    if (event.target !== search) return;
    event.stopPropagation(); composing = true;
  }
  function onCompositionEnd(event) {
    if (event.target !== search) return;
    event.stopPropagation(); composing = false; runSearch();
  }
  function onSearch(event) {
    if (event.target !== search) return;
    event.stopPropagation();
    if (!composing) runSearch();
  }
  function onChange(event) {
    if (event.target !== genre) return;
    event.stopPropagation(); state.genre = genre.value; state.page = 1; update();
  }
  function onClick(event) {
    const button = event.target?.closest?.('[data-kaoyan-action]');
    if (!button || !container.contains(button)) return;
    event.stopPropagation();
    const action = button.dataset.kaoyanAction;
    if (action === 'browse') {
      const heading = container.querySelector('[data-kaoyan-catalog-title]');
      heading?.focus({preventScroll:true}); heading?.scrollIntoView({block:'start'}); return;
    }
    if (action === 'load-more') state.page += 1;
    else if (action === 'clear-search' || action === 'reset') {
      search.value = ''; state.query = ''; state.page = 1; composing = false;
      if (action === 'reset') { genre.value = '全部'; state.genre = '全部'; }
      search.focus();
    } else return;
    update();
    if (button === more && more.hidden) { pageCount.setAttribute('tabindex', '-1'); pageCount.focus({preventScroll:true}); }
  }
  function onImageError(event) {
    if (event.target?.matches?.('[data-kaoyan-art]')) event.target.hidden = true;
  }
  const listeners = {input:onInput, compositionstart:onCompositionStart, compositionend:onCompositionEnd, search:onSearch, change:onChange, click:onClick};
  for (const [type, handler] of Object.entries(listeners)) container.addEventListener(type, handler);
  container.addEventListener('error', onImageError, true);
  const art = container.querySelector('[data-kaoyan-art]');
  if (art?.complete && art.naturalWidth === 0) art.hidden = true;
  const cleanup = () => {
    for (const [type, handler] of Object.entries(listeners)) container.removeEventListener(type, handler);
    container.removeEventListener('error', onImageError, true);
    mounts.delete(container);
  };
  mounts.set(container, cleanup);
  return cleanup;
}
