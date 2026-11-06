"""Build and verify a self-contained reading room ZIP from this checkout."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
from urllib.parse import unquote
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "library.json"


def sha256(stream):
    digest = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        digest.update(chunk)
    return digest.hexdigest()


def inventory():
    docs = json.loads(CATALOG.read_text(encoding="utf-8"))
    originals = {"originals/" + unquote(d["local"]): d["sourceSha256"] for d in docs}
    actual = {p.relative_to(ROOT).as_posix() for p in (ROOT / "originals").rglob("*") if p.is_file()}
    if actual != set(originals) or len(originals) != len(docs):
        raise ValueError("The originals directory and the catalog differ.")
    files = {"index.html", "sources.html", "README.md", "LICENSE", "serve.py", "data/资料目录.csv",
             "data/library.json", "data/guide.json", "data/offline.js"}
    for folder in ("assets", "media", "tools"):
        for p in (ROOT / folder).rglob("*"):
            if p.is_file() and "__pycache__" not in p.parts and p.suffix not in {".pyc", ".pyo"}:
                files.add(p.relative_to(ROOT).as_posix())
    for doc in docs:
        if doc["file"] == "HTML":
            files.add(f'data/paragraphs/{doc["id"]:04d}-{doc["sourceSha256"][:16]}.html')
    return sorted(files | set(originals)), originals


def verify_archive(path, names, originals):
    with zipfile.ZipFile(path) as archive:
        if sorted(archive.namelist()) != names:
            raise ValueError("The ZIP inventory differs from the project.")
        bad = archive.testzip()
        if bad:
            raise ValueError("Invalid ZIP entry: " + bad)
        for name, expected in originals.items():
            with archive.open(name) as source:
                if sha256(source) != expected:
                    raise ValueError("Source fingerprint mismatch: " + name)


def build(output):
    names, originals = inventory()
    output = output.resolve()
    if output.suffix.lower() != ".zip" or output.is_relative_to(ROOT / "originals"):
        raise ValueError("Choose a ZIP outside the originals directory.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as temporary:
        draft = Path(temporary) / output.name
        with zipfile.ZipFile(draft, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name in names:
                info = zipfile.ZipInfo(name)
                info.compress_type = (zipfile.ZIP_STORED if Path(name).suffix.lower()
                                      in {".mp4", ".webp", ".jpg", ".png"} else zipfile.ZIP_DEFLATED)
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                with (ROOT / name).open("rb") as source, archive.open(info, "w") as entry:
                    shutil.copyfileobj(source, entry, 1024 * 1024)
        verify_archive(draft, names, originals)
        os.replace(draft, output)
    with output.open("rb") as artifact:
        checksum = sha256(artifact)
    print(f"{len(originals)} verified originals | {output.stat().st_size:,} bytes | SHA-256 {checksum}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Destination ZIP, e.g. ../investor-reading-room-offline.zip")
    build(parser.parse_args().output)
