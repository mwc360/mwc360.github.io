---
layout: page
title: Articles
permalink: /articles/
content_browser: true
wide: true
no_toc: true
hide_title: true
---
<div class="content-browser" data-content-browser>
  <h1 class="sr-only">Articles</h1>
  <div class="article-browser-layout">
  <aside class="article-filter-sidebar" data-filter-sidebar hidden aria-label="Article filters">
  <details class="article-filter-panel" data-filter-panel open>
  <summary>Search &amp; filters</summary>
  <form class="article-filters" data-article-filters hidden role="search" aria-label="Filter articles">
    <label for="article-query">Search articles</label>
    <input id="article-query" name="q" type="search" placeholder="Search keywords..." autocomplete="off" aria-describedby="article-filter-help">
    <fieldset class="article-track-filters">
      <legend>Content tracks</legend>
      <div class="article-track-options">
        {% for item in site.data.content_tracks %}
        <label class="article-track-option" title="{{ item[1].description | escape }}">
          <input type="checkbox" name="track" value="{{ item[0] | escape }}">
          <span>{{ item[1].label | escape }}</span>
        </label>
        {% endfor %}
      </div>
    </fieldset>
    <fieldset class="article-tag-filters" aria-describedby="article-filter-help">
      <legend>Tags</legend>
      <div class="article-tag-options">
        {% for tag in site.data.article_tags %}
        {% assign tagged_posts = site.posts | where_exp: "post", "post.tags contains tag.label" %}
        <button type="button" class="article-tag-option" aria-pressed="false" data-tag-option value="{{ tag.id | escape }}" data-label="{{ tag.label | escape }}" title="{{ tag.description | escape }}">
          <span>{{ tag.label | escape }}</span>
          <span data-tag-count>({{ tagged_posts.size }})</span>
        </button>
        {% endfor %}
      </div>
    </fieldset>
    <p id="article-filter-help">Any track; any tag.</p>
    <button type="reset">Reset filters</button>
  </form>
  </details>
  </aside>
  <section class="article-results" aria-label="Articles">
  <noscript><p>Filtering requires JavaScript. All articles are listed below; use your browser’s Find command or follow an article link.</p></noscript>
  <p class="article-result-count" data-article-count role="status" aria-live="polite" aria-atomic="true">{{ site.posts.size }} articles</p>
  <p data-article-empty hidden>No articles match these filters. Try fewer keywords or use All articles / reset.</p>
  <div class="posts article-archive">
    {% assign archive_posts = site.posts | sort: 'date' | reverse %}
    {% for post in archive_posts %}
      {% include blog/article_card.liquid post=post filterable=true %}
    {% endfor %}
  </div>
  </section>
  </div>
</div>
