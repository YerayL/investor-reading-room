"""Pack the two canonical JSON files for browsers opened from a file:// URL."""

import base64
import gzip
import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
PREFIX = 'window.READING_ROOM_GZIP="'


def pack(docs, guide):
    raw = json.dumps({"docs": docs, "guide": guide}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    return PREFIX + base64.b64encode(compressed).decode("ascii") + '";\n'


def unpack(bundle):
    if not bundle.startswith(PREFIX) or not bundle.rstrip().endswith('";'):
        raise ValueError("Unrecognized offline bundle")
    encoded = bundle.rstrip()[len(PREFIX):-2]
    return json.loads(gzip.decompress(base64.b64decode(encoded, validate=True)))


if __name__ == "__main__":
    docs, guide = [json.loads((DATA / name).read_bytes()) for name in ("library.json", "guide.json")]
    bundle = pack(docs, guide)
    (DATA / "offline.js").write_text(bundle, encoding="ascii", newline="\n")
    print(f"Packed {len(docs)} documents and {len(guide)} guide chapters in {len(bundle):,} bytes.")
