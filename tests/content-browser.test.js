"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalize, parseState, stateURL, filterArticles, tagCounts, init } = require("../assets/js/content-browser.js");
const known = ["oss", "fabric", "databricks", "azure-other"];
const knownTags = ["spark", "delta-lake", "compaction", "configuration", "data-governance"];
const articles = [
  { title: "DeltaLake maintenance", summary: "Reusable compaction", tags: ["Apache Spark", "Delta Lake", "Compaction"], tagIds: ["spark", "delta-lake", "compaction"], tracks: ["oss", "fabric"] },
  { title: "Capacity tuning", summary: "Resources", tags: ["Configuration"], tagIds: ["configuration"], tracks: ["fabric"] },
  { title: "Governance", summary: "Azure Databricks permissions", tags: ["Data Governance"], tagIds: ["data-governance"], tracks: ["databricks"] },
  { title: "Azure SQL", summary: "Identity provisioning", tags: [], tagIds: [], tracks: ["azure-other"] }
];

test("track selections are OR, with overlapping articles returned once in source order", function () {
  assert.deepEqual(filterArticles(articles, { tracks: ["oss", "fabric"], tags: [], q: "" }), articles.slice(0, 2));
  assert.deepEqual(filterArticles(articles, { tracks: ["oss"], tags: [], q: "" }), [articles[0]]);
  assert.deepEqual(filterArticles(articles, { tracks: ["fabric", "databricks"], tags: [], q: "" }), articles.slice(0, 3));
});

test("all normalized keyword words intersect the track result across title, summary, and tags", function () {
  assert.deepEqual(filterArticles(articles, { tracks: ["oss", "fabric"], tags: [], q: "  DELTA  lake\nSpark\tcompaction " }), [articles[0]]);
  assert.deepEqual(filterArticles(articles, { tracks: ["oss"], tags: [], q: "capacity" }), []);
  assert.deepEqual(filterArticles(articles, { tracks: ["fabric"], tags: [], q: "no match" }), []);
});

test("platform searches still work without platform tags, and Delta Lake aliases normalize", function () {
  assert.equal(normalize(" MICROSOFT  FABRIC Azure\tDatabricks DeltaLake "), "fabric databricks delta lake");
  assert.deepEqual(filterArticles(articles, { tracks: [], tags: [], q: "Microsoft Fabric" }), articles.slice(0, 2));
  assert.deepEqual(filterArticles(articles, { tracks: [], tags: [], q: "Databricks" }), [articles[2]]);
  assert.deepEqual(filterArticles(articles, { tracks: [], tags: [], q: "Azure Databricks" }), [articles[2]]);
  assert.deepEqual(filterArticles(articles, { tracks: [], tags: [], q: "Delta Lake" }), [articles[0]]);
});

test("missing, unknown, empty, and duplicate track/tag IDs have predictable defaults", function () {
  assert.deepEqual(parseState("", known, knownTags), { tracks: [], tags: [], q: "" });
  assert.deepEqual(parseState("?track=missing&track=&tag=missing&tag=&q=%20%20", known, knownTags), { tracks: [], tags: [], q: "" });
  assert.deepEqual(parseState("?track=fabric&track=oss&track=fabric&track=nope&tag=spark&tag=spark&tag=delta-lake&tag=nope&q=Spark%0A+SQL", known, knownTags), { tracks: ["fabric", "oss"], tags: ["spark", "delta-lake"], q: "Spark SQL" });
  assert.deepEqual(filterArticles(articles, parseState("?track=unknown&tag=unknown", known, knownTags)), articles);
});

test("URL encoding round-trips reserved characters, Unicode, tracks, and tags", function () {
  const state = { tracks: ["fabric", "oss", "fabric", "unknown"], tags: ["delta-lake", "compaction", "delta-lake", "unknown"], q: "  R&D + C# / café?  " };
  const url = stateURL("https://example.test/articles/?track=databricks&tag=configuration&q=old&other=keep#list", state, known, knownTags);
  assert.equal(url.pathname, "/articles/");
  assert.equal(url.searchParams.get("other"), "keep");
  assert.equal(url.hash, "#list");
  assert.deepEqual(parseState(url.search, known, knownTags), { tracks: ["fabric", "oss"], tags: ["delta-lake", "compaction"], q: "R&D + C# / café?" });
  assert.match(url.search, /%26/);
  assert.match(url.search, /%2B/);
  assert.match(url.search, /%23/);
});

test("reset removes archive state and an unfiltered query returns every article", function () {
  const url = stateURL("https://example.test/articles/?track=fabric&tag=spark&q=Spark", { tracks: [], tags: [], q: "" }, known, knownTags);
  assert.equal(url.href, "https://example.test/articles/");
  assert.deepEqual(filterArticles(articles, { tracks: [], tags: [], q: "\n\t " }), articles);
});

test("tags use exact IDs and OR matching, intersecting OR tracks and keywords", function () {
  assert.deepEqual(filterArticles(articles, { tracks: ["fabric", "databricks"], tags: ["delta-lake", "compaction"], q: "Spark" }), [articles[0]]);
  assert.deepEqual(filterArticles(articles, { tracks: ["databricks"], tags: ["compaction"], q: "" }), []);
  assert.deepEqual(filterArticles(articles, { tracks: [], tags: ["compaction", "configuration"], q: "" }), articles.slice(0, 2));
  assert.deepEqual(filterArticles(articles, { tracks: ["databricks"], tags: ["compaction", "data-governance"], q: "" }), [articles[2]]);
  assert.deepEqual(filterArticles(articles, { tracks: ["fabric"], tags: ["compaction", "configuration"], q: "capacity" }), [articles[1]]);
  assert.deepEqual(filterArticles(articles, { tracks: [], tags: ["delta"], q: "" }), []);
});

test("tag counts reflect individual tags within selected tracks and keywords", function () {
  assert.deepEqual(tagCounts(articles, { tracks: [], tags: [], q: "" }, knownTags), [1, 1, 1, 1, 1]);
  assert.deepEqual(tagCounts(articles, { tracks: ["fabric"], tags: ["delta-lake"], q: "" }, knownTags), [1, 1, 1, 1, 0]);
  assert.deepEqual(tagCounts(articles, { tracks: ["fabric", "databricks"], tags: ["compaction"], q: "governance" }, knownTags), [0, 0, 0, 0, 1]);
  assert.deepEqual(tagCounts(articles, { tracks: [], tags: ["compaction"], q: "no match" }, knownTags), [0, 0, 0, 0, 0]);
});

function fixture(search, narrow) {
  const handlers = {};
  function element() {
    return {
      value: "", dataset: {}, hidden: false, attributes: {}, handlers: {},
      setAttribute: function (name, value) { this.attributes[name] = value; },
      getAttribute: function (name) { return this.attributes[name]; },
      addEventListener: function (type, handler) { this.handlers[type] = handler; }
    };
  }
  const inputs = known.map(function (value) { return { value: value, checked: false }; });
  const query = element();
  const tagOptions = knownTags.map(function (value) {
    const option = element();
    option.value = value;
    option.id = "tag-" + value;
    option.dataset.label = value;
    return option;
  });
  const tagCountLabels = knownTags.map(function () { return {}; });
  const filterPanel = { open: true };
  const filterSidebar = { hidden: true };
  const narrowScreen = { matches: Boolean(narrow), addEventListener: function (type, handler) { handlers["media:" + type] = handler; } };
  const form = {
    hidden: true,
    querySelector: function (selector) {
      return { '[name="q"]': query }[selector];
    },
    querySelectorAll: function (selector) {
      return { '[name="track"]': inputs, "[data-tag-option]": tagOptions, "[data-tag-count]": tagCountLabels }[selector];
    },
    addEventListener: function (type, handler) { handlers["form:" + type] = handler; }
  };
  const elements = articles.map(function (article) {
    return { hidden: false, dataset: { title: article.title, summary: article.summary, tags: article.tags.join(" "), tagIds: article.tagIds.join(" "), tracks: article.tracks.join(" ") } };
  });
  const count = {};
  const empty = { hidden: true };
  const browser = {
    classList: { add: function () {} },
    querySelector: function (selector) {
      return { "[data-article-filters]": form, "[data-article-count]": count, "[data-article-empty]": empty, "[data-filter-panel]": filterPanel, "[data-filter-sidebar]": filterSidebar }[selector];
    },
    querySelectorAll: function () { return elements; }
  };
  const win = {
    location: new URL("https://example.test/articles/" + search),
    matchMedia: function () { return narrowScreen; },
    history: { pushState: function (_, __, url) { win.location = new URL(url, win.location); } },
    addEventListener: function (type, handler) { handlers[type] = handler; }
  };
  init(browser, win);
  return { form, inputs, tagOptions, tagCountLabels, filterPanel, filterSidebar, query, elements, count, empty, win, handlers };
}

test("initial deep links and popstate synchronize controls, visibility, empty state, and count", function () {
  const page = fixture("?track=oss&tag=compaction&q=delta");
  assert.equal(page.form.hidden, false);
  assert.equal(page.inputs[0].checked, true);
  assert.deepEqual(page.tagOptions.map(function (option) { return option.getAttribute("aria-pressed"); }), ["false", "false", "true", "false", "false"]);
  assert.equal(page.count.textContent, "1 of 4 articles");
  assert.deepEqual(page.elements.map(function (element) { return element.hidden; }), [false, true, true, true]);
  page.win.location = new URL("https://example.test/articles/?track=databricks&q=unknown");
  page.handlers.popstate();
  assert.equal(page.query.value, "unknown");
  assert.equal(page.inputs[0].checked, false);
  assert.equal(page.inputs[2].checked, true);
  assert.ok(page.tagOptions.every(function (option) { return option.getAttribute("aria-pressed") === "false"; }));
  assert.equal(page.empty.hidden, false);
  assert.equal(page.count.textContent, "0 of 4 articles");
  page.win.location = new URL("https://example.test/articles/");
  page.handlers.popstate();
  assert.equal(page.count.textContent, "4 of 4 articles");
  assert.equal(page.empty.hidden, true);
  assert.ok(page.elements.every(function (element) { return !element.hidden; }));
});

test("input changes persist encoded state, and reset clears controls and restores all links", function () {
  const page = fixture("");
  page.tagOptions[0].handlers.click();
  page.inputs[1].checked = true;
  page.query.value = "R&D + café";
  page.handlers["form:input"]({ target: page.query });
  assert.deepEqual(parseState(page.win.location.search, known, knownTags), { tracks: ["fabric"], tags: ["spark"], q: "R&D + café" });
  let prevented = false;
  page.handlers["form:reset"]({ preventDefault: function () { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(page.win.location.search, "");
  assert.equal(page.query.value, "");
  assert.ok(page.inputs.every(function (input) { return !input.checked; }));
  assert.ok(page.tagOptions.every(function (option) { return option.getAttribute("aria-pressed") === "false"; }));
  assert.ok(page.elements.every(function (element) { return !element.hidden; }));
});

test("tag pills toggle selections in place and synchronize counts and browser history", function () {
  const page = fixture("");
  page.tagOptions[2].handlers.click();
  assert.equal(page.win.location.search, "?tag=compaction");
  assert.equal(page.count.textContent, "1 of 4 articles");
  assert.equal(page.tagOptions[2].getAttribute("aria-pressed"), "true");
  assert.ok(page.tagOptions.every(function (option) { return !option.hidden; }));
  assert.equal(page.tagCountLabels[3].textContent, "(1)");
  page.tagOptions[2].handlers.click();
  assert.equal(page.win.location.search, "");
  assert.equal(page.count.textContent, "4 of 4 articles");
  assert.equal(page.tagOptions[2].getAttribute("aria-pressed"), "false");
  page.win.location = new URL("https://example.test/articles/?tag=configuration");
  page.handlers.popstate();
  assert.equal(page.tagOptions[3].getAttribute("aria-pressed"), "true");
  assert.deepEqual(page.elements.map(function (element) { return element.hidden; }), [true, false, true, true]);
});

test("multiple tag pills broaden results while respecting track and keyword filters", function () {
  const page = fixture("?track=fabric&tag=compaction");
  page.tagOptions[3].handlers.click();
  assert.equal(page.count.textContent, "2 of 4 articles");
  assert.deepEqual(parseState(page.win.location.search, known, knownTags), { tracks: ["fabric"], tags: ["compaction", "configuration"], q: "" });
  page.query.value = "delta";
  page.handlers["form:input"]({ target: page.query });
  assert.equal(page.count.textContent, "1 of 4 articles");
  page.tagOptions[2].handlers.click();
  assert.equal(page.count.textContent, "0 of 4 articles");
  assert.equal(page.empty.hidden, false);
  assert.deepEqual(page.tagOptions.map(function (option) { return option.hidden; }), [false, false, false, true, true]);
  page.tagOptions[2].handlers.click();
  assert.equal(page.count.textContent, "1 of 4 articles");
  page.query.value = "";
  page.handlers["form:input"]({ target: page.query });
  page.tagOptions[3].handlers.click();
  assert.equal(page.count.textContent, "1 of 4 articles");
  assert.equal(page.tagOptions[2].getAttribute("aria-pressed"), "true");
  assert.equal(page.tagOptions[3].getAttribute("aria-pressed"), "false");
});

test("zero-result pills hide, reappear as filters change, and synchronize with reset and history", function () {
  const page = fixture("?track=fabric&tag=data-governance");
  assert.equal(page.tagOptions[4].hidden, true);
  assert.equal(page.tagOptions[4].getAttribute("aria-pressed"), "true");
  assert.equal(page.tagOptions[0].hidden, false);
  page.inputs[1].checked = false;
  page.handlers["form:input"]({ target: page.inputs[1] });
  assert.equal(page.tagOptions[4].hidden, false);
  assert.equal(page.tagOptions[4].getAttribute("aria-pressed"), "true");
  assert.equal(page.count.textContent, "1 of 4 articles");
  page.query.value = "no match";
  page.handlers["form:input"]({ target: page.query });
  assert.ok(page.tagOptions.every(function (option) { return option.hidden; }));
  page.handlers["form:reset"]({ preventDefault: function () {} });
  assert.ok(page.tagOptions.every(function (option) { return !option.hidden; }));
  page.win.location = new URL("https://example.test/articles/?track=fabric&tag=data-governance");
  page.handlers.popstate();
  assert.equal(page.tagOptions[4].hidden, true);
  assert.equal(page.tagOptions[4].getAttribute("aria-pressed"), "true");
});

test("mobile filter panel starts collapsed and follows viewport changes without losing filters", function () {
  const page = fixture("?tag=compaction", true);
  assert.equal(page.filterSidebar.hidden, false);
  assert.equal(page.filterPanel.open, false);
  page.handlers["media:change"]({ matches: false });
  assert.equal(page.filterPanel.open, true);
  assert.equal(page.win.location.search, "?tag=compaction");
  page.handlers["media:change"]({ matches: true });
  assert.equal(page.filterPanel.open, false);
  assert.equal(page.tagOptions[2].getAttribute("aria-pressed"), "true");
});
