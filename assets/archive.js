"use strict";

window.ReadingRoomArchive = (() => {
  function safePath(value) {
    if (typeof value !== "string") return "";
    try {
      const parts = value.split("/").map(decodeURIComponent);
      if (!parts.every(part => part && part !== "." && part !== ".." && !/[\\/:\u0000-\u001f]/.test(part))) return "";
      return parts.map(encodeURIComponent).join("/");
    } catch {
      return "";
    }
  }

  function flatLayout() {
    return document.documentElement.dataset.archiveLayout === "flat" ||
      window.READING_ROOM_LOCAL_ARCHIVE === true;
  }

  function originalFile(path, flat = flatLayout()) {
    const encoded = safePath(path);
    return encoded ? (flat ? "./" : "originals/") + encoded : "";
  }

  function originalView(doc) {
    const raw = originalFile(doc.local);
    if (doc.file === "PDF" || !raw) return raw;
    const parameters = new URLSearchParams({ file: doc.local, title: doc.title });
    if (flatLayout()) parameters.set("layout", "flat");
    return "assets/source.html?" + parameters;
  }

  function reference(doc, ref) {
    const match = /^([BP])([1-9]\d*)$/.exec(ref);
    if (!match) return "";
    if (doc.file === "PDF" && match[1] === "P") {
      const path = originalFile(doc.local);
      return path ? path + "#page=" + match[2] : "";
    }
    if (doc.file !== "HTML" || match[1] !== "B" || !/^[0-9a-f]{64}$/.test(doc.sourceSha256)) return "";
    return "data/paragraphs/" + String(doc.id).padStart(4, "0") + "-" +
      doc.sourceSha256.slice(0, 16) + ".html#B" + match[2];
  }

  return { originalFile, originalView, reference };
})();
