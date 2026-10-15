---
layout: page
title: Feature Simulators
nav_title: Simulators
description: Interactive models of Spark, Delta Lake, and platform-specific behavior.
permalink: /playground/
nav_order: 20
no_toc: true
wide: true
---

<div class="playground-intro">
  <p class="playground-kicker">Interactive models of Spark, Delta Lake, and platform-specific behavior.</p>
  <p>Adjust the inputs, run the operation, and watch what happens under the hood or on disk.</p>
</div>

<div class="playground-search">
  <label class="sr-only" for="playground-filter">Search simulators</label>
  <input type="search" id="playground-filter" class="playground-search-input" placeholder="Search simulators by name, concept, or engine…" aria-controls="playground-catalog" autocomplete="off">
  <p class="playground-search-empty" id="playground-search-empty" role="status" hidden>No simulators match your search.</p>
</div>

<section class="playground-catalog" id="playground-catalog" aria-label="Available feature simulators">
  <article class="playground-card">
    <span class="playground-card-visual is-shuffle" aria-hidden="true">
      <span class="playground-shuffle-row is-many">
        <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
      </span>
      <span class="playground-transform" aria-hidden="true">⇣</span>
      <span class="playground-shuffle-row is-coalesced">
        <span></span><span></span><span></span><span></span>
      </span>
    </span>
    <div class="playground-card-body">
      {% include technology_marks.liquid technologies="spark,databricks,fabric" %}
      <p class="playground-card-meta">Apache Spark · AQE</p>
      <h2><a href="{{ '/playground/spark-shuffle-partitions/' | relative_url }}">Spark shuffle partitions</a></h2>
      <p>Compare fixed reduce tasks with AQE coalescing and see why skew and oversized partitions still matter.</p>
      <ul class="playground-topics" aria-label="Concepts covered">
        <li>Shuffle sizing</li>
        <li>Adaptive execution</li>
      </ul>
      <div class="playground-card-actions">
        <a class="playground-open" href="{{ '/playground/spark-shuffle-partitions/' | relative_url }}">Open simulator <span aria-hidden="true">→</span></a>
      </div>
    </div>
  </article>

  <article class="playground-card">
    <span class="playground-card-visual" aria-hidden="true">
      <span class="playground-file-row">
        <span>1–8</span><span>1–8</span><span>1–8</span><span>1–8</span>
      </span>
      <span class="playground-file-row is-incremental">
        <span>1–2</span><span>3–4</span><span>5–6</span><span>7–8</span>
      </span>
    </span>
    <div class="playground-card-body">
      {% include technology_marks.liquid technologies="delta,fabric" %}
      <p class="playground-card-meta">Fabric · Spark · Delta Lake</p>
      <h2><a href="{{ '/playground/incremental-liquid-clustering/' | relative_url }}">Incremental liquid clustering</a></h2>
      <p>Compare full Z-Cube rewrites with Runtime 2.0 incremental selection and auto reclustering.</p>
      <ul class="playground-topics" aria-label="Concepts covered">
        <li>Write amplification</li>
        <li>File skipping</li>
      </ul>
      <div class="playground-card-actions">
        <a class="playground-open" href="{{ '/playground/incremental-liquid-clustering/' | relative_url }}">Open simulator <span aria-hidden="true">→</span></a>
        <a class="playground-article" href="{{ '/data-engineering/2026/07/24/Incremental-Liquid-Clustering-Fabric-Runtime-2.html' | relative_url }}">Read the blog</a>
      </div>
    </div>
  </article>

  <article class="playground-card">
    <span class="playground-card-visual is-compaction" aria-hidden="true">
      <span class="playground-small-files">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </span>
      <span class="playground-transform" aria-hidden="true">↓</span>
      <span class="playground-large-files">
        <span></span><span></span>
      </span>
    </span>
    <div class="playground-card-body">
      {% include technology_marks.liquid technologies="delta,databricks,fabric" %}
      <p class="playground-card-meta">Delta Lake · Table Maintenance</p>
      <h2><a href="{{ '/playground/auto-compaction/' | relative_url }}">Auto compaction</a></h2>
      <p>See when a successful write synchronously combines small files and how thresholds affect rewrite cost.</p>
      <ul class="playground-topics" aria-label="Concepts covered">
        <li>Compaction</li>
        <li>Small files</li>
      </ul>
      <div class="playground-card-actions">
        <a class="playground-open" href="{{ '/playground/auto-compaction/' | relative_url }}">Open simulator <span aria-hidden="true">→</span></a>
        <a class="playground-article" href="{{ '/data-engineering/2025/02/26/The-Art-and-Science-of-Table-Compaction.html' | relative_url }}">Read the blog</a>
      </div>
    </div>
  </article>

  <article class="playground-card">
    <span class="playground-card-visual is-deletion-vectors" aria-hidden="true">
      <span class="playground-row-file">
        <span></span><span class="is-deleted"></span><span></span><span class="is-deleted"></span><span></span>
      </span>
      <span class="playground-bitmap" aria-label="Deletion bitmap">0 1 0 1 0</span>
    </span>
    <div class="playground-card-body">
      {% include technology_marks.liquid technologies="delta,databricks,fabric" %}
      <p class="playground-card-meta">Spark · Delta Lake</p>
      <h2><a href="{{ '/playground/deletion-vectors/' | relative_url }}">Deletion vectors</a></h2>
      <p>See how deletion vectors minimize write aplification on top of immutable parquet files.</p>
      <ul class="playground-topics" aria-label="Concepts covered">
        <li>Write amplification</li>
        <li>Logical deletes</li>
      </ul>
      <div class="playground-card-actions">
        <a class="playground-open" href="{{ '/playground/deletion-vectors/' | relative_url }}">Open simulator <span aria-hidden="true">→</span></a>
        <a class="playground-article" href="{{ '/data-engineering/2024/11/04/Deletion-Vectors.html' | relative_url }}">Read the blog</a>
      </div>
    </div>
  </article>
</section>
