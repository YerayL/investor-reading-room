"""Build private, numbered reading copies of the HTML in a user's local archive.

Requires beautifulsoup4. Run 'python tools/index_html.py --help' for options.
The public catalog contains the checksums and document paths, never the source text.
"""

import argparse
import hashlib
import html
import json
import re
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import unquote

from bs4 import BeautifulSoup

PROJECT = Path(__file__).resolve().parents[1]
BLOCKS = ('p', 'h1', 'h2', 'h3', 'h4', 'li', 'blockquote', 'tr', 'div', 'section', 'pre')


def normal(value):
    return re.sub(r'\s+', ' ', value).strip()


def paragraphs(raw):
    """The archive's B-reference algorithm; preserve these boundaries across versions."""
    soup = BeautifulSoup(raw, 'html.parser', from_encoding='utf-8')
    for element in soup.select('style,script,nav,footer,header,noscript'):
        element.decompose()
    body = soup
    for selector in ('article', '.body', '.content', 'main', 'body'):
        element = soup.select_one(selector)
        if element and len(element.get_text(strip=True)) > 380:
            body = element
            break

    items = []
    for element in body.find_all(BLOCKS):
        if element.find(BLOCKS):
            continue
        value = normal(element.get_text(' ', strip=True))
        if value and (not items or items[-1] != value):
            items.append(value)
    full = body.get_text('\n', strip=True)
    if sum(map(len, items)) < len(normal(full)) * 0.65:
        items = [normal(value) for value in full.splitlines() if value.strip()]

    result = []
    for value in items:
        if len(value) < 1800:
            result.append(value)
            continue
        buffer = ''
        for fragment in re.split(r'(?<=[。！？.!?])\s*', value):
            if len(buffer) > 850:
                result.append(buffer.strip())
                buffer = ''
            buffer += fragment + ' '
        if buffer.strip():
            result.append(buffer.strip())
    return result


def source_file(archive, doc):
    parts = unquote(doc['local']).replace('\\', '/').split('/')
    if any(not x or x in ('.', '..') or ':' in x or '\0' in x for x in parts):
        raise ValueError(f"Unsafe archive path for document {doc['id']}")
    path = archive.joinpath(*parts).resolve()
    if not path.is_relative_to(archive):
        raise ValueError(f"Archive path escapes its root for document {doc['id']}")
    return path


def reading_copy(doc, rows, style):
    title = html.escape(doc['title'])
    content = '\n'.join(
        f'<p id="B{i}"><a href="#B{i}">第 {i} 段</a><span>{html.escape(value)}</span></p>'
        for i, value in enumerate(rows, 1)
    )
    return (
        '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\';'
        ' base-uri \'none\'; form-action \'none\'">'
        f'<title>{title} · 本地原文</title><style>{style}</style></head>'
        f'<body><main><header><small>本地归档原文 · 正文段落</small><h1>{title}</h1></header>'
        f'{content}</main></body></html>'
    )


def run(args):
    root = args.archive.resolve()
    dest = (args.output or root / 'data' / 'paragraphs').resolve()
    # An offline installation may copy these tools into the archive itself.
    # An output pointing into a separate public reader must always be rejected.
    installed_offline = root == PROJECT and (root / 'data' / 'offline.js').is_file()
    if dest.is_relative_to(PROJECT) and not installed_offline:
        raise ValueError("Refusing to install private reading copies inside the public project")
    docs = [d for d in json.loads(args.library.read_text(encoding='utf-8-sig')) if d['file'] == 'HTML']
    if not docs:
        raise ValueError("No HTML records in the catalog")
    if len(set(d['id'] for d in docs)) != len(docs):
        raise ValueError("Duplicate HTML document IDs")
    style = (PROJECT / 'assets' / 'paragraphs.css').read_text(encoding='utf-8')
    total = 0
    # Validate the full batch before installing any of the derived files.
    if not args.check_only:
        dest.parent.mkdir(parents=True, exist_ok=True)
    stage_at = root if args.check_only else dest.parent
    with TemporaryDirectory(dir=stage_at, prefix='.paragraph-index-') as temp:
        staging = Path(temp)
        for doc in docs:
            doc_id = doc['id']
            if type(doc_id) is not int or doc_id <= 0:
                raise ValueError("Invalid document ID")
            raw = source_file(root, doc).read_bytes()
            digest = hashlib.sha256(raw).hexdigest()
            if digest != doc.get('sourceSha256', '').lower():
                raise ValueError(f"{doc_id}: the original's SHA-256 does not match the catalog")
            rows = paragraphs(raw)
            if not rows:
                raise ValueError(f"{doc_id}: no paragraphs in the archive")
            if args.check_texts:
                reference = args.check_texts / f'{doc_id:04d}.txt'
                rendered = '\n\n'.join(f'[B{i}] {s}' for i, s in enumerate(rows, 1))
                if rendered != reference.read_text(encoding='utf-8-sig'):
                    raise ValueError(f"{doc_id}: numbered paragraphs differ from {reference.name}")
            if not args.check_only:
                filename = f'{doc_id:04d}-{digest[:16]}.html'
                (staging / filename).write_text(reading_copy(doc, rows, style), encoding='utf-8')
            total += len(rows)
        if not args.check_only:
            dest.mkdir(parents=True, exist_ok=True)
            for path in staging.iterdir():
                path.replace(dest / path.name)
    print(f'{len(docs)} HTML documents / {total} numbered paragraphs verified.')
    if not args.check_only:
        print(f'Private reading copies written to {dest}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path, help='Directory containing the original investor folders.')
    parser.add_argument('--library', type=Path, default=PROJECT / 'data' / 'library.json')
    parser.add_argument('--output', type=Path, help='Private output directory; default: ARCHIVE/data/paragraphs')
    parser.add_argument('--check-texts', type=Path, help='Compare every B paragraph with the numbered reference texts.')
    parser.add_argument('--check-only', action='store_true', help='Validate without installing reading copies.')
    try:
        run(parser.parse_args())
    except (OSError, ValueError, KeyError) as exc:
        parser.exit(1, f'{exc}\n')

