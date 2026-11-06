"""Validate the public catalog, notes, language links and handbook without network access."""
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

from build_offline import unpack

ROOT = Path(__file__).resolve().parents[1]

def ensure(condition, message):
    if not condition:
        raise ValueError(message)

def load(name):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))

def check_note(n, doc, first=None, last=None):
    context = str(doc["id"])
    for key in ("lead", "practice", "edge"):
        ensure(isinstance(n.get(key), str) and n[key].strip(), context + " / " + key)
    ensure(bool(n.get("sections")), context + " / sections")
    tag = "P" if doc["file"] == "PDF" else "B"
    for section in n["sections"]:
        ensure(section.get("h") and section.get("text") and section.get("refs"), context + " / section")
        for ref in section["refs"]:
            ensure(re.fullmatch(tag + r"[1-9]\d*", ref), context + " / " + ref)
            pos = int(ref[1:])
            if first is not None:
                ensure(first <= pos <= last, context + " / chapter " + ref)
            if doc.get("pages") is not None:
                ensure(pos <= doc["pages"], context + " / " + ref)
        for interval in section.get("ranges", []):
            ends = interval.split("–")
            ensure(len(ends) == 2 and all(re.fullmatch(tag + r"[1-9]\d*", p) for p in ends), context + " / " + interval)
            ensure(int(ends[0][1:]) < int(ends[1][1:]), context + " / range")

def check_archive(files_root, paragraphs_root, doc):
    """Check the exact bytes opened by the reader and every published paragraph anchor."""
    parts = [unquote(part) for part in doc["local"].split("/")]
    ensure(all(part and part not in {".", ".."} and not any(c in part for c in "/"+chr(92)+":"+chr(0))
               for part in parts), f"{doc['id']} / unsafe archive path")
    raw_path = files_root.joinpath(*parts).resolve()
    ensure(raw_path.is_relative_to(files_root.resolve()), f"{doc['id']} / path escapes archive")
    digest = hashlib.sha256(raw_path.read_bytes()).hexdigest()
    ensure(digest == doc["sourceSha256"], f"{doc['id']} / archived original has changed")
    if doc["file"] != "HTML":
        return 0
    page = paragraphs_root / f"{doc['id']:04d}-{digest[:16]}.html"
    text = page.read_text(encoding="utf-8")
    ids = [int(n) for n in re.findall(r'<p id="B([1-9]\d*)">', text)]
    ensure(bool(ids) and ids == list(range(1, len(ids) + 1)), f"{doc['id']} / missing or out-of-order anchors")
    for note in [doc["deep"], *(p["reading"] for p in doc.get("parts", []))]:
        for section in note["sections"]:
            for value in section["refs"] + section.get("ranges", []):
                ensure(all(1 <= int(pos[1:]) <= len(ids) for pos in value.split("–")),
                       f"{doc['id']} / missing offline anchor for {value}")
    for part in doc.get("parts", []):
        ensure(1 <= part["start"] <= part["end"] <= len(ids), f"{doc['id']} / chapter anchor outside HTML")
    return len(ids)


def main():
    docs, guides = load("library.json"), load("guide.json")
    ids = {d["id"] for d in docs}
    ensure(len(ids) == len(docs) and all(isinstance(i, int) and i > 0 for i in ids), "duplicate IDs")
    ensure(len({d["local"] for d in docs}) == len(docs), "duplicate local document path")
    offline = unpack((ROOT / "data" / "offline.js").read_text(encoding="ascii"))
    ensure(offline == {"docs": docs, "guide": guides}, "data/offline.js is stale; run tools/build_offline.py")
    files_root = ROOT / "originals"
    paragraphs_root = ROOT / "data" / "paragraphs"
    html_count = sum(doc["file"] == "HTML" for doc in docs)
    ensure(sum(p.is_file() for p in files_root.rglob("*")) == len(docs), "unexpected or absent archived files")
    ensure(len(list(paragraphs_root.glob("*.html"))) == html_count, "unexpected or absent numbered HTML files")
    anchors = 0
    for doc in docs:
        anchors += check_archive(files_root, paragraphs_root, doc)
        for key in ("title", "folder", "org", "date"):
            ensure(doc.get(key), str(doc["id"]) + " / " + key)
        ensure(re.fullmatch(r"[0-9a-f]{64}", doc["sourceSha256"]), str(doc["id"]) + " / source hash")
        path = unquote(doc["local"]).replace(chr(92), "/")
        ensure(not path.startswith("/") and ".." not in path.split("/") and not re.match(r"^[A-Za-z]:", path), path)
        for url in (doc["web"], doc["sourceUrl"]):
            ensure(urlsplit(url).scheme in {"http", "https"} and urlsplit(url).netloc, url)
        check_note(doc["deep"], doc)
        for alt in doc.get("editions", []):
            ensure(alt["id"] in ids and alt["id"] != doc["id"], "edition reference")
        for part in doc.get("parts", []):
            ensure(part["end"] >= part["start"] > 0 and bool(part["title"]), "chapter bounds")
            check_note(part["reading"], doc, part["start"], part["end"])
    ensure(len({g["key"] for g in guides}) == len(guides), "handbook keys")
    for guide in guides:
        ensure(guide["steps"] and guide["case"]["exercise"], "handbook content")
        for i in guide["ids"] + guide["case"]["ids"]:
            ensure(i in ids, guide["key"] + " / " + str(i))
    print(f"{len(docs)} documents, {len({d['folder'] for d in docs})} collections, {len(guides)} handbook chapters, {anchors:,} offline paragraphs and all original file hashes verified.")

if __name__ == "__main__":
    main()
