const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
const normalize = value => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN');

export function vocabularyEntries(vocabulary) {
  return Array.isArray(vocabulary?.entries) ? vocabulary.entries.filter(entry => entry && typeof entry.word === 'string' && entry.word.trim()) : [];
}

export function vocabularyMatches(vocabulary, query = '') {
  const needle = normalize(query);
  return vocabularyEntries(vocabulary).filter(entry => !needle || normalize(`${entry.word} ${entry.meaning}`).includes(needle));
}

export function vocabularySummary(vocabulary, query = '') {
  const total = vocabularyEntries(vocabulary).length;
  return normalize(query) ? `找到 ${vocabularyMatches(vocabulary, query).length} / ${total} 个词` : `已收录 ${total} 个词 · 按原词表顺序排列`;
}

export function vocabularyResults(vocabulary, query = '') {
  const entries = vocabularyMatches(vocabulary, query);
  if (!vocabularyEntries(vocabulary).length) return '<div class="ielts-empty"><h2>词表尚未导入</h2><p>已有的小说目录仍可浏览，词表导入后会出现在这里。</p><a class="btn" href="#ielts">返回雅思书架</a></div>';
  if (!entries.length) return '<div class="ielts-empty"><h2>已收录词表中没有找到</h2><p>试试英文词的一部分，或中文释义中的关键词。</p><button class="btn" type="button" data-ielts-action="clear-search">清空搜索</button></div>';
  return `<ol class="ielts-word-list">${entries.map(entry => `<li class="ielts-word-entry"><div class="ielts-word-head"><span class="ielts-word-ordinal">${Number.isInteger(entry.ordinal) && entry.ordinal > 0 ? String(entry.ordinal).padStart(2, '0') : '—'}</span><h2 lang="en">${esc(entry.word)}</h2><span class="ielts-word-pos">${esc(entry.pos || '词性未提供')}</span></div><dl class="ielts-word-pronunciation"><div><dt>英</dt><dd lang="en-GB">${esc(entry.ipa_uk || '音标未提供')}</dd></div><div><dt>美</dt><dd lang="en-US">${esc(entry.ipa_us || '音标未提供')}</dd></div></dl><p class="ielts-word-meaning">${esc(entry.meaning || '释义未提供')}</p></li>`).join('')}</ol>`;
}

export function vocabularyBanner(vocabulary) {
  const count = vocabularyEntries(vocabulary).length;
  return `<a class="ielts-vocabulary-banner" href="#ielts/vocabulary"><span class="ielts-vocabulary-badge">IELTS</span><span><strong>我的雅思词表</strong><small>已收录 ${count} 词 · 中英搜索 · 英美音标 · 词表下载</small></span><span aria-hidden="true">→</span></a>`;
}

export function vocabularyContent(vocabulary) {
  const count = vocabularyEntries(vocabulary).length;
  const declared = vocabulary?.site_declared_total;
  const remaining = Number.isInteger(declared) && declared > count ? declared - count : 0;
  return `<header class="ielts-heading"><p class="ielts-eyebrow">IELTS · WORD COLLECTION</p><h1>我的雅思词表</h1><p>一个词，一点积累。查找英文，也可以从中文释义找起。</p></header><div class="ielts-vocabulary-overview"><div><strong>${count}</strong><span>实际收录词数</span></div><p>${remaining ? `原资料标注共 ${declared.toLocaleString('zh-CN')} 词，目前导入其中 ${count} 词，另有 ${remaining.toLocaleString('zh-CN')} 词尚未提供。` : '显示已导入的词条，数量按实际内容计算。'}<br>音标与释义保留用户所提供 PDF 的内容；这批词不计入四六级原创小说覆盖率。</p><div class="ielts-vocabulary-downloads">${count ? '<a class="btn ielts-primary" href="./downloads/ielts-vocabulary.csv" download>下载 CSV <span aria-hidden="true">↓</span></a><a class="text-btn" href="./downloads/ielts-vocabulary.json" download>下载 JSON ↓</a>' : ''}</div></div><div class="ielts-tools"><h2>已导入词条</h2><div class="search-box ielts-search"><label class="ielts-visually-hidden" for="ielts-search">搜索英文或中文释义</label><input id="ielts-search" type="search" placeholder="搜索英文或中文释义" autocomplete="off" data-ielts-search><button class="clear-search" type="button" data-ielts-action="clear-search" aria-label="清空词表搜索" hidden>×</button></div></div><p class="ielts-result-count" data-ielts-count role="status" aria-live="polite" aria-atomic="true">${vocabularySummary(vocabulary)}</p><div data-ielts-results>${vocabularyResults(vocabulary)}</div>`;
}
