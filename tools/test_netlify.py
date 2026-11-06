"""Regression checks for the hosted copy of the portable reading room."""

import csv
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from urllib.parse import quote, unquote

from build_netlify import PUBLIC_DIRECTORIES, PUBLIC_FILES, build
from build_offline import unpack


class NetlifyBuildTests(unittest.TestCase):
    def test_hosted_names_preserve_sources_and_all_catalog_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in PUBLIC_DIRECTORIES:
                (root / name).mkdir()
            for name in PUBLIC_FILES:
                (root / name).write_text("public", encoding="utf-8")
            originals = {4: ("Person/Talk (#331).html", b"<p>Original transcript</p>"),
                         593: ("Person/Speech.pdf", b"%PDF-example")}
            docs = []
            for doc_id, (path, raw) in originals.items():
                target = root / "originals" / path
                target.parent.mkdir(exist_ok=True)
                target.write_bytes(raw)
                docs.append(dict(id=doc_id, local=quote(path, safe="/"),
                                 sourceSha256=hashlib.sha256(raw).hexdigest()))
            data = root / "data"
            original_catalog = json.dumps(docs)
            (data / "library.json").write_text(original_catalog, encoding="utf-8")
            (data / "guide.json").write_text("[]", encoding="utf-8")
            (data / "offline.js").write_text("old", encoding="utf-8")
            with (data / "资料目录.csv").open("w", encoding="utf-8-sig", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=["本地相对路径", "SHA256"])
                writer.writeheader()
                writer.writerows({"本地相对路径": unquote(d["local"]).replace("/", "\\"),
                                  "SHA256": d["sourceSha256"]} for d in docs)
            old = docs[0]["local"]
            source_html = f'<a href="originals/{old}">file</a><a href="assets/source.html?file={quote(old, safe="")}">view</a>'
            (root / "sources.html").write_text(source_html, encoding="utf-8")
            (root / ".env").write_text("private", encoding="utf-8")
            (root / ".git").mkdir()
            (root / ".git" / "config").write_text("private", encoding="utf-8")
            for folder in (".hidden", "cache", "__pycache__"):
                (root / "assets" / folder).mkdir()
                (root / "assets" / folder / "private.txt").write_text("private", encoding="utf-8")
            (root / "assets" / ".env.local").write_text("private", encoding="utf-8")

            expected = {old: "Person/archive-0004.html"}
            self.assertEqual(build(root), expected)
            self.assertEqual(build(root), expected)  # Repeated builds are idempotent.
            output = root / "dist"
            hosted = json.loads((output / "data" / "library.json").read_bytes())
            self.assertEqual(hosted[0]["local"], expected[old])
            self.assertEqual(hosted[1], docs[1])
            self.assertEqual(unpack((output / "data" / "offline.js").read_text()),
                             {"docs": hosted, "guide": []})
            for source_doc, hosted_doc in zip(docs, hosted):
                self.assertEqual(source_doc["sourceSha256"], hosted_doc["sourceSha256"])
                self.assertEqual((output / "originals" / unquote(hosted_doc["local"])).read_bytes(),
                                 (root / "originals" / unquote(source_doc["local"])).read_bytes())
            with (output / "data" / "资料目录.csv").open(encoding="utf-8-sig", newline="") as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(rows[0]["本地相对路径"], "Person\\archive-0004.html")
            self.assertEqual(rows[0]["SHA256"], docs[0]["sourceSha256"])
            self.assertNotIn(old, (output / "sources.html").read_text())
            self.assertIn("file=Person%2Farchive-0004.html", (output / "sources.html").read_text())
            self.assertEqual((data / "library.json").read_text(), original_catalog)
            self.assertEqual((root / "sources.html").read_text(), source_html)
            self.assertFalse((output / ".git").exists())
            self.assertFalse((output / ".env").exists())
            self.assertEqual(list((output / "assets").rglob("*")), [])


if __name__ == "__main__":
    unittest.main()
