"""Export recorded originals, rejecting drafts that differ from their ledger snapshots."""
import csv
import json
import re
import shutil
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT.parent / '小说背词项目'
OUT = ROOT / 'client'
TOKEN = re.compile(r'\[\[([^|]+)\|([^|]+)\|([^|]+)\|([^\]]+)\]\]')
MARKER = re.compile(r'<!--\s*vocab-body:(start(?:\s+mode=mixed)?|end)\s*-->')


def normalized_whitespace(text):
    return re.sub(r'\s+', ' ', text).strip()


def clean_annotations(text):
    # Match vocab_tracker.verify_final_body: remove presentation, never translate prose.
    text = text.replace('**', '').replace('__', '')
    return re.sub(r'（[^（）]*[\u3400-\u9fff][^（）]*）|\([^()]*[\u3400-\u9fff][^()]*\)', '', text)


def narrative_blocks(markdown):
    markers = list(MARKER.finditer(markdown))
    if not markers or len(markers) != len(re.findall(r'<!--\s*vocab-body:', markdown)):
        raise ValueError('Missing or malformed narrative markers')
    blocks, opened = [], None
    for marker in markers:
        if marker.group(1).startswith('start'):
            if opened is not None:
                raise ValueError('Nested narrative markers')
            opened = marker
        else:
            if opened is None:
                raise ValueError('Unmatched narrative end marker')
            blocks.append(('mode=mixed' in opened.group(1), markdown[opened.end():marker.start()].strip()))
            opened = None
    if opened is not None:
        raise ValueError('Unclosed narrative marker')
    return blocks


def verify_source(article_id, article, source, entries):
    """Bind displayed text, glosses and counts to the same completed article."""
    def require(condition, message):
        if not condition:
            raise ValueError(f'{article_id}: {message}')

    blocks = narrative_blocks(article['article_markdown'])
    require(source['title'] == article['title'], 'draft title differs from recorded title')
    require(len(source['paragraphs']) == len(blocks), 'draft paragraph count differs from recorded snapshot')
    uses = article['usage']['uses']
    actual = {row['id'] for row in uses}
    require(actual <= entries.keys(), 'recorded coverage includes words outside the frozen lexicon')
    verified_tokens = {(row['id'], row['surface'].casefold(), row['meaning_zh']) for row in uses}
    extracted = []
    for index, (paragraph, (mixed, recorded)) in enumerate(zip(source['paragraphs'], blocks), 1):
        for surface, word_id, zh, _ in TOKEN.findall(paragraph['text']):
            require((word_id, surface.casefold(), zh) in verified_tokens,
                    f'paragraph {index}: unrecorded token or gloss {word_id!r}')
        canonical = TOKEN.sub(lambda match: f'**{match[1]}**（{match[3]}）', paragraph['text'])
        require('[[' not in canonical and ']]' not in canonical,
                f'paragraph {index}: malformed source token')
        if mixed:
            # Chinese text contributes the story even though only its English is counted.
            require(canonical.strip() == recorded,
                    f'paragraph {index}: Chinese narrative differs from recorded snapshot')
        else:
            # The first English story re-annotates repeated words in the web reader.
            require(normalized_whitespace(clean_annotations(canonical)) ==
                    normalized_whitespace(clean_annotations(recorded)),
                    f'paragraph {index}: English narrative differs from recorded snapshot')
        content = clean_annotations(recorded)
        if mixed:
            fragments = re.findall(r"[A-Za-z0-9\s.,!?;:'\"‘’“”()\[\]\-–—/]+", content)
            content = ' '.join(part.strip() for part in fragments if re.search(r'[A-Za-z]', part))
        extracted.append(content)
    require(normalized_whitespace(' '.join(extracted)) == normalized_whitespace(article['body']),
            'recorded body differs from recorded narrative blocks')
    return actual


def validate_ielts_vocabulary(source):
    """Reject incomplete rows and private extraction metadata before web export."""
    fields = {'schema_version', 'source_type', 'source_label', 'source_url',
              'source_sha256', 'site_declared_total', 'is_complete', 'entries'}
    row_fields = {'ordinal', 'word', 'ipa_uk', 'ipa_us', 'meaning', 'pos', 'pages'}
    def require(condition, message):
        if not condition:
            raise ValueError(f'IELTS vocabulary: {message}')
    require(isinstance(source, dict) and set(source) == fields, 'unexpected or missing source fields')
    require(source['schema_version'] == 1 and source['source_type'] == 'user_supplied_pdf', 'unsupported source format')
    require(source['source_label'] == '用户提供的雅思词表 PDF', 'invalid source label')
    require(source['source_url'] == 'https://novel.quwanclass.com/ielts/?account=unified', 'invalid source URL')
    require(isinstance(source['source_sha256'], str) and re.fullmatch(r'[a-f0-9]{64}', source['source_sha256']), 'invalid source hash')
    require(type(source['site_declared_total']) is int and source['site_declared_total'] > 0, 'invalid declared total')
    require(type(source['is_complete']) is bool, 'invalid completeness flag')
    rows = source['entries']
    require(isinstance(rows, list) and bool(rows), 'empty vocabulary')
    require(len(rows) <= source['site_declared_total'], 'entry count exceeds declared total')
    require(not source['is_complete'] or len(rows) == source['site_declared_total'], 'incomplete data labelled complete')
    seen = set()
    for ordinal, row in enumerate(rows, 1):
        require(isinstance(row, dict) and set(row) == row_fields, f'row {ordinal}: unexpected or missing entry fields')
        require(type(row['ordinal']) is int and row['ordinal'] == ordinal, f'row {ordinal}: invalid ordinal')
        for field in ('word', 'ipa_uk', 'ipa_us', 'meaning', 'pos'):
            require(isinstance(row[field], str) and row[field].strip(), f'row {ordinal}: missing {field}')
        word_key = unicodedata.normalize('NFKC', row['word']).strip().casefold()
        require(word_key not in seen, f'row {ordinal}: duplicate word')
        seen.add(word_key)
        pages = row['pages']
        require(isinstance(pages, list) and pages and all(type(page) is int and page > 0 for page in pages),
                f'row {ordinal}: invalid source pages')
        require(len(set(pages)) == len(pages), f'row {ordinal}: duplicate source pages')
    return source


def build_library():
    state = json.loads((PROJECT / 'state.json').read_text(encoding='utf-8'))
    entries = {entry['id']: entry for entry in state['lexicon']['entries']}
    books, used = [], set()
    for article_id, article in sorted(state['articles'].items()):
        source = json.loads((PROJECT / 'drafts' / article_id / 'source.json').read_text(encoding='utf-8'))
        actual = verify_source(article_id, article, source, entries)
        saved = (PROJECT / 'articles' / (article_id + '.md')).read_text(encoding='utf-8')
        if saved != article['article_markdown']:
            raise ValueError(f'{article_id}: downloadable article differs from recorded snapshot')
        paragraphs, words, sections = [], {}, []
        for index, paragraph in enumerate(source['paragraphs']):
            tokens = {}

            def replacement(match):
                surface, word_id, zh, pos = match.groups()
                key = f't{index}-{len(tokens)}'
                tokens[key] = {'id': word_id, 'en': surface, 'zh': zh, 'pos': pos}
                if word_id not in words:
                    words[word_id] = {'id': word_id, 'en': surface, 'lemma': word_id, 'zh': zh,
                                      'pos': pos, 'paragraph': index, 'definition': entries[word_id]['gloss_zh'],
                                      'accepted': [surface, word_id]}
                return '[[' + key + ']]'

            paragraphs.append({'text': TOKEN.sub(replacement, paragraph['text']), 'tokens': tokens,
                               'translation': paragraph.get('zh', '')})
            sections.append(paragraph['role'])
        used |= actual
        category = source.get('category', '温暖悬疑')
        books.append({'id': article_id, 'title': source['title'], 'englishTitle': source.get('english_title', ''),
                      'genre': category, 'label': '原创完整短篇',
                      'description': source.get('description', '旧车站关闭前，一封写着旧昵称的信，让临时清点员重新审视自己的判断。'),
                      'paragraphs': paragraphs, 'sections': sections, 'words': list(words.values()),
                      'focusCount': len(words), 'verifiedCount': len(actual), 'kind': 'original',
                      'sourceNote': '由小说背单词 skill 原创，重点词均对照你的冻结词库核验。已使用仅表示故事覆盖，不代表已经掌握。',
                      'coverIndex': int(article_id[-4:]) - 1})

    catalogs = []
    course_downloads = {}
    ielts_data = None
    source_dates = []
    catalog_sources = json.loads((ROOT / 'catalog-sources.json').read_text(encoding='utf-8'))
    for config in catalog_sources:
        path, course, prefix = config['file'], config['course'], config['prefix']
        source = json.loads((ROOT / path).read_text(encoding='utf-8'))
        source_dates.append(source.get('capturedDate', '2026-10-31'))
        course_books = [{**book, 'id': f'{prefix}-{book["id"]}', 'sourceId': book['id'], 'course': course,
                         'sourceUrl': source.get('courseUrl', source['source']), 'status': 'reference',
                         'sourceKind': source['kind'], 'sourceScope': source.get('scope', '公开目录元数据'),
                         'originalWordCount': book.get('wordCount')} for book in source['books']]
        catalogs.extend(course_books)
        if prefix in ('gaokao', 'ielts', 'kaoyan'):
            course_metadata = {
                **{key: source[key] for key in ('source', 'sourceAsset', 'courseUrl', 'capturedDate', 'scope', 'notes') if key in source},
                'course': course, 'sourceKind': source['kind'], 'contentAccess': 'metadata-only'}
            if prefix == 'ielts':
                ielts_data = {**course_metadata, 'shortBookCount': len(course_books),
                              'longNovel': source['longNovel'], 'reportedShortStats': source['reportedShortStats']}
                course_metadata = ielts_data
            course_downloads[f'{prefix}-catalog.json'] = {**course_metadata, 'books': course_books}
    if len({book['id'] for book in catalogs}) != len(catalogs):
        raise ValueError('Duplicate public catalog identifiers')

    ielts_vocabulary = validate_ielts_vocabulary(json.loads((ROOT / 'ielts-vocabulary-source.json').read_text(encoding='utf-8')))
    if ielts_data is None:
        raise ValueError('IELTS vocabulary requires an IELTS course catalog')
    # The glossary is independent of the reference-only story catalog and CET ledger.
    ielts_data['vocabulary'] = ielts_vocabulary

    lexicon = [{'id': entry['id'], 'en': entry['headword'], 'zh': entry['gloss_zh'], 'used': entry['id'] in used,
                'tracks': sorted({item['list_id'].split('_')[0] for item in entry['sources']})}
               for entry in entries.values()]
    stats = {'target': 5500, 'loaded': len(entries), 'used': len(used), 'unused': len(entries) - len(used),
             'coverage': round(100 * len(used) / len(entries), 2), 'originalCount': len(books),
             'sourceCatalogCount': len(catalogs), 'sourceAccess': 'AUTH_REQUIRED', 'sourceChecked': '2026-10-31',
             'sourceCatalogChecked': max(source_dates)}
    data = {'books': books, 'lexicon': lexicon, 'stats': stats, 'catalogs': catalogs}
    if ielts_data is not None:
        data['ielts'] = ielts_data
    # Complete every content check before replacing any exported artifact.
    (OUT / 'library-data.mjs').write_text('export const library = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    downloads = OUT / 'downloads'
    downloads.mkdir(exist_ok=True)
    (downloads / 'reference-catalog.json').write_text(json.dumps(catalogs, ensure_ascii=False, indent=2), encoding='utf-8')
    for filename, payload in course_downloads.items():
        (downloads / filename).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    (downloads / 'ielts-vocabulary.json').write_text(json.dumps(ielts_vocabulary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    with (downloads / 'ielts-vocabulary.csv').open('w', encoding='utf-8-sig', newline='') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(['序号', '英文', '英式音标', '美式音标', '中文释义', '词性', '原PDF页码'])
        for row in ielts_vocabulary['entries']:
            writer.writerow([row['ordinal'], row['word'], row['ipa_uk'], row['ipa_us'],
                             row['meaning'], row['pos'], '、'.join(map(str, row['pages']))])
    for name in ['vocabulary.csv', 'used.csv', 'unused.csv']:
        with (PROJECT / name).open(encoding='utf-8-sig', newline='') as source_file:
            source_rows = csv.DictReader(source_file)
            fields = [field for field in source_rows.fieldnames if field != 'sources']
            with (downloads / name).open('w', encoding='utf-8-sig', newline='') as export_file:
                writer = csv.DictWriter(export_file, fieldnames=fields, extrasaction='ignore')
                writer.writeheader()
                writer.writerows(source_rows)
    shutil.copyfile(PROJECT / 'progress.md', downloads / 'progress.md')
    for book in books:
        shutil.copyfile(PROJECT / 'articles' / (book['id'] + '.md'), downloads / (book['id'] + '.md'))
    (PROJECT / 'reference-catalog.json').write_text(json.dumps({'sources': sorted({book['sourceUrl'] for book in catalogs}),
        'imported_at': max(source_dates), 'content_access': 'AUTH_REQUIRED; metadata only', 'entries': catalogs}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == '__main__':
    build_library()
