"use strict";

(() => {
  const parameters = new URLSearchParams(location.search);
  const file = parameters.get("file");
  const path = window.ReadingRoomArchive.originalFile(file, parameters.get("layout") === "flat");
  const status = document.querySelector("#status");
  if (!path || !/\.html?$/i.test(path)) {
    status.textContent = "找不到这份归档原网页，请从文稿的阅读页重新打开。";
    return;
  }

  const href = new URL("../" + path, document.baseURI).href;
  const title = parameters.get("title") || "归档原网页";
  document.title = title + " · 归档原网页";
  document.querySelector("#title").textContent = title;
  const download = document.querySelector("#download");
  download.href = href;
  download.hidden = false;

  const viewer = document.querySelector("#original");
  viewer.title = title;
  viewer.src = href;
  viewer.hidden = false;
  status.hidden = true;
})();
