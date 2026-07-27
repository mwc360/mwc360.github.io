---
layout: post
title: "How Incremental Liquid Clustering Works"
description: Learn how Fabric Spark Runtime 2.0 incrementally clusters Delta tables, limits write amplification, and maintains file-skipping quality.
tags: [Fabric, Spark, Delta Lake, Liquid Clustering]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-25626521.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-25626521.jpeg"
published: True
---

Liquid Clustering was already a better abstraction than static partitioning due to its flexible nature. Fabric Spark Runtime 2.0 fixes the part that had me actively cautioning customers to reconsider blindly adopting it: the cost of maintaining the layout.

In Runtime 1.3 (Delta 3.2) a small append followed by `OPTIMIZE` would rewrite every file in a partial Z-Cube. In Runtime 2.0, the incremental strategy only touches files that are unclustered, small, or carrying a high density of deletion vectors. That changes Liquid Clustering from an occasional, potentially expensive maintenance operation into something that works beautifully with workloads of any shape and with adjacent layout optimizations. Batch or streaming writes. Auto Compaction and/or Fast Optimize. With the new incremental strategy, Liquid Clustering is highly compatible and highly efficient, and should now take its rightful place as the de facto new data layout strategy.

> Runtime 2.0 introduces a tight relationship between clustering cost and the amount of new or unhealthy data.

# Liquid Clustering in one sentence

Liquid Clustering stores rows with similar clustering-column values in files with tight value ranges. When a query filters on those columns, Delta file statistics allow Spark to skip files whose ranges cannot contain matching rows.

You declare the desired layout as table metadata:

```sql
CREATE TABLE dbo.sales (
    order_id BIGINT,
    order_date DATE,
    region STRING,
    amount DECIMAL(10, 2)
)
CLUSTER BY (order_date, region);
```

Unlike Hive-style partitioning, this does not create a directory for every value. Unlike Z-Order, the clustering definition persists on the table and can be changed later.

| Strategy | Physical organization | Changing columns | Ongoing maintenance |
| --- | --- | --- | --- |
| Hive partitioning | Directories by value | Usually requires a rewrite | Writers must target partitions |
| Z-Order | Column value min/max ranges stored as Delta commit metadata | Specify columns on each run | Manually scope repeated optimization |
| Liquid Clustering | Column value min/max ranges stored as Delta commit metadata | `ALTER TABLE ... CLUSTER BY` | `OPTIMIZE` uses the stored definition |

Based on the OSS implementation, for one clustering column, Liquid Clustering uses a Z-Order curve. For two or more columns, the Hilbert curve is used to preserve locality across dimensions.

# Why Runtime 1.3 could become expensive

A **Z-Cube** is the logical group of files that shares a clustering definition. The earlier strategy from OSS Delta Lake selected every file in a partial Z-Cube whenever clustering ran. A Z-Cube smaller than the stability threshold would therefore be rewritten repeatedly.

Imagine a table with 99 GB in a partial Z-Cube:

1. Append 1 KB.
2. Run `OPTIMIZE`.
3. Rewrite the existing 99 GB plus the new 1 KB of data.
4. Append another 1 KB.
5. Rewrite the same existing data again.

The new data is small, but the maintenance cost grows with the partial Z-Cube. This is write amplification: rewriting more data than required to incorporate a relatively small change.

That behavior is why frequent `OPTIMIZE` was risky for liquid-clustered tables in Runtime 1.3. For Auto Compaction, I'd argue that Liquid Clustering was incompatible by design, but not blocked by protocol. Since Auto Compaction runs synchronously, a tiny write that could take 2 seconds could now run for dozens of minutes as it reclusters the new data into a large partial Z-Cube.

# What incremental clustering changes

We built Incremental Liquid Clustering into **Fabric Spark Runtime 2.0** to unlock this optimized, simplified, and more flexible data layout strategy for customers, and it's enabled by default. The important change is file selection.

Instead of selecting every file in each partial Z-Cube, `OPTIMIZE` looks for files with a reason to be processed:

- **Unclustered files** created by new writes.
- **Small files** that should be compacted into healthier output files.
- **Unhealthy files** whose layout no longer provides sufficient clustering quality.
- **Deletion-vector files** whose accumulated deletes exceed the cleanup threshold.
- **Overlapping clustered files** selected by Auto Reclustering.

Already clustered, appropriately sized, healthy files remain untouched.

To see the clustering time difference between the standard and incremental strategies, see my [feature announcement blog](https://community.fabric.microsoft.com/t5/Fabric-Updates-Blog/Incremental-Liquid-Clustering-in-Microsoft-Fabric-Faster-smarter/ba-p/5189122).

## The clustering pipeline

Once the engine selects files, the overall process is still recognizable:

1. **Select candidates** that need clustering or compaction.
2. **Bin-pack candidates** into appropriately sized groups.
3. **Range partition rows** using Z-Order or a Hilbert curve.
4. **Write replacement files** with tighter clustering-column ranges.
5. **Commit metadata** to the Delta log and remove the replaced files from the active snapshot.

The optimization is not a new sorting algorithm. It is a smarter decision about which existing files need to participate and how to maintain high file-skipping potential over a table's life cycle.

# Try the write-amplification model

The interactive model below runs the same append pattern against two simplified tables:

- **Standard strategy from OSS Delta Lake:** rewrites files in partial Z-Cubes.
- **Incremental strategy:** clusters the new files and leaves healthy clustered files alone.

Append a few batches and run `OPTIMIZE`, then use **Fast-forward 20×** to see how repeated small writes compound. The second half lets you add overlapping files and adjust the Auto Reclustering thresholds.

{% include interactive.html src="/assets/playgrounds/incremental-liquid-clustering.html?embedded=1" open_src="/assets/playgrounds/incremental-liquid-clustering.html" title="Interactive incremental Liquid Clustering simulator" height="1400" class="playground-embed" %}

The model intentionally simplifies file selection and overlap scoring so the behavior is visible. The real engine evaluates file statistics across all clustering dimensions and makes additional decisions about target file sizes, deletion vectors, and clustering health.

# Auto Reclustering protects query performance

Only clustering new files would minimize writes, but it could gradually reduce query performance. New files can overlap existing value ranges, causing a predicate to touch more files than necessary.

Runtime 2.0 addresses that with **Auto Reclustering**. During `OPTIMIZE`, the engine detects groups of overlapping files and can pull the affected clustered files into the rewrite alongside new files.

Two session settings control how aggressively this happens:

| Configuration | Default | Effect |
| --- | --- | --- |
| `spark.microsoft.delta.optimize.clustering.strategy.incremental.autoRecluster.minOffendingFiles` | `4` | Minimum number of overlapping files needed to trigger reclustering |
| `spark.microsoft.delta.optimize.clustering.strategy.incremental.autoRecluster.minOverlapThreshold` | `0.75` | Minimum overlap score for a pair of files to count as overlapping |

Lowering either threshold makes the engine more aggressive. That can improve file skipping sooner, but it also increases write amplification. The defaults are highly tuned so I wouldn't recommend changing these unless you've done extensive testing for your workload.

You can disable Auto Reclustering independently:

```python
spark.conf.set(
    "spark.microsoft.delta.optimize.clustering.strategy.incremental.autoRecluster",
    False
)
```

Or disable the incremental strategy for the session:

```python
spark.conf.set(
    "spark.microsoft.delta.optimize.clustering.strategy.incremental",
    False
)
```

I would treat both as diagnostic or compatibility switches rather than routine tuning.

# `OPTIMIZE` versus `OPTIMIZE FULL`

Normal maintenance should use:

```sql
OPTIMIZE dbo.sales;
```

This applies the incremental strategy and processes the files selected by clustering, compaction, deletion-vector, and Auto Reclustering rules.

Use `FULL` when the table needs a broader layout reset:

```sql
OPTIMIZE dbo.sales FULL;
```

`OPTIMIZE FULL` reclusters partial Z-Cubes and Z-Cubes whose clustering keys or provider no longer match the current table definition. Stable Z-Cubes that already use the current definition will still be retained. It is broader and more expensive than ordinary incremental maintenance, but it is not a reason to routinely rewrite healthy data.

The clearest use case is after changing clustering columns:

```sql
ALTER TABLE dbo.sales
CLUSTER BY (region, product_category);

OPTIMIZE dbo.sales FULL;
```

Without `FULL`, new data begins using the new definition while older files can retain the previous layout until they are selected later.

# Choosing clustering columns

Clustering works best when the keys reflect actual filters, not every column that might appear in a query.

My default guidance:

- Choose **one to four columns** commonly used in `WHERE` predicates.
- Prefer columns that materially narrow the data read.
- Do not use column order to express priority; order does not affect the multidimensional layout.
- Expect each additional key to dilute the skipping benefit available to every individual dimension.
- Avoid selecting high cardinality keys with low cardinality.

For a sales table, `(order_date, region)` can be reasonable when most queries constrain time and geography. Adding customer, product, channel, promotion, and every other filterable column is not automatically better.

# Measuring whether the layout is healthy

Runtime 2.0 adds the Scala `clusteringQuality()` API:

```scala
import io.delta.tables.DeltaTable

val table = DeltaTable.forName(spark, "dbo.sales")
val quality = table.clusteringQuality()

display(quality)
```

The most useful outputs are:

| Metric | Healthy direction |
| --- | --- |
| `avg_depth` | Toward `1.0` |
| `max_depth` | Lower |
| `overlap_ratio` | Toward `0` |
| `skipping_effectiveness` | Toward `1` |
| `num_files_with_stats` | Close to `num_files` |

These metrics estimate file-skipping potential. They do not replace measuring real queries. Compare them with files-read metrics, Spark UI stages, and representative filter predicates.

# A practical operating pattern

For a Runtime 2.0 liquid-clustered table, I would split the life cycle based on development and ongoing maintenance:

Development:
1. Use `SHALLOW CLONE` to fork a table for perf testing.
1. Use `ALTER TABLE` to apply clustering based on common query filters.
1. Manually run `OPTIMIZE` to apply the clustering.
1. Run A/B performance testing to confirm the impact on common queries that filter on the clustering keys.
1. Optional: use the clustering quality method to evaluate the file-skipping potential from various candidate clustering strategies.

Production:
1. Enable Liquid Clustering strategy.
1. Run `OPTIMIZE` on a schedule, or preferably enable Auto Compaction.
1. Let incremental selection and Auto Reclustering handle routine maintenance.
1. Use `OPTIMIZE FULL` after a key change.

The opinionated takeaway is simple: **do not schedule full reclustering because it feels safer**. Runtime 2.0 is designed to tolerate small imperfections in exchange for dramatically lower write cost. Optimize the change, measure the layout, and reserve full rewrites for situations that actually require them.

For the complete configuration reference and supported data types, see [Liquid Clustering in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/liquid-clustering).
