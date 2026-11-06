"""Offline synthetic regression tests. Run 'python -m unittest discover -s tools -v'."""

import argparse
import hashlib
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from bs4 import BeautifulSoup

from index_html import paragraphs, reading_copy, run, source_file


class ParagraphIndexTests(unittest.TestCase):
    def test_boundaries_ignore_chrome_join_inline_and_fold_adjacent_duplicates(self):
        raw = b'<header>Menu</header><article><div><p>First <b>bold</b>.</p><p>Same</p><p>Same</p></div><section>Last</section></article>'
        self.assertEqual(paragraphs(raw), ['First bold .', 'Same', 'Last'])

    def test_long_strings_use_sentence_breaks_at_archived_thresholds(self):
        first = 'A' * 860 + '.'
        second = 'B' * 980 + '!'
        self.assertEqual(paragraphs(f'<p>{first}{second}</p>'.encode()), [first, second])

    def test_reader_treats_archive_content_as_text(self):
        expected = '<img src=x onerror=alert(1)>'
        raw = '<p>&lt;img src=x onerror=alert(1)&gt;</p><script>bad()</script>'.encode()
        rows = paragraphs(raw)
        markup = reading_copy({'title': '<script>title</script>'}, rows, '')
        page = BeautifulSoup(markup, 'html.parser')
        self.assertEqual(page.select_one('#B1 span').get_text(), expected)
        self.assertFalse(page.select('script,img,iframe,object,embed'))
        self.assertEqual(page.select_one('#B1 a')['href'], '#B1')

    def test_entire_batch_is_verified_before_installation(self):
        with TemporaryDirectory() as temp:
            root = Path(temp)
            raw = b'<article><p>Original.</p></article>'
            digest = hashlib.sha256(raw).hexdigest()
            (root / 'first.html').write_bytes(raw)
            (root / 'second.html').write_bytes(b'<p>Different edition.</p>')
            library = root / 'catalog.json'
            docs = [dict(id=i, title='Fixture', local=name, sourceSha256=digest, file='HTML')
                    for i, name in enumerate(('first.html', 'second.html'), 1)]
            library.write_text(json.dumps(docs), encoding='utf-8')
            args = argparse.Namespace(archive=root, library=library, output=None, check_texts=None, check_only=False)
            with self.assertRaisesRegex(ValueError, 'SHA-256'):
                run(args)
            self.assertFalse((root / 'data' / 'paragraphs').exists())
            with self.assertRaises(ValueError):
                source_file(root, dict(id=3, local='%2e%2e/outside.html'))

