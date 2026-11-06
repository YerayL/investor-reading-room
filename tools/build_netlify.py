"""Build a portable public tree while adapting archive names to Netlify's rules."""

import csv
import hashlib
import json
import shutil
from pathlib import Path
from urllib.parse import quote, unquote

from build_offline import pack


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = ("index.html", "sources.html", "LICENSE", "README.md")
PUBLIC_DIRECTORIES = ("assets", "data", "media", "originals")
EXCLUDED_NAMES = {"__pycache__", "node_modules", "cache", "caches", "dist"}


def excluded(path):
    return any(part.startswith(".") or part.lower() in EXCLUDED_NAMES for part in path.parts)


def update_links(text, replacements):
    for old, new in replacements.items():
        text = text.replace("originals/" + old, "originals/" + new)
        text = text.replace("file=" + quote(old, safe=""), "file=" + quote(new, safe=""))
    return text


def build(root=ROOT):
    root = root.resolve()
    output = root / "dist"
    # Only the fixed, verified staging directory may be removed on a repeat build.
    if output.is_symlink() or output.resolve() != root / "dist":
        raise ValueError("The staging directory must be a direct child of the project")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir()

    for name in PUBLIC_FILES:
        source = root / name
        if source.is_symlink():
            raise ValueError(f"Public files must not be symbolic links: {name}")
        shutil.copyfile(source, output / name)
    for name in PUBLIC_DIRECTORIES:
        source_root = root / name
        for source in source_root.rglob("*"):
            relative = source.relative_to(root)
            if excluded(relative):
                continue
            if source.is_symlink():
                raise ValueError(f"Public files must not be symbolic links: {relative}")
            if source.is_file():
                destination = output / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(source, destination)

    catalog_path = output / "data" / "library.json"
    docs = json.loads(catalog_path.read_bytes())
    replacements = {}
    for doc in docs:
        old = doc["local"]
        decoded = unquote(old)
        if "#" not in decoded and "?" not in decoded:
            continue
        relative = Path(decoded)
        replacement = relative.with_name(f"archive-{doc['id']:04d}{relative.suffix}")
        new = quote(replacement.as_posix(), safe="/")
        source = output / "originals" / relative
        destination = output / "originals" / replacement
        if destination.exists():
            raise ValueError(f"Archive destination already exists: {replacement}")
        source.rename(destination)
        doc["local"] = new
        replacements[old] = new

    catalog_path.write_text(json.dumps(docs, ensure_ascii=False, separators=(",", ":")),
                            encoding="utf-8", newline="\n")
    guide = json.loads((output / "data" / "guide.json").read_bytes())
    (output / "data" / "offline.js").write_text(pack(docs, guide), encoding="ascii", newline="\n")

    csv_path = output / "data" / "资料目录.csv"
    with csv_path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        columns, rows = reader.fieldnames, list(reader)
    csv_replacements = {unquote(old): unquote(new) for old, new in replacements.items()}
    for row in rows:
        path = row["本地相对路径"].replace("\\", "/")
        if path in csv_replacements:
            row["本地相对路径"] = csv_replacements[path].replace("/", "\\")
    with csv_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)

    # The source directory currently links to publisher websites. This also keeps
    # any future archive links in that page aligned with the hosted catalog.
    sources = output / "sources.html"
    sources.write_text(update_links(sources.read_text(encoding="utf-8"), replacements),
                       encoding="utf-8", newline="\n")
    for doc in docs:
        original = output / "originals" / unquote(doc["local"])
        if hashlib.sha256(original.read_bytes()).hexdigest() != doc["sourceSha256"]:
            raise ValueError(f"Original checksum mismatch: {doc['id']}")
    for path in output.rglob("*"):
        if "#" in path.name or "?" in path.name:
            raise ValueError(f"Unsupported hosted filename: {path.relative_to(output)}")
    print(f"Built {len(docs)} verified originals in dist; adapted {len(replacements)} archive names.")
    return replacements


if __name__ == "__main__":
    build()
