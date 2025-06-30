---
layout: post
title: "Small Data Madness 2025: Is it Time to Ditch Spark Yet??"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/posts/Small-Data-Benchmark-2025/engine-showdown.png"
thumbnail: "assets/img/posts/Small-Data-Benchmark-2025/engine-showdown.png"
published: True
---
Last December (2024) I published a blog seeking to explore the question of whether data engineers in Microsoft Fabric [should ditch Spark for DuckDb or Polars](https://milescole.dev/data-engineering/2024/12/12/Should-You-Ditch-Spark-DuckDB-Polars.html). Six months have passed and all engines have gotten more mature. Where do things stand? **Is it finally time to ditch Spark?** Let the _Small Data Madness 2025_ begin!

# Goals of This Post
First, let's revisit the purpose of the benchmark: _The objective is to explore data engineering engines available in Fabric to understand whether Spark with vectorized execution (the Native Execution Engine) should be considered in small data architectures._

Beyond refreshing the benchmark to see if any core findings have changed, I do want to expand in a few areas where I got great feedback from the community:
1. **Framework Transparency**: While I didn't publish the benchmark code last time, it is now available as part of the beta version of my **LakeBench** Python library. You can find it on [GitHub](https://github.com/mwc360/LakeBench) and [PyPi](https://pypi.org/project/lakebench/). This blog leverages the `ELTBench` benchmark run in `light` mode. Hopefully, this will help provide additional trust, enable reproducing benchmarks, or at least allow folks to give me tips for how to improve the methodology. If there's anything you'd do differently for one of the engines, just raise an Issue, or better yet, submit a PR! 

1. **Additional Engines**: While I by no means plan to benchmark the gamut of OSS engines, I did get common asks to include Daft and Databricks Photon in the benchmark. I've elected to include Daft this time. I am not including Photon as it doesn't fit the intent of this study: _to explore engines available in Fabric for small data workloads_.

## Benchmark Methodology
If you haven't already read my initial blog comparing these engines, I'd recommend [reading it](https://milescole.dev/data-engineering/2024/12/12/Should-You-Ditch-Spark-DuckDB-Polars.html) first. I've made a few minor adjustments to the benchmarking methodology this time:
1. To provide better clarity in terms of the scale of data where small engines become definitively faster than Spark, I'm now referencing the size of compressed data rather than the TPC-DS scale factor used. This is particularly important as my benchmark only uses a subset of the TPC-DS tables. The scale factor-to-size mapping (for my lightweight benchmark) is below:

    | TPC-DS Scale Factor   | Compressed Size _(store_sales, customer, dim_date, item, store)_ | Largest Table Row Count (store_sales) |
    | --------------------- | ---------------------------------------------------------------- | ------------------------------------- |
    | 1GB                   | **140MB**                                                        | 2,879,789                             |
    | 10GB                  | **1.2GB**                                                        | 28,800,501                            |
    | 100GB                 | **12.7GB**                                                       | 288,006,388                           |

    As seen above, this differentiation is critical as the size of compressed data processed is about 8x smaller than the scale factor size.

1. I switched the order of the `VACUUM` and `OPTIMIZE` phases. Given the intent of running `VACUUM` was to measure the efficiency of vacuuming files, it made more sense to do so after `OPTIMIZE` generates yet additional files that could be cleaned.
1. Maintenance jobs, `VACUUM` and `OPTIMIZE`, are included in the detailed phase analysis but excluded from the cumulative execution time for each benchmark scale. There are two reasons for this change:
    - Spark is the only engine that implements its own native `VACUUM` and `OPTIMIZE` command. All of the other single-node engines don't, and therefore the Delta-rs Python library is used, which results in the difference of execution time between single-machine engines largely being noise. Delta-rs is significantly more efficient at running `VACUUM`. If not using Deletion Vectors in Spark, you can also benefit from the same performance.
    - Maintenance jobs are typically not executed with proportional frequency as present in this 6-phased benchmark. In Spark, I recommend using [Auto Compaction](https://milescole.dev/data-engineering/2025/02/26/The-Art-and-Science-of-Table-Compaction.html) to programmatically have compaction run only when needed, synchronously as part of write operations. `VACUUM` doesn't have a direct impact on performance, so engineers are able to choose a suitable cadence that aligns with their storage cost and data recovery expectations.
1. I added a third benchmark scale to represent ultra-small workloads, this being the 1GB scale factor that translates to 140MB of compressed data.
1. In my prior benchmark, I included a modified version of the Polars benchmark that would use DuckDB for the pre-merge sample operation. While Polars still doesn't support a lazy evaluated sample, I rewrote the code to replicate the output of sampling while still keeping things lazy.

### Why This Benchmark Is Relevant
Most benchmarks that are published are too query-heavy and miss the reality that data engineers build complex ELT pipelines to load, clean, and transform data into a shape that is consumable for analytics. TPC-DS and TPC-H particularly fall short in this regard. Yes, they are relevant for bulk data loading and complex queries, but they miss the broader data lifecycle.

> My lightweight benchmark proposes that **the entire end-to-end data lifecycle which data engineers manage or encounter is relevant**: data loading, bulk transformations, incrementally applying transformations, maintenance jobs, and ad-hoc aggregative queries.

## Engine Versions Used
| Engine       | Version                                   |
| ------------ | ----------------------------------------- |
| Daft         | 0.4.18                                    |
| Delta-rs     | 0.18.3                                    |
| DuckDB       | 1.3.1                                     |
| Polars       | 1.30.0                                    |
| Spark        | Fabric Runtime 1.3 (Spark 3.5, Delta 3.2) |

## Spark Core -> Cluster Map
For the single-node engines, there's nothing to be confused about. 16-vCores means a 16-vCore machine. For Spark, it gets nuanced. The below shows the mapping of cluster config to how many cores were used (including the driver node):
| Core Count | Cluster Config            | Executor Cores |
| ---------- | ------------------------- | -------------- |
| 4          | 4-vCore Single Node       | 2              |
| 8          | 8-vCore Single Node       | 4              |
| 16         | 3 x 4-vCore Worker Nodes  | 12             |
| 32         | 3 x 8-vCore Worker Nodes  | 24             |

## What Has Changed Over the Last 6 Months?
Before we dig into the results, all engines have shipped various changes since December '24. I'll focus on a few key performance-related features or notable updates of each:
1. **Fabric Spark**:
    - The Native Execution Engine was GA'd at Build '25. This included a number of optimizations and provides greater coverage for native operators being used (i.e., Deletion Vectors).
    - Snapshot Acceleration: Phase 1 of efforts to reduce the cold query overhead of interacting with Delta tables has shipped. This can be enabled via `spark.conf.set("spark.microsoft.delta.snapshot.driverMode.enabled", True)`. This cuts the overhead of Delta table snapshot generation (the process of identifying and caching the list of files that are active in the version of the table being queried) by ~50%. _Note: this feature is currently disabled by default. I recommend enabling this config for all workloads._
    - [Automated Table Statistics](https://learn.microsoft.com/en-us/fabric/data-engineering/automated-table-statistics): These table-level statistics are collected synchronously as part of write operations to better inform the Catalyst cost-based optimizer in Spark about optimal join strategies. I've elected to disable auto stats collection for this benchmark since this is not a "write less, query often" workload that would have clear benefit from table statistics (if running a battery of `SELECT` statements or complex DML, I would certainly enable it).
1. **DuckDB**:
    - [External File Cache](https://duckdb.org/2025/05/21/announcing-duckdb-130.html#external-file-cache): Shipped as part of 1.3.0, this allows files to be cached on disk to avoid needing to make the more expensive hop to read data from cloud object stores for repeat queries to the same files. This is fundamentally the same feature as the [Intelligent Cache](https://learn.microsoft.com/en-us/fabric/data-engineering/intelligent-cache) in Fabric Spark.
    - The DuckDB extension for Delta shipped a number of [perf improvements](https://duckdb.org/2025/03/21/maximizing-your-delta-scan-performance.html?utm_source=chatgpt.com#performance-improvements-between-delta-v010-and-030) around file skipping and pushdown.
    - Still no native ability to write to Delta tables, but we can continue to use the Delta-rs Python library.
1. **Polars**:
    - Polars shipped a new streaming engine: https://github.com/pola-rs/polars/issues/20947
    - Since v1.14, the Polars Delta reader now leverages the Polars Parquet reader and is thus no longer dependent on Delta-rs for reading Delta tables.
    - Polars still doesn't support reading and writing to tables with [Deletion Vectors](https://milescole.dev/data-engineering/2024/11/04/Deletion-Vectors.html).
1. **Daft**:
    - Daft's new streaming engine, codename "Swordfish," is default in v0.4: https://blog.getdaft.io/p/swordfish-for-local-tracing-daft-distributed
1. **Delta-rs**:
    - Still no Deletion Vector support :(. Make noise here: https://github.com/delta-io/delta-rs/issues/1094

# Where Do Things Stand?
## 140MB Scale
At the 140MB scale (not tested in my benchmark from December '24), all single-machine engines are quite close in performance and handily beat Spark.
- There's almost no aggregate difference between DuckDB, Polars, and Daft at 4-vCores. At 2-vCores, Polars barely edges out DuckDB to take the win for the fastest execution on the smallest compute size.

![alt text](/assets/img/posts/Small-Data-Benchmark-2025/1g-all.png)

### 140MB Scale @ 4-vCores - Phase Detail
- Spark is significantly (2-5x) slower at all write operations.

![alt text](/assets/img/posts/Small-Data-Benchmark-2025/1g-4core.png)

## 1.2GB Scale
We've already reached our breakeven point where Spark is super competitive with all single-machine engines.
- While Fabric Spark doesn't give the option to run Spark on 2-vCores, at 4-vCores Spark is the slowest but is within arm's reach of the other engines.
- At 8-vCores, Spark, Polars, and DuckDB all complete the benchmark in the same time. Ironically, Spark at just 8-vCores running on a single-node (which uses only 4 executor cores) is 1.5x faster than Daft, the _"Spark killer"_.

![alt text](/assets/img/posts/Small-Data-Benchmark-2025/10g-all.png)

### 1.2GB Scale @ 8-vCores - Phase Detail

Looking at the detail by phase, a few observations:
> Fabric Spark with the Native Execution Engine is **super fast** at reading and writing parquet. Considering that Single-Node Spark clusters in Fabric only allocate 50% of VM resources to Spark, this means that Spark only had 1/2 the cores and memory available to do the actual work of reading and writing 1.2GB of parquet data and handily beat the other engines.

![alt text](/assets/img/posts/Small-Data-Benchmark-2025/10g-8core.png)

## 12.7GB Scale
Now at 12.7GB scale, we see Fabric Spark with the Native Execution Engine really flex its muscles:
- Spark was the **only** engine to complete the benchmark on 4-vCores. Yes, every engine advertises it can process data that is larger than memory, but somehow Spark is the only engine to complete all benchmarks, and with the Single-Node config, does it with 1/2 the available memory and cores 🤯. Interestingly, DuckDB was able to complete this 4-vCore job on version 1.1.3, but using the latest version (1.3.1), which is significantly faster in all other scenarios, resulted in OOM.
- At 8-vCores, neither Polars nor Daft could effectively manage memory to avoid OOM. Spark was 1.3x faster than DuckDB.
- At 16-vCores, Spark was ~2x faster than the next engine, DuckDB.
- At 32-vCores:
    - Spark was 2.8x faster than DuckDB
    - Spark was 2.9x faster than Polars
    - Spark was 6.7x faster than Daft

> Note: the 'PyArrow' Delta-rs engine was used instead of the newer 'Rust' engine for engines that don't directly support writing to Delta. The Rust engine had nearly the same performance but resulted in OOM at 8-vCores, whereas PyArrow didn't have any issues at this compute size.

![alt text](/assets/img/posts/Small-Data-Benchmark-2025/100g-all.png)

### 12.7GB Scale @ 16-vCores - Phase Detail
Looking at the detail from the 16-vCore tests:
- Fabric Spark with the Native Execution Engine was nearly 3x faster at phase 1 for loading the 5 Delta tables.
- Polars slightly beat Spark at performing the CTAS operation.
- Fabric Spark ran the 3x MERGE operations the fastest, with DuckDB close behind.
- Polars executed the ad-hoc query the fastest, with DuckDB and Spark very close behind.

![alt text](/assets/img/posts/Small-Data-Benchmark-2025/100g-16core.png)

## General Observations
1. As noted the last time I ran this benchmark, `VACUUM` is significantly slower in Spark. On the odd chance that you aren't using Deletion Vectors in Fabric, you could use the Delta-rs library to vacuum your tables.
1. `OPTIMIZE` is generally faster via Delta-rs. The reason for this is primarily that the Native Execution Engine doesn't support the entire compaction code path and results in two fallbacks to execution on the JVM. I anticipate this will get _much faster_ once we ship support for this code path.
1. In all benchmarks where Polars didn't run into OOM before getting to the ad-hoc query test, it was consistently the fastest engine at this aggregative query.
1. **Spark was the only engine to complete the entire battery of benchmark scenarios with not a single out-of-memory exception**. This is the result of the Native Execution Engine's highly efficient use of columnar memory, outside the JVM. Where JVM memory is needed for any fallbacks (i.e., when running `OPTIMIZE`), memory is dynamically allocated between on-heap and off-heap as needed.
1. Spark consistently sees greater relative improvement in execution time via adding more compute as compared to the other engines. Daft got slower at 1.2GB scale going from 4 to 8-vCores and also got slower at the 12.7GB scale going from 16 to 32-vCores.

## Which Engine Gained the Most Ground Since December '24?
While all engines got much faster, Fabric Spark with the Native Execution Engine saw the greatest performance gains relative to December '24 (between 1.6x-2x faster depending on the data scale and cluster config). Spark increased its advantage over single-machine engines at the 12.7GB scale while also getting even more competitive at the 1.2GB scale.

# So Is It Time to Ditch Spark?
Unless your data is around 100MB compressed, you don't project growth up to 1GB in the next couple of years, _and_ you are okay with trailing Delta lake compatibility (no support for Deletion Vectors), I'd say it's a hard **no** to give up on Spark anytime soon. While DuckDB, Polars, and Daft all leverage columnar memory and vectorized execution via either C++ or Rust implementations, Fabric Spark with the Native Execution Engine (via Velox and Apache Gluten) does as well. And guess what? There's plenty of additional optimizations still planned for Fabric Spark and the Native Execution Engine that will continue to improve performance in the coming year. I look forward to seeing where things stand in 2026 😁.
