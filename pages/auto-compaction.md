---
layout: page
title: Auto compaction
description: Compare identical INSERT INTO commits across Delta tables using auto compaction or manual OPTIMIZE.
permalink: /playground/auto-compaction/
hide: true
hide_title: true
---

This model illustrates Delta Lake auto compaction in Spark, using Fabric defaults for the small-file threshold and file-size relationship. Its latency formulas are illustrative, not measurements or a guarantee of identical behavior across platforms.

{% include interactive.html src="/assets/playgrounds/auto-compaction.html?embedded=1&context=1" open_src="/assets/playgrounds/auto-compaction.html" title="Auto compaction simulator" height="1200" class="playground-embed" %}
