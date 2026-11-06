"""Validate the public catalog, notes, language links and handbook without network access."""
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

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

def main():
    docs, guides = load("library.json"), load("guide.json")
    ids = {d["id"] for d in docs}
    ensure(len(ids) == len(docs) and all(isinstance(i, int) and i > 0 for i in ids), "duplicate IDs")
    ensure(len({d["local"] for d in docs}) == len(docs), "duplicate local document path")
    for doc in docs:
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
    print(f"{len(docs)} documents, {len({d['folder'] for d in docs})} collections, {len(guides)} handbook chapters verified.")

if __name__ == "__main__":
    main()
