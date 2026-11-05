const COURSES = ['全部', '四六级', '雅思', '高中', '考研'];
const PAGE_SIZE = 24;
const mounts = new WeakMap();
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
const text = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
const selectedCourse = course => COURSES.includes(course) ? course : '全部';
const entries = catalogs => Array.isArray(catalogs) ? catalogs.filter(item => item && typeof item === 'object') : [];

export function filterCatalog(catalogs, {course = '全部', query = '', genre = '全部'} = {}) {
  const needle = text(query);
  return entries(catalogs).filter(book =>
    (course === '全部' || book.course === course) &&
    (genre === '全部' || book.genre === genre) &&
    (!needle || text(`${book.title ?? ''} ${book.genre ?? ''}`).includes(needle))
  );
}

export function safeReferenceUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.origin === 'https://novel.quwanclass.com' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function genreOptions(catalogs, course) {
  return [...new Set(filterCatalog(catalogs, {course}).map(book => book.genre).filter(value => typeof value === 'string' && value.trim()))]
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
}

function genreMarkup(catalogs, course) {
  return '<option value="全部">全部题材</option>' + genreOptions(catalogs, course)
    .map(genre => `<option value="${esc(genre)}">${esc(genre)}</option>`).join('');
}

function catalogCard(book) {
  const url = safeReferenceUrl(book.sourceUrl);
  const count = book.originalWordCount ?? book.wordCount;
  const words = Number.isInteger(count) && count >= 0 ? `原站标注 ${count} 词` : '词数未提供';
  const chapters = Number.isInteger(book.chapterCount) && book.chapterCount > 0 ? `${book.chapterCount} 章 · ` : '';
  const status = book.sourceKind === 'public-title-index' ? '公开标题索引' : '仅目录参考';
  const number = Number.isInteger(book.no) && book.no > 0 ? `<span class="ref-number">No.${String(book.no).padStart(2, '0')}</span>` : '';
  return `<article class="ref-card">
    <div class="ref-card-top"><span class="ref-course-label">${esc(book.course)}${book.genre ? ` · ${esc(book.genre)}` : ''}</span>${number}</div>
    <h2 class="ref-card-title">${esc(book.title || '未命名目录条目')}</h2>
    <p class="ref-card-meta">${chapters}${words}</p>
    <div class="ref-card-bottom"><span class="ref-status">${status}</span>${url ? `<a class="text-btn ref-source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="到原站查看：${esc(book.title)}">到原站查看 <span aria-hidden="true">↗</span></a>` : '<span class="ref-link-unavailable">来源链接暂不可用</span>'}</div>
  </article>`;
}

function resultMarkup(catalogs, state) {
  const matching = filterCatalog(catalogs, state);
  if (matching.length) return matching.slice(0, state.page * PAGE_SIZE).map(catalogCard).join('');
  const available = filterCatalog(catalogs, {course: state.course}).length;
  if (!available) return `<div class="ref-empty"><p class="ref-empty-kicker">${esc(state.course === '全部' ? '公开目录' : state.course)}</p><h2>这个专区的目录还未整理</h2><p>目前没有可展示的来源目录条目。你可以返回课程总览，选择其他专区。</p><a class="btn" href="#library-catalog">返回课程总览 <span aria-hidden="true">→</span></a></div>`;
  return '<div class="ref-empty"><h2>没有找到匹配的目录</h2><p>试试更短的标题，或清空搜索和题材筛选。</p><button class="btn" type="button" data-ref-action="reset">清空筛选</button></div>';
}

function summary(catalogs, state) {
  const total = filterCatalog(catalogs, state).length;
  return `显示 ${Math.min(total, state.page * PAGE_SIZE)} / ${total} 条目录`;
}

export function referenceCatalogPage(catalogs, initialCourse = '全部') {
  const data = entries(catalogs);
  const state = {course: selectedCourse(initialCourse), query: '', genre: '全部', page: 1};
  const matching = filterCatalog(data, state).length;
  return `<section class="ref-catalog" data-reference-catalog>
    <div class="ref-breadcrumb"><a class="back-link" href="#library-catalog">← 课程总览</a><span>公开小说目录</span></div>
    <div class="section-heading ref-heading"><div><p class="section-eyebrow">按课程找故事</p><h1>来源小说目录</h1><p>已整理 <strong>${data.length}</strong> 条公开目录，可按标题、题材和课程查找。</p></div><a class="btn ref-export" href="./downloads/reference-catalog.json" download>导出目录数据 <span aria-hidden="true">↓</span></a></div>
    <div class="ref-notice"><strong>这里收录的是来源目录与标题索引，未导入原作全文。</strong><p>高中、雅思和考研已补充可取得的公开简介与原站标注词数，章节标题仅在来源提供时展示。每张卡片可打开来源课程页，缺失字段保留未提供；来源目录不计入你的原创词汇覆盖率。</p></div>
    <div class="segmented ref-courses" role="group" aria-label="筛选课程">${COURSES.map(course => `<button type="button" data-ref-course="${course}" aria-pressed="${state.course === course}"><span>${course}</span><span class="ref-course-count">${filterCatalog(data, {course}).length}</span></button>`).join('')}</div>
    <div class="ref-tools"><div class="search-box ref-search"><label class="ref-search-label" for="reference-search">搜索标题或题材</label><input id="reference-search" type="search" placeholder="搜索标题或题材" autocomplete="off"><button class="clear-search" type="button" data-ref-action="clear-search" aria-label="清空目录搜索" hidden>×</button></div><label class="filter-label ref-genre" for="reference-genre">题材<select id="reference-genre">${genreMarkup(data, state.course)}</select></label></div>
    <div class="ref-results-heading"><h2 id="reference-course-title">${esc(state.course === '全部' ? '全部课程' : state.course)}小说目录</h2><p id="reference-count" role="status" aria-live="polite" aria-atomic="true">${summary(data, state)}</p></div>
    <div class="ref-grid" id="reference-results">${resultMarkup(data, state)}</div>
    <div class="ref-pagination"><p id="reference-page-count">${summary(data, state)}</p><button class="btn" id="reference-load-more" type="button" data-ref-action="load-more" ${matching <= PAGE_SIZE ? 'hidden' : ''}>加载更多</button></div>
  </section>`;
}

export function mountReferenceCatalog(root, catalogs, initialCourse = '全部') {
  const container = root.querySelector('[data-reference-catalog]');
  if (!container) return () => {};
  mounts.get(container)?.();
  const data = entries(catalogs);
  const state = {course: selectedCourse(initialCourse), query: '', genre: '全部', page: 1};
  const search = container.querySelector('#reference-search');
  const genre = container.querySelector('#reference-genre');
  const results = container.querySelector('#reference-results');
  const more = container.querySelector('#reference-load-more');
  const clear = container.querySelector('[data-ref-action="clear-search"]');
  let composing = false;

  function update() {
    const total = filterCatalog(data, state).length;
    results.innerHTML = resultMarkup(data, state);
    container.querySelector('#reference-count').textContent = summary(data, state);
    container.querySelector('#reference-page-count').textContent = summary(data, state);
    container.querySelector('#reference-course-title').textContent = `${state.course === '全部' ? '全部课程' : state.course}小说目录`;
    clear.hidden = !search.value;
    more.hidden = state.page * PAGE_SIZE >= total;
    container.querySelectorAll('[data-ref-course]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.refCourse === state.course)));
  }
  function runSearch() {
    state.query = search.value;
    state.page = 1;
    update();
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
  function onChange(event) {
    if (event.target !== genre) return;
    event.stopPropagation();
    state.genre = genre.value;
    state.page = 1;
    update();
  }
  function onClick(event) {
    const button = event.target.closest('[data-ref-action], [data-ref-course]');
    if (!button || !container.contains(button)) return;
    event.stopPropagation();
    if (button.dataset.refCourse) {
      state.course = selectedCourse(button.dataset.refCourse);
      state.genre = '全部';
      state.page = 1;
      genre.innerHTML = genreMarkup(data, state.course);
      genre.value = '全部';
    } else if (button.dataset.refAction === 'load-more') {
      state.page += 1;
    } else if (button.dataset.refAction === 'clear-search' || button.dataset.refAction === 'reset') {
      state.query = '';
      state.genre = '全部';
      state.page = 1;
      search.value = '';
      genre.value = '全部';
      composing = false;
      search.focus();
    } else return;
    update();
    if (button === more && more.hidden) container.querySelector('#reference-page-count').setAttribute('tabindex', '-1');
    if (button === more && more.hidden) container.querySelector('#reference-page-count').focus({preventScroll: true});
  }
  const listeners = {input: onInput, compositionstart: onCompositionStart, compositionend: onCompositionEnd, change: onChange, click: onClick};
  for (const [type, handler] of Object.entries(listeners)) container.addEventListener(type, handler);
  const cleanup = () => {
    for (const [type, handler] of Object.entries(listeners)) container.removeEventListener(type, handler);
    mounts.delete(container);
  };
  mounts.set(container, cleanup);
  return cleanup;
}
