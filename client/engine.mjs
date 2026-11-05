const MODES = new Set(['study', 'hide', 'cloze']);
const FAMILIARITY = new Set(['new', 'fuzzy', 'known']);
const LABELS = { new: '陌生', fuzzy: '模糊', known: '已掌握' };
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const bounded = (value, min, max, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function normalizeAnswer(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ') : '';
}

export function gradeAnswer(answer, word) {
  const normalized = normalizeAnswer(answer);
  if (!normalized) return 'empty';
  const variants = [word?.en, ...(Array.isArray(word?.accepted) ? word.accepted : [])];
  return variants.some(value => normalizeAnswer(value) === normalized) ? 'correct' : 'incorrect';
}

export function freshProgress() {
  return {
    version: 1, bookmarks: [], familiarity: {}, answers: {},
    fontSize: 22, mode: 'study', readRatio: 0, scrollY: 0,
  };
}

/** Rebuild the public schema so old or foreign data cannot leak into the reader. */
export function validateProgress(input, wordIds = []) {
  const data = freshProgress();
  if (!isRecord(input) || (own(input, 'version') && input.version !== 1)) return data;
  const ids = new Set(
    [...(Array.isArray(wordIds) || wordIds instanceof Set ? wordIds : [])]
      .filter(id => typeof id === 'string' && id.length > 0 && id !== '__proto__'),
  );
  if (Array.isArray(input.bookmarks)) {
    data.bookmarks = [...new Set(input.bookmarks.filter(id => ids.has(id)))];
  }
  if (isRecord(input.familiarity)) {
    for (const [id, level] of Object.entries(input.familiarity)) {
      if (ids.has(id) && FAMILIARITY.has(level)) data.familiarity[id] = level;
    }
  }
  if (isRecord(input.answers)) {
    for (const [id, answer] of Object.entries(input.answers)) {
      if (ids.has(id) && typeof answer === 'string') data.answers[id] = answer;
    }
  }
  data.fontSize = bounded(input.fontSize, 18, 30, 22);
  data.mode = MODES.has(input.mode) ? input.mode : 'study';
  data.readRatio = bounded(input.readRatio, 0, 1, 0);
  data.scrollY = bounded(input.scrollY, 0, Number.MAX_SAFE_INTEGER, 0);
  return data;
}

export function loadProgress(storage, key, wordIds) {
  try {
    const raw = storage.getItem(key);
    if (raw === null || raw === undefined) return { data: freshProgress(), error: null };
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) throw new Error('unsupported progress');
    return { data: validateProgress(parsed, wordIds), error: null };
  } catch {
    return { data: freshProgress(), error: '无法读取已保存的进度，本次先从初始状态开始。' };
  }
}

export function saveProgress(storage, key, data) {
  try {
    const ids = [
      ...(Array.isArray(data?.bookmarks) ? data.bookmarks : []),
      ...Object.keys(isRecord(data?.familiarity) ? data.familiarity : {}),
      ...Object.keys(isRecord(data?.answers) ? data.answers : {}),
    ];
    storage.setItem(key, JSON.stringify(validateProgress(data, ids)));
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: '进度暂未保存，请检查浏览器是否允许本地存储。' };
  }
}

function uniqueWords(words) {
  const seen = new Set();
  return (Array.isArray(words) ? words : []).filter(word => {
    if (!isRecord(word) || typeof word.id !== 'string' || !word.id || seen.has(word.id)) return false;
    seen.add(word.id);
    return true;
  });
}

export function summarize(words, progress) {
  const entries = uniqueWords(words);
  const data = validateProgress(progress, entries.map(word => word.id));
  const result = { total: entries.length, bookmarked: data.bookmarks.length, known: 0, filled: 0, correct: 0 };
  for (const word of entries) {
    if (data.familiarity[word.id] === 'known') result.known += 1;
    const grade = gradeAnswer(data.answers[word.id], word);
    if (grade !== 'empty') result.filled += 1;
    if (grade === 'correct') result.correct += 1;
  }
  return result;
}

function csvCell(value) {
  let text = String(value ?? '');
  // CSV quoting alone does not prevent spreadsheet formula evaluation.
  if (/^\s*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportWordsCsv(words, progress) {
  const entries = uniqueWords(words);
  const data = validateProgress(progress, entries.map(word => word.id));
  const bookmarks = new Set(data.bookmarks);
  const rows = [['英文', '中文语境义', '熟悉度', '收藏']];
  for (const word of entries) {
    rows.push([word.en, word.zh, LABELS[data.familiarity[word.id] ?? 'new'], bookmarks.has(word.id) ? '是' : '否']);
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
