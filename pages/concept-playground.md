---
layout: page
title: Concept Playground
description: Interactive data engineering concepts you can explore directly in the browser.
permalink: /playground/
nav_order: 20
no_toc: true
wide: true
---

<div class="playground-intro">
  <p class="playground-kicker">Learn by changing the system</p>
  <p>These small, interactive models make data engineering behavior visible. Adjust the inputs, run the operation, and watch the tradeoffs change.</p>
</div>

<div class="playground-search">
  <label class="sr-only" for="playground-filter">Search playgrounds</label>
  <input type="search" id="playground-filter" class="playground-search-input" placeholder="Search playgrounds by name, concept, or engine…" aria-controls="playground-catalog" autocomplete="off">
  <p class="playground-search-empty" id="playground-search-empty" role="status" hidden>No playgrounds match your search.</p>
</div>

<section class="playground-catalog" id="playground-catalog" aria-label="Available concept playgrounds">
  <article class="playground-card">
    <a class="playground-card-visual" href="{{ '/playground/incremental-liquid-clustering/' | relative_url }}" aria-label="Open incremental liquid clustering playground">
      <span class="playground-file-row">
        <span>1–8</span><span>1–8</span><span>1–8</span><span>1–8</span>
      </span>
      <span class="playground-file-row is-incremental">
        <span>1–2</span><span>3–4</span><span>5–6</span><span>7–8</span>
      </span>
    </a>
    <div class="playground-card-body">
      <p class="playground-card-meta"><span class="playground-brands"><svg class="brand-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l-3 5H4z" fill="currentColor" opacity=".5"/><path d="M9 9h8l-3 5H6z" fill="currentColor" opacity=".75"/><path d="M11 15h8l-3 6h-8z" fill="currentColor"/></svg><svg class="brand-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 21 20H3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span>Fabric · Spark · Delta Lake</p>
      <h2><a href="{{ '/playground/incremental-liquid-clustering/' | relative_url }}">Incremental liquid clustering</a></h2>
      <p>Compare full Z-Cube rewrites with Runtime 2.0 incremental selection and auto reclustering.</p>
      <ul class="playground-topics" aria-label="Concepts covered">
        <li>Write amplification</li>
        <li>File skipping</li>
      </ul>
      <a class="playground-launch" href="{{ '/playground/incremental-liquid-clustering/' | relative_url }}">Open playground <span aria-hidden="true">→</span></a>
    </div>
  </article>

  <article class="playground-card">
    <a class="playground-card-visual is-compaction" href="{{ '/playground/auto-compaction/' | relative_url }}" aria-label="Open auto compaction playground">
      <span class="playground-small-files">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </span>
      <span class="playground-transform" aria-hidden="true">↓</span>
      <span class="playground-large-files">
        <span></span><span></span>
      </span>
    </a>
    <div class="playground-card-body">
      <p class="playground-card-meta"><span class="playground-brands"><svg class="brand-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 21 20H3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span>Spark · Delta Lake</p>
      <h2><a href="{{ '/playground/auto-compaction/' | relative_url }}">Auto compaction</a></h2>
      <p>See when a successful write synchronously combines small files and how thresholds affect rewrite cost.</p>
      <ul class="playground-topics" aria-label="Concepts covered">
        <li>Small files</li>
        <li>Target file size</li>
      </ul>
      <a class="playground-launch" href="{{ '/playground/auto-compaction/' | relative_url }}">Open playground <span aria-hidden="true">→</span></a>
    </div>
  </article>

  <article class="playground-card">
    <a class="playground-card-visual is-deletion-vectors" href="{{ '/playground/deletion-vectors/' | relative_url }}" aria-label="Open deletion vectors playground">
      <span class="playground-row-file">
        <span></span><span class="is-deleted"></span><span></span><span class="is-deleted"></span><span></span>
      </span>
      <span class="playground-bitmap" aria-label="Deletion bitmap">0 1 0 1 0</span>
    </a>
    <div class="playground-card-body">
      <p class="playground-card-meta"><span class="playground-brands"><svg class="brand-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 21 20H3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span>Spark · Delta Lake</p>
      <h2><a href="{{ '/playground/deletion-vectors/' | relative_url }}">Deletion vectors</a></h2>
      <p>Compare logical row deletion with immediate file rewrites, then compact and vacuum obsolete data.</p>
      <ul class="playground-topics" aria-label="Concepts covered">
        <li>Row-level changes</li>
        <li>OPTIMIZE</li>
      </ul>
      <a class="playground-launch" href="{{ '/playground/deletion-vectors/' | relative_url }}">Open playground <span aria-hidden="true">→</span></a>
    </div>
  </article>
</section>
