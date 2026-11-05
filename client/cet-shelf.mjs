const PAGE_SIZE = 12;
const mounts = new WeakMap();
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
const validCount = value => Number.isInteger(value) && value >= 0;
const number = value => (validCount(value) ? value : 0).toLocaleString('zh-CN');
const safeBooks = books => Array.isArray(books) ? books.filter(book => book && typeof book === 'object' && typeof book.id === 'string' && book.id) : [];
const originalsFor = books => safeBooks(books).filter(book => book.kind === 'original');
const routeFor = (page, id) => `#${page}/${encodeURIComponent(id)}`;
const normalizeQuery = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();

function readingFor(book, progress) {
  const raw = progress?.readings?.[book.id]?.ratio;
  const ratio = Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0;
  const answers = progress?.answers?.[book.id];
  const hasAnswers = answers && typeof answers === 'object' && Object.values(answers).some(value => typeof value === 'string' && value.trim());
  const status = ratio === 1 ? 'finished' : ratio > 0 || hasAnswers ? 'started' : 'unread';
  return {ratio, status, label:status === 'finished' ? '读到末尾' : status === 'started' ? '阅读中' : '未开始'};
}

function matchingBooks(books, state, progress) {
  const query = normalizeQuery(state.query);
  return books.filter(book => (state.genre === 'all' || book.genre === state.genre) &&
    (state.reading === 'all' || readingFor(book, progress).status === state.reading) &&
    (!query || normalizeQuery(`${book.title ?? ''} ${book.description ?? ''} ${book.genre ?? ''}`).includes(query)));
}

function contentStats(library) {
  const words = Array.isArray(library?.lexicon) ? library.lexicon.filter(word => word && typeof word === 'object') : [];
  const loaded = validCount(library?.stats?.loaded) ? library.stats.loaded : words.length;
  const used = validCount(library?.stats?.used) ? library.stats.used : words.filter(word => word.used === true).length;
  const unused = validCount(library?.stats?.unused) ? library.stats.unused : Math.max(0, loaded - used);
  const rawCoverage = library?.stats?.coverage;
  const coverage = Number.isFinite(rawCoverage) && rawCoverage >= 0 && rawCoverage <= 100 ? rawCoverage : loaded ? Math.round(used / loaded * 10000) / 100 : 0;
  const trackCount = track => new Set(words.filter(word => typeof word.id === 'string' && Array.isArray(word.tracks) && word.tracks.includes(track)).map(word => word.id)).size;
  return {loaded, used, unused, coverage, target:validCount(library?.stats?.target) ? library.stats.target : null, cet4:trackCount('cet4'), cet6:trackCount('cet6')};
}

function localStats(books, progress) {
  const wordIds = new Set(safeBooks(books).flatMap(book => Array.isArray(book.words) ? book.words.map(word => word?.id).filter(id => typeof id === 'string') : []));
  const bookmarks = new Set(Array.isArray(progress?.bookmarks) ? progress.bookmarks : []);
  return {
    bookmarked:[...bookmarks].filter(id => wordIds.has(id)).length,
    known:[...wordIds].filter(id => progress?.familiarity?.[id] === 'known').length,
    wordCount:wordIds.size,
    finished:originalsFor(books).filter(book => readingFor(book, progress).status === 'finished').length
  };
}

function cardMarkup(book, progress, renderBookCard) {
  const reading = readingFor(book, progress);
  const percent = Math.floor(reading.ratio * 100);
  const card = typeof renderBookCard === 'function' ? renderBookCard(book) : `<article class="cet-basic-card"><h3><a href="${routeFor('reader', book.id)}">${esc(book.title || '未命名故事')}</a></h3><p>${esc(book.description)}</p></article>`;
  return `<div class="cet-book">${card}<div class="cet-book-progress"><span><i class="cet-status-dot cet-status-${reading.status}" aria-hidden="true"></i>${reading.label}${reading.status === 'started' && reading.ratio > 0 ? ` · 阅读位置 ${percent}%` : ''}</span><a href="${routeFor('review', book.id)}" aria-label="复习本篇：${esc(book.title || '未命名故事')}">复习本篇 <span aria-hidden="true">→</span></a></div></div>`;
}

function resultsMarkup(books, state, progress, renderBookCard) {
  const matching = matchingBooks(books, state, progress);
  if (matching.length) return matching.slice(0, state.page * PAGE_SIZE).map(book => cardMarkup(book, progress, renderBookCard)).join('');
  if (!books.length) return '<div class="cet-empty"><h3>原创故事正在整理</h3><p>先从已导入的词表开始，故事准备好后会出现在这里。</p><a class="btn" href="#vocabulary">浏览四六级词表</a></div>';
  return '<div class="cet-empty"><h3>没有找到匹配的故事</h3><p>换个关键词，或清空题材和阅读状态筛选。</p><button class="btn" type="button" data-cet-action="reset">清空全部筛选</button></div>';
}

const summary = (books, state, progress) => {
  const count = matchingBooks(books, state, progress).length;
  return `已显示 ${Math.min(count, state.page * PAGE_SIZE)} / ${count} 篇原创`;
};

export function cetShelfPage(library, books = [], progress = {}, renderBookCard) {
  const originals = originalsFor(books);
  const excerpts = safeBooks(books).filter(book => book.kind === 'excerpt');
  const genres = [...new Set(originals.map(book => book.genre).filter(value => typeof value === 'string' && value.trim()))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const state = {query:'', genre:'all', reading:'all', page:1};
  const stats = contentStats(library), personal = localStats(books, progress);
  const last = originals.find(book => book.id === progress?.lastStory);
  const continuing = last && readingFor(last, progress).status !== 'unread';
  const next = continuing ? last : originals[0];
  const focusCounts = originals.map(book => book.focusCount).filter(validCount);
  const focusRange = focusCounts.length ? `${Math.min(...focusCounts)}${Math.min(...focusCounts) === Math.max(...focusCounts) ? '' : `–${Math.max(...focusCounts)}`} 个重点词` : '在故事语境里认识单词';
  const sourceCount = Array.isArray(library?.catalogs) ? library.catalogs.filter(book => book?.course === '四六级').length : 0;
  return `<section class="cet-shelf" data-cet-shelf>
    <div class="cet-top"><a class="back-link" href="#library-catalog">← 返回全站</a><span>ToTo趣味英语 · 四六级专区</span><a href="#vocabulary">四六级总词表 <span aria-hidden="true">↗</span></a></div>
    <header class="cet-heading"><p class="section-eyebrow">CET-4 / CET-6 · READ & REMEMBER</p><h1>我的四六级小说</h1><p>读完一个故事，让单词留在记忆里。</p></header>
    <section class="cet-hero" aria-labelledby="cet-hero-title"><div class="cet-hero-copy"><p class="cet-hero-kicker">原创背词短篇 · ${originals.length} 篇可读</p><h2 id="cet-hero-title">下一页的故事，<br>从这里继续。</h2><p>中文剧情里，遇见带释义的英文。阅读、填空、语境复习，按自己的节奏记住它们。</p><div class="cet-continue"><span>${continuing ? '上次读到' : '从一篇故事开始'}</span><strong>${next ? esc(next.title || '未命名故事') : '原创故事正在准备中'}</strong>${next ? `<a class="btn cet-primary" href="${routeFor('reader', next.id)}">${continuing ? '继续阅读' : '开始阅读'} <span aria-hidden="true">→</span></a>` : '<a class="btn cet-primary" href="#vocabulary">先浏览词表 <span aria-hidden="true">→</span></a>'}</div><small>每篇 ${focusRange} · 支持隐藏释义与英文填空</small></div><div class="cet-hero-art"><img src="./assets/course-cet.png" alt="四六级英语小说专区插画" width="1086" height="1448" data-cet-art></div></section>
    <section class="cet-coverage" aria-labelledby="cet-coverage-title"><div class="cet-section-heading"><h2 id="cet-coverage-title">故事里的词汇覆盖</h2><a href="#vocabulary">查看完整词表 <span aria-hidden="true">→</span></a></div><div class="cet-stats"><div><strong>${number(stats.loaded)}</strong><span>已导入词库</span></div><div><strong>${number(stats.used)}</strong><span>正文已使用</span></div><div><strong>${number(stats.unused)}</strong><span>正文未使用</span></div><div><strong>${stats.coverage}<small>%</small></strong><span>已导入词库覆盖率</span></div></div><p class="cet-stat-note">覆盖统计表示单词已在核验后的原创正文中使用，不代表你已掌握。${stats.target === null ? '覆盖率按已导入词库计算。' : `${number(stats.target)} 词是学习目标，当前实际入库 ${number(stats.loaded)} 词；覆盖率按已导入词库计算。`}</p></section>
    <div class="cet-learning-grid" aria-label="词表学习入口"><a href="#vocabulary/cet4/all"><span>CET-4 · 已导入词表</span><h3>四级词汇</h3><p>${number(stats.cet4)} 词</p><b>查看四级词表 →</b></a><a href="#vocabulary/cet6/all"><span>CET-6 · 已导入词表</span><h3>六级词汇</h3><p>${number(stats.cet6)} 词</p><b>查看六级词表 →</b></a><a href="#vocabulary/all/unused"><span>待覆盖 · 创作词库</span><h3>未使用词汇</h3><p>${number(stats.unused)} 词</p><b>查看未使用词汇 →</b></a></div><p class="cet-track-note">四级与六级按来源词表归类，共享词会分别出现，总词库按单词去重。小说按题材选择。</p>
    <section class="cet-personal" aria-labelledby="cet-personal-title"><div><p class="section-eyebrow">留给自己的学习记录</p><h2 id="cet-personal-title">今天，回想起了多少？</h2><p>本站 ${number(personal.wordCount)} 张词卡范围 · 记录保存在当前浏览器</p></div><dl><div><dt>我的生词</dt><dd>${personal.bookmarked}</dd></div><div><dt>自评掌握</dt><dd>${personal.known}</dd></div><div><dt>原创读到末尾</dt><dd>${personal.finished}<small> / ${originals.length}</small></dd></div></dl><div class="cet-personal-actions"><a class="btn primary" href="#review/notebook">复习我的生词 →</a><a class="text-btn" href="#notebook">打开生词本</a></div></section>
    <section class="cet-originals" aria-labelledby="cet-originals-title"><div class="cet-section-heading"><h2 id="cet-originals-title" tabindex="-1" data-cet-originals-title>选择一篇，慢慢读 <small>${originals.length} 篇原创</small></h2><span>每一篇都是完整故事</span></div><div class="cet-tools"><div class="search-box cet-search"><label class="cet-visually-hidden" for="cet-search">搜索原创故事标题、简介或题材</label><input id="cet-search" type="search" placeholder="搜索故事、简介或题材" autocomplete="off" data-cet-search><button class="clear-search" type="button" data-cet-action="clear-search" aria-label="清空原创故事搜索" hidden>×</button></div><label class="filter-label" for="cet-genre">题材<select id="cet-genre" data-cet-genre><option value="all">全部题材</option>${genres.map(genre => `<option value="${esc(genre)}">${esc(genre)}</option>`).join('')}</select></label><label class="filter-label" for="cet-reading">阅读状态<select id="cet-reading" data-cet-reading><option value="all">全部状态</option><option value="unread">未开始</option><option value="started">阅读中</option><option value="finished">读到末尾</option></select></label></div><p class="cet-result-count" data-cet-count role="status" aria-live="polite" aria-atomic="true">${summary(originals, state, progress)}</p><div class="books-grid cet-books-grid" data-cet-results>${resultsMarkup(originals, state, progress, renderBookCard)}</div><div class="cet-pagination"><p data-cet-page-count>${summary(originals, state, progress)}</p><button class="btn" type="button" data-cet-action="load-more" ${originals.length <= PAGE_SIZE ? 'hidden' : ''}>再看 12 篇故事</button></div></section>
    ${excerpts.length ? `<section class="cet-excerpts" aria-labelledby="cet-excerpts-title"><div><h2 id="cet-excerpts-title">截图节选</h2><p>保留已确认的片段，单独阅读；不计入原创篇数与正文覆盖台账。</p></div><ul>${excerpts.map(book => `<li><a href="${routeFor('reader', book.id)}"><span>${esc(book.title || '未命名节选')}</span><small>阅读截图节选 →</small></a></li>`).join('')}</ul></section>` : ''}
    <div class="cet-reference"><div><h2>还想看看更多题材？</h2><p>${number(sourceCount)} 条四六级来源目录可供浏览，目录不计入可读原创。</p></div><a class="btn" href="#catalog/cet">浏览来源目录 →</a></div>
  </section>`;
}

export function mountCetShelf(root, library, books = [], progress = {}, renderBookCard) {
  const container = root.querySelector('[data-cet-shelf]');
  if (!container) return () => {};
  mounts.get(container)?.();
  const originals = originalsFor(books);
  const state = {query:'', genre:'all', reading:'all', page:1};
  const search = container.querySelector('[data-cet-search]');
  const genre = container.querySelector('[data-cet-genre]');
  const reading = container.querySelector('[data-cet-reading]');
  const results = container.querySelector('[data-cet-results]');
  const more = container.querySelector('[data-cet-action="load-more"]');
  const clear = container.querySelector('[data-cet-action="clear-search"]');
  const pageCount = container.querySelector('[data-cet-page-count]');
  let composing = false;
  function update() {
    results.innerHTML = resultsMarkup(originals, state, progress, renderBookCard);
    const message = summary(originals, state, progress);
    container.querySelector('[data-cet-count]').textContent = message;
    pageCount.textContent = message;
    clear.hidden = !search.value;
    more.hidden = state.page * PAGE_SIZE >= matchingBooks(originals, state, progress).length;
  }
  function runSearch() { state.query = search.value; state.page = 1; update(); }
  function onInput(event) { if (event.target !== search) return; event.stopPropagation(); clear.hidden = !search.value; if (!composing && !event.isComposing) runSearch(); }
  function onCompositionStart(event) { if (event.target !== search) return; event.stopPropagation(); composing = true; }
  function onCompositionEnd(event) { if (event.target !== search) return; event.stopPropagation(); composing = false; runSearch(); }
  function onSearch(event) { if (event.target !== search) return; event.stopPropagation(); if (!composing) runSearch(); }
  function onChange(event) {
    if (event.target !== genre && event.target !== reading) return;
    event.stopPropagation(); state.genre = genre.value; state.reading = reading.value; state.page = 1; update();
  }
  function onClick(event) {
    const button = event.target?.closest?.('[data-cet-action]');
    if (!button || !container.contains(button)) return;
    event.stopPropagation();
    const action = button.dataset.cetAction;
    if (action === 'load-more') state.page += 1;
    else if (action === 'clear-search' || action === 'reset') {
      search.value = ''; state.query = ''; state.page = 1; composing = false;
      if (action === 'reset') { genre.value = 'all'; reading.value = 'all'; state.genre = 'all'; state.reading = 'all'; }
      search.focus();
    } else return;
    update();
    if (button === more && more.hidden) { pageCount.setAttribute('tabindex', '-1'); pageCount.focus({preventScroll:true}); }
  }
  function onImageError(event) { if (event.target?.matches?.('[data-cet-art]')) event.target.hidden = true; }
  const listeners = {input:onInput, compositionstart:onCompositionStart, compositionend:onCompositionEnd, search:onSearch, change:onChange, click:onClick};
  for (const [type, handler] of Object.entries(listeners)) container.addEventListener(type, handler);
  container.addEventListener('error', onImageError, true);
  const art = container.querySelector('[data-cet-art]');
  if (art?.complete && art.naturalWidth === 0) art.hidden = true;
  const cleanup = () => { for (const [type, handler] of Object.entries(listeners)) container.removeEventListener(type, handler); container.removeEventListener('error', onImageError, true); mounts.delete(container); };
  mounts.set(container, cleanup);
  return cleanup;
}
