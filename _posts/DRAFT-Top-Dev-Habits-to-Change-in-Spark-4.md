---
layout: post
title: "The Top Data Engineering Habits to Ditch in 2026"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-25626517.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-25626517.jpeg"
published: False
---

The post is a collection of top habits in 2026 that I see customers and people in the community get stuck on. The alternative thing you should be doing as a DE isn't always a new feature, sometimes it just takes time for new features and ways of doing things to propogate in the community.

> Note: for those that know me, I'm very opinionated. I also have no problem admitting that I've been wrong about something. The following list is very opinionated, possibly wrong in some cases, but also well founded on both my own experience and challenges I've helped customers through when running Spark at scale. If you disagree, reach out, message me on LinkedIn. _If you agree_, do me a favor and help share this information in your respective circles.

1. Stop building complex systems to manage state
1. Partitioning vs. Liquid Clusting
1. We can do better than manually scheduled table maintenance
1. Adopt Identity columns over building surrogate keys
1. Notebooks are not everything. Do you really need to ship in IDE with your production code?
1. Start using DataFrameWriterV2 -> less verbose, avoid overloading statements
1. Real-Time Mode for Kafka/Eventhub sinks
1. Writing single use data pipelines
1. Stop speaking in bronze, silver, gold
1. Tuning configs without A/B testing
1. df.mergeInto()
