import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAnswer, gradeAnswer, freshProgress, validateProgress,
  loadProgress, saveProgress, summarize, exportWordsCsv,
} from '../client/engine.mjs';

const words = [
  { id: 'proposal', en: 'proposal', zh: '方案' },
  { id: 'signature', en: 'signature', zh: '署名' },
  { id: 'organize', en: 'organize', zh: '组织', accepted: ['organise'] },
];
const ids = words.map(word => word.id);
const emptyProject = {
  version: 1, bookmarks: [], familiarity: {}, answers: {},
  fontSize: 22, mode: 'study', readRatio: 0, scrollY: 0,
};
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
}

test('answers normalize full-width text, case and internal whitespace', () => {
  assert.equal(normalizeAnswer('  ＴＡＫＥ\t  ＯＦＦ\n'), 'take off');
  assert.equal(normalizeAnswer(null), '');
});

test('grading accepts explicit variants but does not accept spelling mistakes or substrings', () => {
  assert.equal(gradeAnswer(' ＯＲＧＡＮＩＳＥ ', words[2]), 'correct');
  assert.equal(gradeAnswer('organize', words[2]), 'correct');
  assert.equal(gradeAnswer('organ', words[2]), 'incorrect');
  assert.equal(gradeAnswer('proposals', words[0]), 'incorrect');
  assert.equal(gradeAnswer(' \t ', words[0]), 'empty');
});

test('fresh projects never share mutable collections', () => {
  const first = freshProgress();
  first.bookmarks.push('proposal');
  first.answers.proposal = 'x';
  assert.deepEqual(freshProgress(), {
    version: 1, bookmarks: [], familiarity: {}, answers: {},
    fontSize: 22, mode: 'study', readRatio: 0, scrollY: 0,
  });
});

test('validation strips unknown fields and stale IDs without mutating the input', () => {
  const input = {
    version: 1, bookmarks: ['signature', 'missing', 'signature', 22],
    familiarity: { proposal: 'known', signature: 'bad', missing: 'known' },
    answers: { proposal: ' PROPOSAL ', signature: 12, missing: 'x' },
    fontSize: 24, mode: 'cloze', readRatio: 0.5, scrollY: 180, secret: 'remove',
  };
  assert.deepEqual(validateProgress(input, ids), {
    version: 1, bookmarks: ['signature'], familiarity: { proposal: 'known' },
    answers: { proposal: ' PROPOSAL ' }, fontSize: 24, mode: 'cloze', readRatio: 0.5, scrollY: 180,
  });
  assert.equal(input.secret, 'remove');
  assert.equal(input.bookmarks.length, 4);
});

test('validation bounds display and position settings and rejects invalid enum values', () => {
  const data = validateProgress({ fontSize: 90, readRatio: -3, scrollY: -5, mode: 'invalid' }, ids);
  assert.equal(data.fontSize, 30);
  assert.equal(data.readRatio, 0);
  assert.equal(data.scrollY, 0);
  assert.equal(data.mode, 'study');
  assert.equal(validateProgress({ fontSize: 2, readRatio: 2 }, ids).fontSize, 18);
  assert.equal(validateProgress({ readRatio: 2 }, ids).readRatio, 1);
  assert.equal(validateProgress({ fontSize: '24', readRatio: Infinity, scrollY: NaN }, ids).fontSize, 22);
});

test('unsupported versions and malformed roots reset safely', () => {
  for (const input of [null, [], 'invalid', { version: 2, bookmarks: ['proposal'] }]) {
    assert.deepEqual(validateProgress(input, ids), emptyProject);
  }
});

test('validation does not inherit injected familiarity or permit prototype keys', () => {
  const familiarity = Object.create({ proposal: 'known' });
  familiarity.signature = 'fuzzy';
  const data = validateProgress({ familiarity, answers: JSON.parse('{"__proto__":"polluted"}') }, [...ids, '__proto__']);
  assert.deepEqual(data.familiarity, { signature: 'fuzzy' });
  assert.deepEqual(data.answers, {});
  assert.equal({}.polluted, undefined);
});

test('missing stored progress is a new project without a warning', () => {
  assert.deepEqual(loadProgress(memoryStorage(), 'story', ids), { data: emptyProject, error: null });
});

test('stored progress is sanitized on load', () => {
  const storage = memoryStorage({ story: JSON.stringify({ version: 1, bookmarks: ['proposal', 'unknown'], mode: 'hide' }) });
  const result = loadProgress(storage, 'story', ids);
  assert.equal(result.error, null);
  assert.deepEqual(result.data.bookmarks, ['proposal']);
  assert.equal(result.data.mode, 'hide');
});

test('broken JSON and incompatible stored records return a warning and fresh state', () => {
  for (const value of ['{ broken', 'null', '[]', '{"version":9}']) {
    const result = loadProgress(memoryStorage({ story: value }), 'story', ids);
    assert.deepEqual(result.data, emptyProject);
    assert.equal(typeof result.error, 'string');
    assert.ok(result.error.length > 0);
  }
});

test('storage read failures do not break the reader', () => {
  const result = loadProgress({ getItem() { throw new Error('blocked'); } }, 'story', ids);
  assert.deepEqual(result.data, emptyProject);
  assert.equal(typeof result.error, 'string');
});

test('saving restores answers, bookmarks and reading position in the next session', () => {
  const storage = memoryStorage();
  const progress = { ...freshProgress(), answers: { proposal: 'proposal' }, bookmarks: ['signature'], scrollY: 640 };
  assert.deepEqual(saveProgress(storage, 'story', progress), { ok: true, error: null });
  assert.deepEqual(loadProgress(storage, 'story', ids).data, progress);
});

test('quota failures return a visible failure instead of pretending to save', () => {
  const result = saveProgress({ setItem() { throw new Error('QuotaExceededError'); } }, 'story', freshProgress());
  assert.equal(result.ok, false);
  assert.equal(typeof result.error, 'string');
});

test('summary distinguishes attempted answers, correct answers and self-rated knowledge', () => {
  const result = summarize([...words, words[0]], {
    ...freshProgress(), bookmarks: ['proposal', 'proposal', 'missing'],
    familiarity: { signature: 'known', proposal: 'fuzzy', missing: 'known' },
    answers: { proposal: 'proposal', signature: 'wrong', organize: '  ', missing: 'right' },
  });
  assert.deepEqual(result, { total: 3, bookmarked: 1, known: 1, filled: 2, correct: 1 });
});

test('summary handles 150 words without using screenshot totals or a 100-word limit', () => {
  const many = Array.from({ length: 150 }, (_, i) => ({ id: `w${i}`, en: `word${i}`, zh: `词${i}` }));
  const progress = freshProgress();
  for (let i = 0; i < 120; i++) progress.answers[`w${i}`] = i < 80 ? `word${i}` : 'wrong';
  for (let i = 0; i < 32; i++) progress.familiarity[`w${i}`] = 'known';
  progress.bookmarks = ['w1', 'w21', 'w121', 'not-in-story'];
  assert.deepEqual(summarize(many, progress), { total: 150, bookmarked: 3, known: 32, filled: 120, correct: 80 });
});

test('CSV exports actual vocabulary and study state with Excel-compatible encoding', () => {
  const csv = exportWordsCsv(words.slice(0, 2), { ...freshProgress(), familiarity: { proposal: 'known' }, bookmarks: ['signature'] });
  assert.equal(csv, '\uFEFF"英文","中文语境义","熟悉度","收藏"\r\n"proposal","方案","已掌握","否"\r\n"signature","署名","陌生","是"\r\n');
});

test('CSV quotes text safely and prevents leading formulas after whitespace', () => {
  const entries = [
    { id: 'a', en: '=SUM(1,2)', zh: '两行\n释义"引号"' },
    { id: 'b', en: '  +danger', zh: '@danger' },
    { id: 'c', en: '\t-danger', zh: 'normal' },
  ];
  const csv = exportWordsCsv(entries, freshProgress());
  assert.ok(csv.includes('"\'=SUM(1,2)"'));
  assert.ok(csv.includes('"两行\n释义""引号"""'));
  assert.ok(csv.includes('"\'  +danger"'));
  assert.ok(csv.includes('"\'@danger"'));
  assert.ok(csv.includes('"\'\t-danger"'));
});
