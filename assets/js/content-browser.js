(function (root) {
  "use strict";

  function whitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return whitespace(value).toLowerCase()
      .replace(/\bmicrosoft\s+fabric\b/g, "fabric")
      .replace(/\bazure\s+databricks\b/g, "databricks")
      .replace(/\bdelta\s*lake\b/g, "delta lake");
  }

  function validValues(values, knownValues) {
    const known = new Set(knownValues);
    return Array.from(new Set(values)).filter(function (value) {
      return known.has(value);
    });
  }

  function parseState(search, knownTracks, knownTags) {
    const params = new URLSearchParams(search);
    return {
      tracks: validValues(params.getAll("track"), knownTracks),
      tags: validValues(params.getAll("tag"), knownTags),
      q: whitespace(params.get("q"))
    };
  }

  function stateURL(base, state, knownTracks, knownTags) {
    const url = new URL(base);
    url.searchParams.delete("track");
    url.searchParams.delete("tag");
    url.searchParams.delete("q");
    validValues(state.tracks, knownTracks).forEach(function (track) {
      url.searchParams.append("track", track);
    });
    validValues(state.tags, knownTags).forEach(function (tag) {
      url.searchParams.append("tag", tag);
    });
    const query = whitespace(state.q);
    if (query) url.searchParams.set("q", query);
    return url;
  }

  function matches(article, state) {
    const trackMatch = state.tracks.length === 0 || state.tracks.some(function (track) {
      return article.tracks.includes(track);
    });
    const tagMatch = state.tags.length === 0 || state.tags.some(function (tag) {
      return article.tagIds.includes(tag);
    });
    const text = normalize([article.title, article.summary, (article.tags || []).join(" "), article.tracks.join(" ")].join(" "));
    const query = normalize(state.q);
    return trackMatch && tagMatch && (!query || query.split(" ").every(function (word) {
      return text.includes(word);
    }));
  }

  function filterArticles(articles, state) {
    return articles.filter(function (article) { return matches(article, state); });
  }

  function tagCounts(articles, state, knownTags) {
    return knownTags.map(function (tag) {
      return filterArticles(articles, {
        tracks: state.tracks,
        tags: [tag],
        q: state.q
      }).length;
    });
  }

  function init(browser, win) {
    const form = browser.querySelector("[data-article-filters]");
    const query = form.querySelector('[name="q"]');
    const checkboxes = Array.from(form.querySelectorAll('[name="track"]'));
    const knownTracks = checkboxes.map(function (input) { return input.value; });
    const tagOptions = Array.from(form.querySelectorAll("[data-tag-option]"));
    const knownTags = tagOptions.map(function (option) { return option.value; });
    const tagCountLabels = Array.from(form.querySelectorAll("[data-tag-count]"));
    const filterPanel = browser.querySelector("[data-filter-panel]");
    const filterSidebar = browser.querySelector("[data-filter-sidebar]");
    const narrowScreen = win.matchMedia("(max-width: 1100px)");
    let currentState;
    const count = browser.querySelector("[data-article-count]");
    const empty = browser.querySelector("[data-article-empty]");
    const articles = Array.from(browser.querySelectorAll("[data-article]")).map(function (element) {
      return {
        element: element,
        tracks: whitespace(element.dataset.tracks).split(" ").filter(Boolean),
        tagIds: whitespace(element.dataset.tagIds).split(" ").filter(Boolean),
        title: element.dataset.title,
        summary: element.dataset.summary,
        tags: [element.dataset.tags]
      };
    });

    function render(state) {
      currentState = state;
      query.value = state.q;
      checkboxes.forEach(function (input) { input.checked = state.tracks.includes(input.value); });
      const counts = tagCounts(articles, state, knownTags);
      tagOptions.forEach(function (option, index) {
        option.setAttribute("aria-pressed", String(state.tags.includes(option.value)));
        option.hidden = counts[index] === 0;
      });
      tagCountLabels.forEach(function (label, index) { label.textContent = "(" + counts[index] + ")"; });
      const visible = new Set(filterArticles(articles, state));
      articles.forEach(function (article) { article.element.hidden = !visible.has(article); });
      count.textContent = visible.size + " of " + articles.length + " articles";
      empty.hidden = visible.size !== 0;
    }

    function update(state) {
      const url = stateURL(win.location.href, state, knownTracks, knownTags);
      if (url.href !== win.location.href) {
        win.history.pushState(null, "", url.pathname + url.search + url.hash);
      }
      render(state);
    }

    tagOptions.forEach(function (option) {
      option.addEventListener("click", function () {
        const tags = currentState.tags.includes(option.value)
          ? currentState.tags.filter(function (tag) { return tag !== option.value; })
          : currentState.tags.concat(option.value);
        update({ tracks: currentState.tracks, tags: tags, q: currentState.q });
      });
    });

    form.addEventListener("input", function (event) {
      if (event.target !== query && !checkboxes.includes(event.target)) return;
      update({
        tracks: checkboxes.filter(function (input) { return input.checked; }).map(function (input) { return input.value; }),
        tags: currentState.tags,
        q: query.value
      });
    });
    form.addEventListener("submit", function (event) { event.preventDefault(); });
    form.addEventListener("reset", function (event) {
      event.preventDefault();
      update({ tracks: [], tags: [], q: "" });
    });
    win.addEventListener("popstate", function () {
      render(parseState(win.location.search, knownTracks, knownTags));
    });
    const initialState = parseState(win.location.search, knownTracks, knownTags);
    render(initialState);
    filterPanel.open = !narrowScreen.matches;
    narrowScreen.addEventListener("change", function (event) {
      filterPanel.open = !event.matches;
    });
    browser.classList.add("has-article-filters");
    filterSidebar.hidden = false;
    form.hidden = false;
  }

  const api = { normalize: normalize, parseState: parseState, stateURL: stateURL, matches: matches, filterArticles: filterArticles, tagCounts: tagCounts, init: init };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root.document) {
    root.document.querySelectorAll("[data-content-browser]").forEach(function (browser) {
      init(browser, root);
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
