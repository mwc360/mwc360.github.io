---
layout: post
title: "Optimizing Spark: A Deep Dive into Optimized Write in Microsoft Fabric"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-technobulka-2908984.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-technobulka-2908984.jpeg"
published: true
---
At the time of writing this post, Fabric Spark Runtimes enable Optimized Writes by default as a Spark configuration setting. This Delta feature aims to improve read performance by providing optimal file sizes. That said, what is the performance impact of this default setting, and are there scenarios where it should be disabled?

# What is Optimized Writes?
Optimized Writes is a Delta Lake feature that aims to reduce the number of files written as part of a Delta table to mitigate the risk of having too many files. Known as "the small file problem," when a large number of small files are generated via write operations or accumulated over time, distributed compute systems like Spark can see performance regressions due to the increased overhead of reading and managing many small files.

> _To draw an analogy: consider you are moving into a new house, it would be inefficient to put just one small item in each packing box or carry a single small item at a time, regardless of how many people you have helping. To maximize efficiency, you would want to fill each box and make sure that the movers (or your friends :)) are carrying as much as reasonable in each trip._

The Optimized Writes feature is designed with partitioned tables in mind. When tables are partitioned, you naturally end up with more files since each executor is going to write its own file(s) to the given partition. The more executors and partitions that you have, the more files you will have that make up your table. Reading from a single partition may be efficient, but when reading from many or all partitions, there's a much higher likelihood of seeing performance degradation because of there being too many small files. Optimized Writes solves for this by shuffling data before it is written so that a single executor would contain all data within a given partition to ensure that fewer (and larger) files are written.

This feature is excellently illustrated via the diagram below:
![alt text](https://docs.delta.io/latest/_images/optimized-writes.png)

The number of files written depends on the BinSize Spark config, which controls the target in-memory size of each file before it is written. In Fabric Runtimes, the setting currently defaults to 1GB. If leaving Optimized Writes enabled, you may want to change the BinSize to 512MB or even 256MB depending on your workload.

The BinSize setting can be changed via the code below; the value is provided in bytes:
```python
spark.conf.set("spark.microsoft.delta.optimizeWrite.binSize", 1073741824) 
```

The feature can be turned off and on via the below code:

```python
spark.conf.set("spark.microsoft.delta.optimizeWrite.enabled", "<true/false>")
```

Or in SparkSQL:

```sql
SET `spark.microsoft.delta.optimizeWrite.enabled` = true
```

## When Should I Use It?
While improving reads and DML operations that involve reading the source table, i.e. MERGE, is fantastic, it comes at the cost of shuffling all data before writing it. Given that the feature is entirely designed to improve data written to partitioned tables, **you should only ever consider using it for partitioned tables**.

If you are using partitioned tables, consider the number of distinct partitions that you have. If you have a small number of partitions (i.e., less than 10), you may not see much benefit from using Optimized Writes given the large overhead involved in shuffling the data.

> ⚠️ Do not use Optimized Writes if using non-partitioned tables!

## What is the performance impact?
In my testing, reading TPC-DS parquet files and writing out non-partitioned Delta tables, **disabling Optimized Writes resulted in 35% better performance**. Given that the feature guarantees a pre-write shuffle of data across executors, this result is hardly surprising.

Writing out partitioned Delta tables would also see the same performance regression; however, we may see improved performance when reading from partitioned tables where Optimized Writes was enabled to minimize the number of files, particularly as the number of partitions increases.

To illustrate the potential impact, I created a few different variants of a sales table. I intentionally picked a high cardinality partitioning column, date_sold, to show the magnitude of impact that Optimized Writes can have:

| Partitioned By | Optimized Writes Enabled | Table Write Duration (hh:mm:ss) | Partition Count | File Count | Data Size | SELECT SUM(profit) FROM... Duration (hh:mm:ss)|
|----------------|--------------------------|------------------------------|-----------------|------------|-----------|--------------------------------------------|
| date_sold      | false                    | 00:06:43                        | 1823            | 175008     | 20,327 MB | 00:01:35                                      |
| date_sold      | true                     | 00:00:53                        | 1823            | 1823       | 15,287 MB | 00:00:05                                      |
| n/a            | false                    | 00:00:40                        | 0               | 96         | 12,767 MB | 00:00:01                                      |
| n/a            | true                     | 00:01:47                        | 0               | 15         | 12,304 MB | 00:00:02                                      |

### Takeways:
1. **Optimized Writes is critical to enable on partitioned tables, particularly as the number of partitions increases.**
    - Creating a table partitioned by a somewhat low cardinality column (1832 distinct values) with Optimized Writes disabled resulted in 175,008 parquet files and took almost 8x longer to write! _⚠️ WARNING: SMALL FILE PROBLEM!!!_
    - This same table had ~33% more MB of data written since the data was so fragmented into many small files that the net data compression suffered.
    - Running a simple `SELECT SUM(profit)...` from the table with a "small file problem" took 19x longer than the same partitioned table with Optimized Writes enabled.
1. **Partition wisely!**
    - I intentionally picked a terrible column to partition by; year and month would've been a far more appropriate strategy compared to partitioning by date (with day). Don't over-partition, look for very low cardinality columns that are often used in query predicates.
1. **Partitioning is often overused.**
    - The fastest configuration to write and read in this scenario was the table that was not partitioned and had Optimized Writes disabled. Less MB of data was written, fewer files were written, the table was written 32% faster, and the simple query ran 5x faster. With this data size, even if the query was filtered on a single date in the where clause, thus allowing the engine to selectively read from a single partition, there would be no meaningful improvement in the duration to execute the query. Don't partition simply because you can, always partition with strategic intent and validate your thesis.
1. **Don't use Optimized Write for non-partitioned tables!**
    - Disabling Optimized Write for the non-partitioned table resulted in writing the table 167% faster, and a 2x faster run of the simple query.

 
I also ran the TPC-DS power test (99 queries run sequentially) on non-partitioned Delta tables that were created with Optimized Write enabled vs. tables written with Optimized Write disabled. I found that **running the test on tables with the feature disabled resulted in 10% better performance** at the 1TB scale. This is because the Optimized Write feature resulted in fewer files and, given these tables weren't partitioned, the effective read parallelism was reduced.

# Closing Thoughts
As illustrated, while Optimized Writes can dramatically improve performance for partitioned tables, enabling the feature for non-partitioned tables can be quite detrimental. The feature likely could've been better named as _PartitionOptimizedWrites_ and implemented to only attempt to optimize file sizes where the Delta table is partitioned, that way users wouldn't have to selectively enable or disable the feature depending on each table's data layout strategy.

Don't be like the sad sap below, if using partitioned Delta tables, make sure to enable Optimized Writes.
![Small File Problem](/assets/img/posts/Optimized-Writes/DALL·E-smallFileProblem.png)
