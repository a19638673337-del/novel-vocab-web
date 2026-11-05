"""Extract only the public book catalog from the saved page script; never execute it."""
import ast
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT.parent / '参考网页快照' / '2026-11-01-考研课程公开脚本.js'
FIELDS = {'id', 'no', 'title', 'genre', 'intro', 'chapterCount', 'wordCount', 'cover', 'coverSrcSet'}


def extract_catalog(script):
    matches = list(re.finditer(r"\bBi=JSON\.parse\(('(?:\\.|[^'\\])*')\)", script))
    if len(matches) != 1:
        raise ValueError('Expected one public Bi catalog JSON string')
    # literal_eval handles the quoted string only, not the surrounding JavaScript.
    books = json.loads(ast.literal_eval(matches[0][1]))
    if not isinstance(books, list) or not books:
        raise ValueError('Catalog must be a nonempty list')
    seen = set()
    for no, book in enumerate(books, 1):
        if not isinstance(book, dict) or not set(book) <= FIELDS:
            raise ValueError('Unexpected non-catalog fields')
        if book.get('id') != f'book-{no:02}' or book.get('no') != no or book['id'] in seen:
            raise ValueError('Invalid or repeated book identifier')
        seen.add(book['id'])
        for field in ['title', 'genre', 'intro', 'cover']:
            if not isinstance(book.get(field), str) or not book[field].strip():
                raise ValueError(f'Missing {field} for {book["id"]}')
        for field in ['chapterCount', 'wordCount']:
            if type(book.get(field)) is not int or book[field] < 0:
                raise ValueError(f'Invalid {field} for {book["id"]}')
        if not book['cover'].startswith('/assets/kaoyan/covers/'):
            raise ValueError('Unexpected cover origin')
    return books


def main():
    raw = SNAPSHOT.read_bytes()
    books = extract_catalog(raw.decode('utf-8'))
    old = json.loads((ROOT / 'competitor-kaoyan-title-index-public.json').read_text(encoding='utf-8'))
    if {b['id']: b['title'] for b in books} != {b['id']: b['title'] for b in old['books']}:
        raise ValueError('Catalog identifiers or titles changed; review before replacing exports')
    payload = {
        'source': 'https://novel.quwanclass.com/kaoyan/?account=unified',
        'sourceAsset': 'https://novel.quwanclass.com/assets/index-DUi-mDJ7.js',
        'courseUrl': 'https://novel.quwanclass.com/kaoyan/?account=unified',
        'kind': 'public-catalog', 'capturedDate': '2026-11-01',
        'scope': '考研公开书架目录：56部作品的序号、标题、题材、开篇短简介、原站章数/词数及封面路径。不含小说正文、独立章节标题、词表、音频或账号信息。',
        'missingFields': ['chapters'],
        'notes': '仅静态解码公开 Bi JSON 字符串，未执行第三方脚本、未读取正文块。原站标注词数未经本站按正文重算；不用于词库覆盖统计。封面地址仅作来源元数据，网页使用本站已有插画及文字书封。',
        'extraction': {
            'snapshot': '参考网页快照/2026-11-01-考研课程公开脚本.js',
            'snapshotSha256': hashlib.sha256(raw).hexdigest(),
            'bookArraySymbol': 'Bi', 'displayArraySymbol': 'Gs',
            'mergeRule': 'Gs only optionally changes cover; chapterCount and wordCount are unchanged Bi values',
            'historicalTitleMatches': len(books), 'chapterTitlesAvailable': False,
        },
        'books': books,
    }
    (ROOT / 'competitor-kaoyan-catalog-public.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'books': len(books), 'genres': len({b['genre'] for b in books}), 'fullTexts': 0}, ensure_ascii=False))


if __name__ == '__main__':
    main()
