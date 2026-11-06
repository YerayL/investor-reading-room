"use strict";
(function () {
  const main = document.querySelector("#main");
  const icons = {
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    book: '<path d="M3 4c4-1 7 0 9 2 3-2 6-3 9-2v14c-4-1-6 0-9 2-3-2-6-3-9-2zM12 6v14"/>',
    file: '<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h6"/>',
    people:
      '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m0-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 4 5"/>',
    guide: '<path d="M5 3h14v18H5zM8 3v18m3-14h5m-5 4h4"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.6"/><path d="m16 16 5 5"/>',
    link: '<path d="M14 4h6v6m0-6L10 14m-1-8H4v14h14v-5"/>',
    folder: '<path d="M3 7V5h7l2 3h9v11H3z"/>',
    tag: '<path d="m3 4 8-.3L21 14l-7 7L3 10z"/><circle cx="7" cy="7.5" r=".8"/>',
    stack: '<path d="m3 8 9-5 9 5-9 5zm0 5 9 5 9-5M3 17l9 5 9-5"/>',
    grid: '<path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"/>',
    filter:
      '<path d="M3 6h12m4 0h2M3 12h5m4 0h9M3 18h10m4 0h4"/><circle cx="17" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
    mark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    back: '<path d="m12 5-7 7 7 7m-7-7h15"/>',
    close: '<path d="m5 5 14 14M19 5 5 19"/>',
  };
  function icon(n) {
    return (
      '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' +
      (icons[n] || "") +
      "</svg>"
    );
  }
  const escapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => escapeMap[c]);
  const str = (v) => (Array.isArray(v) ? v.join("\n") : String(v ?? ""));
  const para = (v) =>
    str(v)
      .split(/\n+/)
      .filter(Boolean)
      .map((p) => "<p>" + esc(p) + "</p>")
      .join("");
  const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  function dataArr(raw, key) {
    return Array.isArray(raw) ? raw : raw?.[key] || [];
  }
  const cmp = (a, b) => a.localeCompare(b, "zh-CN");
  const norm = (v) =>
    String(v || "")
      .toLocaleLowerCase()
      .normalize("NFKC")
      .trim();
  function clearName(name) {
    return (
      String(name || "")
        .replace(/\s+[A-Z][a-zA-Z .’'-]*$/, "")
        .trim() || name
    );
  }
  function who(d) {
    return clearName(d.alias || d.folder || d.person);
  }
  function author(d) {
    return clearName(d.alias || d.person || d.folder);
  }
  function date(d) {
    return d.date || "日期未载";
  }
  function url(raw) {
    if (!raw) return "";
    try {
      let u = new URL(raw);
      return ["https:", "http:"].includes(u.protocol) ? u.href : "";
    } catch {
      return "";
    }
  }
  function route(name, params = {}) {
    let p = new URLSearchParams();
    for (let [k, v] of Object.entries(params)) if (v) p.set(k, v);
    return "#/" + name + (p.size ? "?" + p : "");
  }
  function library(params) {
    return route("library", params);
  }
  function year(d) {
    return String(d.date || "").match(/\d{4}/)?.[0] || "";
  }
  function reading(d) {
    return d?.deep || d?.reading || d || {};
  }
  function readURL(id, chapter) {
    return route("read/" + Number(id), chapter ? { chapter } : {});
  }
  function storage() {
    try {
      return JSON.parse(localStorage.getItem("irr-bookmarks") || "[]");
    } catch {
      return [];
    }
  }
  let docs = [],
    guide = [],
    groups = [],
    byId = new Map(),
    corpus = new Map(),
    bookmarks = new Set(storage()),
    current = {},
    toastTimer;
  function getloc() {
    const [path, query = ""] = (location.hash.slice(1) || "/").split("?");
    const old = path.match(/^n-(\d+)$/);
    return {
      path: old ? "/read/" + old[1] : path || "/",
      q: new URLSearchParams(query),
    };
  }
  function navSelected(n) {
    for (let a of document.querySelectorAll("[data-nav]")) {
      if (a.dataset.nav === n) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  }
  function header(k, title, desc) {
    return (
      '<div class="page-heading"><div class="smallhead"><i></i>' +
      k +
      "</div><h1>" +
      esc(title) +
      "</h1>" +
      (desc ? "<p>" + esc(desc) + "</p>" : "") +
      "</div>"
    );
  }
  function badge(text) {
    return '<span class="badge">' + esc(text) + "</span>";
  }
  function linkArrow(href, label) {
    return (
      '<a class="text-link" href="' +
      esc(href) +
      '">' +
      esc(label) +
      icon("arrow") +
      "</a>"
    );
  }
  function groupName(g) {
    return g.name;
  }
  function altName(g) {
    let n = g.folder;
    if (n !== g.name) return n.replace(g.name, "").trim() || g.name;
    return "";
  }
  function personLink(name) {
    return library({ person: name });
  }
  function resultRow(d) {
    return (
      '<a class="doc-row" href="' +
      readURL(d.id) +
      '"><div class="row-info"><small>' +
      esc(author(d)) +
      "<em>·</em>" +
      esc(d.kind || d.form || "文稿") +
      "</small><h3>" +
      esc(d.title) +
      '</h3></div><div class="row-meta"><span>' +
      esc(date(d)) +
      "</span>" +
      badge(d.lang || d.file) +
      "</div>" +
      icon("right") +
      "</a>"
    );
  }
  function sourceTile(href, title, n, iconName) {
    return (
      '<a class="jump-tile" href="' +
      href +
      '"><span class="tile-ic">' +
      icon(iconName) +
      "</span><span><b>" +
      title +
      "</b><small>" +
      n +
      "</small></span>" +
      icon("right") +
      "</a>"
    );
  }
  function home() {
    const d = byId.get(593) || docs[0];
    if (!d) return empty("文库暂无文稿", "");
    let selected = [597, 153, 574, 705, 876, 378]
      .map((id) => byId.get(id))
      .filter(Boolean);
    if (!selected.length) selected = docs.slice(0, 6);
    const featuredGroups = [
      "李录",
      "Howard Marks",
      "查理·芒格",
      "约翰·博格",
      "莫尼什·帕伯莱",
    ]
      .map((t) => groups.find((g) => norm(g.folder).includes(norm(t))))
      .filter(Boolean);
    const collectionCount = docs.filter((x) => arr(x.parts).length).length;
    return (
      '<div class="wrap home"><section class="hero"><div class="hero-art" aria-hidden="true"></div><div class="hero-copy"><div class="hero-kicker"><span></span>专题选读</div><h1>' +
      esc(d.title) +
      '</h1><p class="feature-meta">' +
      esc(author(d)) +
      "<i></i>" +
      esc(date(d)) +
      '</p><p class="feature-blurb">' +
      (d.id === 593
        ? "从文明与市场的长期变化，回到投资者如何守住购买力。"
        : "阅读这篇投资文稿的核心论点与个人投资应用。") +
      '</p><a href="' +
      readURL(d.id) +
      '" class="hero-cta">阅读此篇' +
      icon("arrow") +
      '</a></div></section><div class="jump-grid">' +
      sourceTile(
        "#/library",
        "全部文稿",
        docs.length.toLocaleString() + " 份文稿",
        "book",
      ) +
      sourceTile(
        "#/investors",
        "投资家目录",
        groups.length + " 个资料目录",
        "people",
      ) +
      sourceTile(
        "#/guide",
        "投资实践手册",
        guide.length + " 个实践问题",
        "guide",
      ) +
      (collectionCount
        ? sourceTile(
            library({ collections: "1" }),
            "分篇合订本",
            collectionCount + " 部合订本",
            "stack",
          )
        : "") +
      '</div><div class="home-split"><section class="curated"><div class="section-head"><h2>选读文稿</h2>' +
      linkArrow("#/library", "浏览文库") +
      '</div><div class="doc-list">' +
      selected.map(resultRow).join("") +
      '</div></section><aside class="home-side"><div class="section-head"><h2>投资家索引</h2>' +
      linkArrow("#/investors", "全部") +
      '</div><div class="people-panel">' +
      featuredGroups
        .map(
          (g) =>
            '<a href="' +
            esc(personLink(g.folder)) +
            '"><span class="person-dot">' +
            esc(monogram(g.name)) +
            "</span><div><b>" +
            esc(g.name) +
            "</b><small>" +
            esc(altName(g) || "投资文稿") +
            '</small></div><span class="ncount">' +
            g.docs.length +
            " 篇</span></a>",
        )
        .join("") +
      "</div></aside></div></div>"
    );
  }
  function monogram(n) {
    let c = n.match(/[\u3400-\u9fff]/);
    if (c) return c[0];
    return n
      .split(/\s+/)
      .slice(0, 2)
      .map((t) => t.charAt(0))
      .join("");
  }
  function options(values, selected, first) {
    return (
      '<option value="">' +
      esc(first) +
      "</option>" +
      values
        .map((v) => {
          let key = Array.isArray(v) ? v[0] : v;
          let text = Array.isArray(v) ? v[1] : v;
          return (
            '<option value="' +
            esc(key) +
            '"' +
            (selected === key ? " selected" : "") +
            ">" +
            esc(text) +
            "</option>"
          );
        })
        .join("")
    );
  }
  function empty(h, t) {
    return (
      '<div class="empty">' +
      icon("search") +
      "<h2>" +
      esc(h) +
      "</h2>" +
      para(t) +
      "</div>"
    );
  }
  function searchbox(id, value, placeholder) {
    return (
      '<div class="search-box">' +
      icon("search") +
      '<input type="search" id="' +
      id +
      '" value="' +
      esc(value) +
      '" placeholder="' +
      esc(placeholder) +
      '" aria-label="' +
      esc(placeholder) +
      '" autocomplete="off"></div>'
    );
  }
  function sortDocs(list, key) {
    return list
      .slice()
      .sort((a, b) =>
        key === "old"
          ? String(a.date || "9999").localeCompare(String(b.date || "9999"))
          : key === "title"
            ? cmp(a.title, b.title)
            : String(b.date || "").localeCompare(String(a.date || "")) ||
              a.id - b.id,
      );
  }
  function listPage(q) {
    const p = Object.fromEntries(q);
    const tokens = norm(p.q).split(/\s+/).filter(Boolean);
    const matches = sortDocs(
      docs.filter(
        (d) =>
          (!p.person || p.person === d.folder) &&
          (!p.kind || p.kind === d.kind) &&
          (!p.lang || p.lang === d.lang) &&
          (!p.year || p.year === year(d)) &&
          (!p.collections || arr(d.parts).length) &&
          (!p.saved || bookmarks.has(d.id)) &&
          tokens.every((t) => corpus.get(d.id).includes(t)),
      ),
      p.sort,
    );
    const size = 24,
      total = Math.max(1, Math.ceil(matches.length / size)),
      page = Math.max(1, Math.min(Number(p.page) || 1, total));
    let filterActive = [
      "q",
      "person",
      "kind",
      "lang",
      "year",
      "collections",
      "saved",
    ].some((k) => p[k]);
    const sel = (key, label, values, first) =>
      '<label class="select-label">' +
      label +
      '<select data-filter="' +
      key +
      '">' +
      options(values, p[key] || "", first) +
      "</select></label>";
    const check = (k, l) =>
      '<label class="check-label"><input type="checkbox" data-filter="' +
      k +
      '"' +
      (p[k] ? " checked" : "") +
      ">" +
      l +
      "</label>";
    return (
      '<div class="wrap ordinary">' +
      header("馆藏目录", "全部文稿", "检索投资者、文稿题名、主题及笔记正文。") +
      '<div class="library-layout"><aside class="filters"><div class="filter-cap">' +
      icon("filter") +
      "筛选文稿</div>" +
      sel(
        "person",
        "投资家 / 资料目录",
        groups.map((g) => [
          g.folder,
          g.name +
            (g.name !== g.folder
              ? " · " + g.folder.replace(g.name, "").trim()
              : ""),
        ]),
        "全部投资家",
      ) +
      sel(
        "kind",
        "文稿类型",
        [...new Set(docs.map((d) => d.kind).filter(Boolean))].sort(cmp),
        "全部类型",
      ) +
      sel(
        "lang",
        "原文语言",
        [...new Set(docs.map((d) => d.lang).filter(Boolean))],
        "全部语言",
      ) +
      sel(
        "year",
        "年份",
        [...new Set(docs.map(year).filter(Boolean))].sort().reverse(),
        "全部年份",
      ) +
      check("collections", "仅看分篇合订本") +
      check("saved", "仅看我的书签") +
      (filterActive
        ? '<a class="clear" href="#/library">清除全部筛选</a>'
        : "") +
      '</aside><section class="catalog">' +
      searchbox("query", p.q || "", "搜索题名、投资家或关键词") +
      '<div class="results-head"><span>共 <strong>' +
      matches.length.toLocaleString() +
      '</strong> 份文稿</span><label>排序 <select data-filter="sort">' +
      options(
        [
          ["old", "日期由早到晚"],
          ["title", "按题名"],
        ],
        p.sort || "",
        "日期由近到远",
      ) +
      '</select></label></div><div class="doc-list">' +
      (matches.length
        ? matches
            .slice((page - 1) * size, page * size)
            .map(resultRow)
            .join("")
        : empty("没有找到匹配的文稿", "可以更换关键词或清除筛选。")) +
      "</div>" +
      (total > 1
        ? '<div class="pager">' +
          (page > 1
            ? linkArrow(library({ ...p, page: page - 1 }), "上一页")
            : "<span></span>") +
          "<span>" +
          page +
          " / " +
          total +
          "</span>" +
          (page < total
            ? linkArrow(library({ ...p, page: page + 1 }), "下一页")
            : "<span></span>") +
          "</div>"
        : "") +
      "</section></div></div>"
    );
  }
  function investorPage(q) {
    let term = norm(q.get("q")),
      shown = groups.filter((g) =>
        norm([g.name, g.folder, ...g.names].join(" ")).includes(term),
      );
    return (
      '<div class="wrap ordinary">' +
      header("人物索引", "投资家目录", "按投资家与机构资料目录查阅相关文稿。") +
      searchbox("person-query", q.get("q") || "", "搜索投资家中文名或英文名") +
      '<div class="results-head"><span>共 <strong>' +
      shown.length +
      '</strong> 个目录</span></div><div class="person-grid">' +
      shown
        .map(
          (g) =>
            '<a class="person-card" href="' +
            esc(personLink(g.folder)) +
            '"><span class="person-dot">' +
            esc(monogram(g.name)) +
            "</span><div><h3>" +
            esc(groupName(g)) +
            "</h3>" +
            (altName(g) ? "<small>" + esc(altName(g)) + "</small>" : "") +
            "<p>" +
            g.docs.length +
            " 份文稿</p></div>" +
            icon("right") +
            "</a>",
        )
        .join("") +
      "</div>" +
      (!shown.length
        ? empty("没有找到匹配的人物", "请尝试姓氏、拼音或英文名。")
        : "") +
      "</div>"
    );
  }
  function crumb(entries) {
    return (
      '<nav class="crumb" aria-label="所在位置">' +
      entries
        .map(
          (e, i) =>
            (i ? icon("right") : "") +
            (e[0]
              ? '<a href="' + esc(e[0]) + '">' + esc(e[1]) + "</a>"
              : "<span>" + esc(e[1]) + "</span>"),
        )
        .join("") +
      "</nav>"
    );
  }
  function refs(d, values, ranges = []) {
    const prefix = d.file === "PDF" ? "P" : "B";
    const unit = prefix === "P" ? "页" : "段";
    function refLink(start, end) {
      const match = new RegExp("^" + prefix + "([1-9]\\d*)$").exec(start);
      const href = window.ReadingRoomArchive.reference(d, start);
      if (!match || !href) return "";
      const number = match[1];
      const label = "第 " + number + (end ? "–" + end : "") + " " + unit;
      const attr = prefix === "P" ? "data-page" : "data-paragraph";
      return '<a class="ref-link" href="' + esc(href) + '" target="_blank" rel="noopener" ' +
        attr + '="' + number + '" data-doc="' + d.id + '">' + label + "</a>";
    }
    const rangeLinks = arr(ranges).map(value => {
      const match = /^([BP])([1-9]\d*)–([BP])([1-9]\d*)$/.exec(value);
      return match && match[1] === prefix && match[3] === prefix ? refLink(prefix + match[2], match[4]) : "";
    });
    const singleLinks = arr(values).map(value => {
      let ref = String(typeof value === "object" ? value.num || "" : value);
      if (/^\d+$/.test(ref)) ref = prefix + ref;
      return refLink(ref);
    });
    const links = rangeLinks.concat(singleLinks).filter(Boolean);
    return links.length ? '<div class="references"><b>原文定位</b>' + links.join("") + "</div>" : "";
  }
  function sourceButtons(d) {
    const archive = window.ReadingRoomArchive.originalView(d);
    const direct = url(d.sourceUrl);
    const web = url(d.web);
    return (archive ? '<a class="btn small" data-original="' + d.id + '" href="' + esc(archive) +
      '" target="_blank" rel="noopener">' + icon("folder") + '打开本地原文</a>' : "") +
      (direct && direct !== web ? '<a class="btn small" href="' + esc(direct) +
        '" target="_blank" rel="noopener noreferrer">在线原文' + icon("link") + '</a>' : "") +
      (web ? '<a class="btn small" href="' + esc(web) +
        '" target="_blank" rel="noopener noreferrer">来源页面' + icon("link") + '</a>' : "");
  }
  function bookmarkButton(d) {
    return (
      '<button class="btn small save' +
      (bookmarks.has(d.id) ? " on" : "") +
      '" data-save="' +
      d.id +
      '" aria-pressed="' +
      bookmarks.has(d.id) +
      '">' +
      icon("mark") +
      (bookmarks.has(d.id) ? "已加书签" : "加书签") +
      "</button>"
    );
  }
  function navButton(id, text, n = "") {
    return (
      '<button data-jump="' +
      esc(id) +
      '">' +
      (n ? "<span>" + n + "</span>" : "") +
      esc(text) +
      "</button>"
    );
  }
  function blockList(v) {
    return (
      '<ul class="prose-list">' +
      arr(v)
        .map((x) => "<li>" + esc(x) + "</li>")
        .join("") +
      "</ul>"
    );
  }
  function principleQuestions(doc, section) {
    if (![592, 593].includes(doc.id) || !section.h.includes("六条原则"))
      return "";
    const rows = [
      ["企业所有权", "买下的是哪门生意？哪种现金最终能归股东？"],
      ["市场先生", "暂时看不到报价时，我凭什么给公司估值？"],
      ["安全边际", "如果利润比预想低、兑现比预想慢，买价留出了多少余量？"],
      ["能力圈", "产品、竞争、顾客、财务，哪一项我还不能独立查证？"],
      [
        "到有鱼的地方钓鱼",
        "我了解哪一小块市场？有哪些事实可能被目前的价格忽略？",
      ],
      [
        "保护和增加购买力份额",
        "钱将在哪里使用？企业为什么能随所属经济体创造更多价值？",
      ],
    ];
    return (
      '<div class="table-scroll"><table class="trade-table"><caption>六项原则的研究自问（整理者拟）</caption><thead><tr><th scope="col">原则</th><th scope="col">研究问题</th></tr></thead><tbody>' +
      rows
        .map(
          ([a, b]) =>
            '<tr><th scope="row">' +
            esc(a) +
            "</th><td>" +
            esc(b) +
            "</td></tr>",
        )
        .join("") +
      "</tbody></table></div>"
    );
  }
  function articleText(d, n) {
    return arr(n.sections)
      .map(
        (s, i) =>
          '<section class="read-section" id="sec-' +
          i +
          '"><h2>' +
          esc(s.h || s.title) +
          "</h2>" +
          para(s.text) +
          principleQuestions(d, s) +
          refs(d, s.refs, s.ranges) +
          "</section>",
      )
      .join("");
  }
  function collection(d, index) {
    const parts = arr(d.parts);
    if (!parts.length) return "";
    const p = parts[index],
      isPDF = String(d.file).toUpperCase() === "PDF",
      unit = isPDF ? "页" : "段";
    let body =
      '<div class="parts-head"><div class="smallhead"><i></i>分篇阅读</div><h2>合订本目录</h2><p>共 ' +
      parts.length +
      ' 篇，选择篇目查看独立笔记。</p><label class="select-label">选择篇目<select id="chapter-select"><option value="">请选择篇目</option>' +
      parts
        .map(
          (a, i) =>
            '<option value="' +
            (i + 1) +
            '"' +
            (i === index ? " selected" : "") +
            ">" +
            (i + 1) +
            ". " +
            esc(a.title) +
            " · " +
            Number(a.start) +
            "–" +
            Number(a.end) +
            unit +
            "</option>",
        )
        .join("") +
      "</select></label></div>";
    if (p) {
      const n = reading(p);
      body +=
        '<div class="chapter-body"><div class="chapter-nav">' +
        (index > 0
          ? '<a href="' + readURL(d.id, index) + '">← 上一篇</a>'
          : "<span></span>") +
        "<span>" +
        String(index + 1) +
        " / " +
        parts.length +
        "</span>" +
        (index + 1 < parts.length
          ? '<a href="' + readURL(d.id, index + 2) + '">下一篇 →</a>'
          : "<span></span>") +
        "</div><h3>" +
        esc(p.title) +
        "</h3><small>" +
        (isPDF ? "原版 PDF 第 " : "原文第 ") +
        p.start +
        "–" +
        p.end +
        " " +
        unit +
        "</small>" +
        para(n.lead) +
        (arr(n.sections).length
          ? arr(n.sections)
              .map(
                (s) =>
                  "<h4>" +
                  esc(s.h) +
                  "</h4>" +
                  para(s.text) +
                  refs(d, s.refs, s.ranges),
              )
              .join("")
          : blockList(p.points)) +
        "<h4>个人投资应用</h4>" +
        para(n.practice || p.use) +
        (n.edge ? "<h4>适用条件</h4>" + para(n.edge) : "") +
        refs(d, p.refs) +
        "</div>";
    }
    return '<section class="collection" id="collection">' + body + "</section>";
  }
  function read(d, q) {
    if (!d)
      return (
        '<div class="wrap ordinary">' +
        empty("找不到这篇文稿", "请回到文库重新选择。") +
        linkArrow("#/library", "返回文库") +
        "</div>"
      );
    const n = reading(d),
      ss = arr(n.sections),
      ed = arr(d.editions).filter(
        (e) => byId.has(Number(e.id || e)) && Number(e.id || e) !== d.id,
      ),
      parts = arr(d.parts),
      index =
        Math.min(Math.max(Number(q.get("chapter")) || 0, 0), parts.length) - 1;
    let toc = ss
      .map((s, i) =>
        navButton("sec-" + i, s.h || s.title, String(i + 1).padStart(2, "0")),
      )
      .join("");
    if (!toc) toc = navButton("points", "文稿重点");
    toc +=
      (parts.length ? navButton("collection", "合订本分篇") : "") +
      navButton("practice", "个人投资应用") +
      navButton("edge", "适用条件");
    return (
      '<div class="wrap ordinary reader-wrap">' +
      crumb([
        ["#/library", "全部文稿"],
        [personLink(d.folder), who(d)],
        ["", "文稿阅读"],
      ]) +
      '<div class="reader-grid"><article class="reader"><div class="read-cap">' +
      badge(d.kind || d.form) +
      badge(d.lang) +
      "</div><h1>" +
      esc(d.title) +
      '</h1><div class="byline">' +
      esc(d.person || who(d)) +
      '<i></i><span title="' +
      esc(d.datebasis || "") +
      '">' +
      esc(date(d)) +
      "</span>" +
      (d.org ? "<i></i>" + esc(d.org) : "") +
      (d.pages ? "<i></i>" + esc(d.pages) + " 页" : "") +
      '</div><div class="reader-actions">' +
      sourceButtons(d) +
      bookmarkButton(d) +
      '<button class="btn small read-print" data-action="print">打印笔记</button></div>' +
      (ed.length
        ? '<div class="editions">' +
          icon("book") +
          "<b>其他版本</b>" +
          ed
            .map((e) => {
              let o = byId.get(Number(e.id || e));
              return (
                '<a href="' +
                readURL(o.id) +
                '">' +
                esc(e.label || o.lang) +
                " ↗</a>"
              );
            })
            .join("") +
          "</div>"
        : "") +
      '<details class="mobile-toc"><summary>本篇目录</summary>' +
      toc +
      "</details>" +
      (n.lead
        ? '<div class="lead"><b>导读</b>' + para(n.lead) + "</div>"
        : "") +
      (d.editorial
        ? '<div class="edition-note"><b>题名校记</b>' +
          para(d.editorial) +
          (url(d.corroboration)
            ? '<a href="' +
              esc(url(d.corroboration)) +
              '" target="_blank" rel="noopener">查证资料 ↗</a>'
            : "") +
          "</div>"
        : "") +
      (parts.length ? collection(d, index) : "") +
      (ss.length
        ? articleText(d, n)
        : '<section class="read-section" id="points"><h2>文稿重点</h2>' +
          blockList(d.points) +
          refs(d, d.refs) +
          "</section>") +
      '<section id="practice" class="practice-box"><div class="smallhead">' +
      icon("guide") +
      "个人投资应用</div>" +
      para(n.practice || d.use) +
      '</section><section id="edge" class="edge-box"><h2>适用条件与局限</h2>' +
      para(n.edge || d.limit) +
      "</section>" +
      (d.tags?.length
        ? '<div class="tag-line">' +
          d.tags
            .map(
              (t) =>
                '<a href="' +
                esc(library({ q: t })) +
                '">' +
                icon("tag") +
                esc(t) +
                "</a>",
            )
            .join("") +
          "</div>"
        : "") +
      '</article><aside class="toc"><div class="toc-inner"><div class="toc-heading">' +
      icon("book") +
      "本篇目录</div>" +
      toc +
      "</div></aside></div></div>"
    );
  }
  function caseBox(c) {
    if (!c) return "";
    if (typeof c === "string")
      return '<div class="practice-box">' + para(c) + "</div>";
    return (
      '<section class="practice-box"><div class="smallhead">' +
      icon("book") +
      "对照案例</div><h3>" +
      esc(c.title) +
      "</h3>" +
      para(c.text) +
      (c.exercise ? "<h4>动手练习</h4>" + para(c.exercise) : "") +
      "</section>"
    );
  }
  const sheetPrompts = [
    ["目标与日期", "这笔钱用于什么？最早什么时候会用到？"],
    ["研究对象", "谁在付款？一元收入最终有多少能归股东？"],
    [
      "价格与价值",
      "今天的价格是多少？不同情景下的每股价值及最敏感假设是什么？",
    ],
    ["最坏损失", "哪些事会使本金永久受损？家庭或企业会不会被迫变现？"],
    [
      "仓位与替代",
      "最坏损失占组合多少？同一个风险还藏在哪些持仓里？我放弃了哪个可行方案？",
    ],
    ["反证与复盘", "什么事实会改变判断？下一次在什么时候核对哪一份披露？"],
  ];
  function sheet() {
    return (
      '<div class="wrap ordinary guide-read">' +
      crumb([
        ["#/guide", "投资实践手册"],
        ["", "决策记录"],
      ]) +
      '<article class="guide-article worksheet"><div class="smallhead"><i></i>复盘与执行</div><h1>一页投资决策记录</h1><p>在下单前填一份。复盘时保留原答案，另记后来的变化。</p><div class="sheet-fields">' +
      sheetPrompts
        .map(
          ([h, t], i) =>
            "<label><b>" +
            esc(h) +
            "</b><span>" +
            esc(t) +
            '</span><textarea data-journal="' +
            i +
            '" aria-label="' +
            esc(h) +
            '">' +
            esc(getSheet(i)) +
            "</textarea></label>",
        )
        .join("") +
      '</div><div class="edition-note"><b>填写示例（虚构）</b><p>某仓储商租约仍有五年，债务却在两年后到期。先查两年内的可用现金能否覆盖利息、还本和维持性支出，再估租约终值。若必须依赖尚未承诺的续贷，先修改仓位或暂缓决策。</p></div><button class="btn solid trade-actions" data-action="print">打印这张记录</button></article></div>'
    );
  }
  function getSheet(i) {
    try {
      return localStorage.getItem("irr-journal-" + i) || "";
    } catch {
      return "";
    }
  }
  function guidePage(key) {
    if (key === "sheet") return sheet();
    const g = guide.find((a) => a.key === key);
    if (key && !g)
      return (
        '<div class="wrap ordinary">' +
        empty("找不到这个实践问题", "请从实践手册选择问题。") +
        linkArrow("#/guide", "返回实践手册") +
        "</div>"
      );
    if (g) {
      return (
        '<div class="wrap ordinary guide-read">' +
        crumb([
          ["#/guide", "投资实践手册"],
          ["", g.group],
        ]) +
        '<article class="guide-article"><div class="smallhead"><i></i>' +
        esc(g.group) +
        "</div><h1>" +
        esc(g.title) +
        '</h1><div class="lead">' +
        para(g.intro) +
        '</div><h2>可以怎样做</h2><ol class="steps">' +
        arr(g.steps)
          .map((t) => "<li>" + para(t) + "</li>")
          .join("") +
        '</ol><div class="edge-box"><h2>使用边界</h2>' +
        para(g.edge) +
        "</div>" +
        caseBox(g.case || g.example) +
        '<h2>相关文稿</h2><div class="doc-list">' +
        [...new Set([...arr(g.ids), ...arr(g.case?.ids)])]
          .map((id) => byId.get(Number(id)))
          .filter(Boolean)
          .map(resultRow)
          .join("") +
        "</div></article></div>"
      );
    }
    const groups = [...new Set(guide.map((g) => g.group))];
    return (
      '<div class="wrap ordinary handbook">' +
      header(
        "阅读与实践",
        "投资实践手册",
        "从一个具体问题出发，查看可执行的步骤、适用条件和相关文稿。",
      ) +
      '<a class="worksheet-link" href="#/guide/sheet"><span class="tile-ic">' +
      icon("file") +
      "</span><div><b>一页投资决策记录</b><small>填写、保存和打印个人决策记录</small></div>" +
      icon("arrow") +
      "</a>" +
      groups
        .map(
          (k) =>
            '<section class="guide-group"><div class="section-head"><h2>' +
            esc(k) +
            '</h2></div><div class="guide-cards">' +
            guide
              .filter((g) => g.group === k)
              .map(
                (g) =>
                  '<a class="guide-card" href="#/guide/' +
                  encodeURIComponent(g.key) +
                  '"><h3>' +
                  esc(g.title) +
                  "</h3><p>" +
                  esc(g.intro) +
                  "</p><span>" +
                  g.ids.length +
                  " 份相关文稿 " +
                  icon("arrow") +
                  "</span></a>",
              )
              .join("") +
            "</div></section>",
        )
        .join("") +
      "</div>"
    );
  }
  function paint(scroll = true) {
    let { path, q } = getloc(),
      parts = path.split("/").filter(Boolean);
    current = { path, q };
    let n = parts[0] || "home";
    if (n === "read") navSelected("library");
    else navSelected(n);
    let markup =
      n === "home"
        ? home()
        : n === "library"
          ? listPage(q)
          : n === "investors"
            ? investorPage(q)
            : n === "read"
              ? read(byId.get(Number(parts[1])), q)
              : n === "guide"
                ? guidePage(parts[1])
                : '<div class="wrap ordinary">' +
                  empty("页面不存在", "请使用上方导航继续。") +
                  "</div>";
    main.innerHTML = markup;
    document.title =
      (main.querySelector("h1")?.textContent || "阅览室") + " · 投资文稿馆";
    if (scroll) {
      window.scrollTo(0, 0);
      if (n === "read" && q.has("chapter"))
        requestAnimationFrame(() =>
          document.getElementById("collection")?.scrollIntoView(),
        );
    }
  }
  function updateFilters(change, { focus = false } = {}) {
    let { path, q } = getloc();
    for (let [k, v] of Object.entries(change)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    q.delete("page");
    let next = route(path.slice(1), Object.fromEntries(q));
    history.replaceState(null, "", next);
    const active = document.activeElement?.id,
      position = document.activeElement?.selectionStart;
    paint(false);
    if (focus && active) {
      let field = document.getElementById(active);
      field?.focus({ preventScroll: true });
      if (typeof position === "number")
        field?.setSelectionRange(position, position);
    }
  }
  function toast(t) {
    document.querySelector("#toast").textContent = t;
    document.querySelector("#toast").classList.add("shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => document.querySelector("#toast").classList.remove("shown"),
      3200,
    );
  }
  document.querySelector(".skip").addEventListener("click", (e) => {
    e.preventDefault();
    main.focus();
    main.scrollIntoView();
  });
  function launchSearch() {
    if (getloc().path === "/library") {
      document.querySelector("#query")?.focus();
      return;
    }
    location.hash = "/library";
    requestAnimationFrame(() =>
      setTimeout(() => document.querySelector("#query")?.focus(), 30),
    );
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest("button,[data-action]");
    if (!el) return;
    if (el.dataset.jump) {
      document
        .getElementById(el.dataset.jump)
        ?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (el.dataset.save) {
      let id = Number(el.dataset.save);
      bookmarks.has(id) ? bookmarks.delete(id) : bookmarks.add(id);
      try {
        localStorage.setItem("irr-bookmarks", JSON.stringify([...bookmarks]));
      } catch {}
      el.outerHTML = bookmarkButton(byId.get(id));
      toast(bookmarks.has(id) ? "已加入本浏览器书签" : "已移除书签");
      return;
    }
    switch (el.dataset.action) {
      case "print":
        window.print();
        break;
      case "search":
        launchSearch();
        break;
    }
  });
  document.addEventListener("change", (e) => {
    let f = e.target;
    if (f.dataset.filter)
      updateFilters({
        [f.dataset.filter]:
          f.type === "checkbox" ? (f.checked ? "1" : "") : f.value,
      });
    if (f.id === "chapter-select")
      location.hash = readURL(
        getloc().path.split("/")[2],
        Number(f.value),
      ).slice(1);
  });
  document.addEventListener("input", (e) => {
    if (e.target.hasAttribute("data-journal")) {
      try {
        localStorage.setItem(
          "irr-journal-" + e.target.dataset.journal,
          e.target.value,
        );
      } catch {}
      return;
    }
    if (
      (e.target.id === "query" || e.target.id === "person-query") &&
      !e.isComposing
    )
      updateFilters({ q: e.target.value }, { focus: true });
  });
  document.addEventListener("compositionend", (e) => {
    if (e.target.id === "query" || e.target.id === "person-query")
      updateFilters({ q: e.target.value }, { focus: true });
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "/" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)
    ) {
      e.preventDefault();
      launchSearch();
    }
  });
  window.addEventListener("hashchange", () => {
    if (docs.length) paint();
  });
  async function load() {
    try {
      let raw = window.READING_ROOM_DATA;
      if (!raw && location.protocol === "file:") {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "data/offline.js";
          script.onload = resolve;
          script.onerror = () => reject(Error("缺少 data/offline.js，或离线包尚未完整解压。"));
          document.head.append(script);
        });
        raw = window.READING_ROOM_DATA;
        if (!raw) {
          const packed = window.READING_ROOM_GZIP;
          if (typeof packed !== "string") throw Error("离线目录格式有误。");
          if (typeof DecompressionStream === "undefined") {
            throw Error("请使用新版浏览器，或运行 python serve.py 后打开本机阅读器。");
          }
          const bytes = Uint8Array.from(atob(packed), ch => ch.charCodeAt(0));
          const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
          raw = await new Response(stream).json();
          delete window.READING_ROOM_GZIP;
        }
      }
      const values = raw ? [raw.docs || raw.library, raw.guide] :
        await Promise.all(["library", "guide"].map(async name => {
          const response = await fetch("data/" + name + ".json");
          if (!response.ok) throw Error("data/" + name + ".json · " + response.status);
          return response.json();
        }));
      docs = dataArr(values[0], "docs");
      guide = dataArr(values[1], "guide");
      if (!docs.length) throw Error("文稿目录为空。");
      byId = new Map(docs.map((d) => [Number(d.id), d]));
      let bins = new Map();
      for (let d of docs) {
        const n = reading(d);
        if (!bins.has(d.folder))
          bins.set(d.folder, {
            folder: d.folder,
            name: who(d),
            names: new Set(),
            docs: [],
          });
        let g = bins.get(d.folder);
        g.docs.push(d);
        g.names.add(d.person);
        corpus.set(
          Number(d.id),
          norm(
            [
              d.id,
              d.title,
              d.alias,
              d.person,
              d.folder,
              d.org,
              d.date,
              d.kind,
              d.lang,
              ...arr(d.tags),
              ...arr(d.points),
              ...arr(d.use),
              n.lead,
              ...arr(n.sections).flatMap((x) => [x.h, x.text]),
              n.practice,
              n.edge,
              ...arr(d.parts).flatMap(part => {
                 const n = reading(part);
                 return [part.title, n.lead, ...arr(n.sections).flatMap(s => [s.h, s.text]), n.practice, n.edge];
               }),
            ].join(" "),
          ),
        );
      }
      groups = [...bins.values()].sort((a, b) => cmp(a.name, b.name));
      paint();
    } catch (e) {
      main.innerHTML =
        '<div class="wrap ordinary">' +
        empty(
          "文库数据暂未载入",
          "请在项目目录启动本地预览，或使用包含离线数据的完整发行包。",
        ) +
        '<p class="load-error">' +
        esc(e.message) +
        '</p><button class="btn" id="retry">重新载入</button></div>';
      document.querySelector("#retry").onclick = () => location.reload();
    }
  }
  load();
})();
