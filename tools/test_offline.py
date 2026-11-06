"""Regression checks for portable archive links, anchors, original files and offline data."""

import hashlib
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from build_offline import pack, unpack
from verify import ROOT, check_archive


class OfflineBundleTests(unittest.TestCase):
    def test_compressed_file_bundle_preserves_unicode_and_markup_as_data(self):
        docs = [{"id": 9, "title": "问答</script>・中英 & 40%"}]
        guide = [{"key": "估值", "ids": [9]}]
        bundle = pack(docs, guide)
        self.assertTrue(bundle.isascii())
        self.assertNotIn("</script>", bundle)
        self.assertEqual(unpack(bundle), {"docs": docs, "guide": guide})

    def test_rejects_changed_original_and_missing_paragraph(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = b"<p>One</p>"
            (root / "article.html").write_bytes(raw)
            digest = hashlib.sha256(raw).hexdigest()
            doc = dict(id=1, local="article.html", file="HTML", sourceSha256=digest,
                       deep={"sections": [{"refs": ["B1"]}]})
            (root / f"0001-{digest[:16]}.html").write_text('<p id="B1">One</p>', encoding="utf-8")
            self.assertEqual(check_archive(root, root, doc), 1)
            doc["deep"]["sections"][0]["refs"] = ["B2"]
            with self.assertRaisesRegex(ValueError, "missing offline anchor"):
                check_archive(root, root, doc)
            (root / "article.html").write_bytes(b"<p>Changed.</p>")
            with self.assertRaisesRegex(ValueError, "original has changed"):
                check_archive(root, root, doc)

    @unittest.skipUnless(shutil.which("node"), "Node is optional; needed only to exercise browser path functions")
    def test_browser_links_support_both_layouts_and_deny_external_sources(self):
        script = """
        global.window = {};
        global.document = {documentElement: {dataset: {}}};
        require(process.argv[1]);
        const archive = window.ReadingRoomArchive;
        const pdf = {id: 1, local: 'Li%20Lu/%E6%BC%94%E8%AE%B2.pdf', file: 'PDF'};
        const html = {id: 73, file: 'HTML', local: 'A/100%25.html', title: 'A & B', sourceSha256: 'a'.repeat(64)};
        const publicLink = archive.reference(pdf, 'P27');
        const viewer = new URL(archive.originalView(html), 'https://example.test/library/');
        document.documentElement.dataset.archiveLayout = 'flat';
        console.log(JSON.stringify([
          publicLink, archive.reference(pdf, 'P27'), archive.reference(html, 'B32'),
          viewer.pathname, viewer.searchParams.get('file'),
          ['../outside.html', 'A/%2e%2e/x', 'https://example.test/', 'A/%2fetc', 'C%3a/x', '']
             .map(path => archive.originalFile(path)),
          archive.reference(html, 'P32'), archive.reference(pdf, 'B27')
        ]));
        """
        result = subprocess.run(["node", "-e", script, str(ROOT / "assets" / "archive.js")],
                                text=True, capture_output=True, check=True)
        public_pdf, flat_pdf, para, viewer, archived_file, rejected, bad_page, bad_para = json.loads(result.stdout)
        self.assertEqual(public_pdf, "originals/Li%20Lu/%E6%BC%94%E8%AE%B2.pdf#page=27")
        self.assertEqual(flat_pdf, "./Li%20Lu/%E6%BC%94%E8%AE%B2.pdf#page=27")
        self.assertEqual(para, "data/paragraphs/0073-aaaaaaaaaaaaaaaa.html#B32")
        self.assertEqual((viewer, archived_file), ("/library/assets/source.html", "A/100%25.html"))
        self.assertTrue(all(item == "" for item in [*rejected, bad_page, bad_para]))


if __name__ == "__main__":
    unittest.main()
