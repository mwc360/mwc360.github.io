---
layout: post
title: "Spark Shuffle Partitions: Stop Guessing at 200"
description: Learn what Spark shuffle partitions control, how poor sizing creates tiny tasks or oversized stragglers, and where Adaptive Query Execution helps.
tags: [Fabric, Spark, Optimization, AQE]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-25626517.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-25626517.jpeg"
published: False
---

`spark.sql.shuffle.partitions` might be Spark's most famous tuning setting and one of its most misunderstood.

The default is 200. That does not mean Spark wants every shuffle to produce 200 partitions. It means joins, aggregations, window functions, deduplication, and other wide transformations begin with 200 candidate reduce partitions unless the plan or a runtime optimization changes the count.

Sometimes 200 creates thousands of megabytes per task. Sometimes it creates tasks that finish faster than Spark can schedule them. Neither is ideal.

> A shuffle partition is a unit of downstream work, not a file-size setting and not a score where more is automatically better.

# What a shuffle actually does

A narrow transformation can process each input partition without moving rows between executors. A filter is the classic example: every output row can remain with the input partition that produced it.

A wide transformation needs rows with the same key to meet. Consider:

```python
sales.groupBy("customer_id").sum("amount")
```

Spark cannot finish a customer's total until every map task has sent that customer's rows to the same downstream partition. The stage boundary therefore looks like this:

1. Map tasks read their local input partitions.
2. Each map task hashes the grouping key and writes one block for each reduce partition it touches.
3. Reduce tasks fetch their blocks across the network.
4. Each reduce task combines, sorts, joins, or aggregates its assigned rows.

That network and disk exchange is the shuffle. The configured partition count determines how many reduce-side buckets Spark initially creates.

# Why the count changes performance

Imagine shuffling 64 GB on a cluster with 32 executor cores.

With 16 partitions, the average partition is 4 GB. Spark can run only 16 reduce tasks, leaving half the cores idle, and each task needs enough memory and spill capacity to process several gigabytes.

With 10,000 partitions, the average is about 6.5 MB. The work is highly parallel, but Spark must schedule 10,000 tasks, track 10,000 task results, and open a much larger number of shuffle blocks.

The useful middle is workload-dependent. You want:

- Enough partitions to keep all executor cores busy across multiple task waves.
- Small enough partitions to avoid memory pressure and excessive spill.
- Large enough partitions that scheduling overhead is small relative to useful work.
- A distribution without a handful of hot keys creating long-running stragglers.

This is why a formula based only on core count is incomplete. Cores tell you how many tasks can execute concurrently. Shuffle bytes tell you how much work each task must perform. Key distribution tells you whether the average is hiding a long tail.

# Try the shuffle visualizer

The playground below runs the same illustrative shuffle with two plans:

- **Fixed count:** Spark keeps every configured reduce partition.
- **AQE coalescing:** Spark reads the map-output statistics, then merges adjacent small partitions toward an advisory target.

Try the **Too many partitions** preset and watch AQE remove task overhead. Then try **Too few partitions**. The adaptive plan cannot coalesce its way out of a starting count that already created oversized tasks.

{% include interactive.html src="/assets/playgrounds/spark-shuffle-partitions.html?embedded=1" open_src="/assets/playgrounds/spark-shuffle-partitions.html" title="Interactive Spark shuffle partition visualizer" height="1550" class="playground-embed" %}

The duration formula is intentionally simple and labeled in the playground. It is not a benchmark. Its purpose is to make the tradeoff visible: every task has fixed overhead, large tasks take longer, and the stage waits for its slowest wave.

# Where Adaptive Query Execution helps

Adaptive Query Execution (AQE) lets Spark revise parts of the physical plan after upstream stages produce runtime statistics. For shuffle partition sizing, the important feature is post-shuffle coalescing.

If you start with 800 partitions but the shuffle produces only 8 GB, Spark can merge small adjacent partitions before launching the reduce stage. If the same job processes 800 GB tomorrow, Spark has enough initial buckets to preserve parallelism.

That leads to a useful operating principle:

> With AQE enabled, a generous initial shuffle partition count is usually safer than an aggressively low count because AQE can merge excess partitions, but ordinary coalescing cannot create partitions that were never there.

A practical configuration to test is:

```python
spark.conf.set("spark.sql.adaptive.enabled", "true")
spark.conf.set("spark.sql.adaptive.coalescePartitions.enabled", "true")
spark.conf.set("spark.sql.adaptive.coalescePartitions.parallelismFirst", "false")
spark.conf.set("spark.sql.adaptive.advisoryPartitionSizeInBytes", "128MB")
spark.conf.set("spark.sql.shuffle.partitions", "800")
```

The important detail is `parallelismFirst`. Apache Spark documents its default as `true`, which favors preserving parallelism by using a target smaller than the advisory size. Setting it to `false` tells the coalescing logic to respect the advisory partition size more directly. That can reduce tiny tasks, but it should be tested against the real cluster and workload rather than copied blindly.

# AQE is not a magic eraser

AQE improves the decision after Spark knows more about the data, but it does not make every initial setting irrelevant.

## Too few initial partitions

If a 1 TB shuffle begins with 32 partitions, each bucket averages 32 GB. Post-shuffle coalescing merges partitions; it does not split ordinary oversized partitions.

AQE has separate skew-join optimization that can split eligible skewed join partitions, but that is not a general replacement for sufficient starting parallelism. An aggregation with one dominant key can still produce one dominant reduce task because all rows for that key must meet.

## Key skew

An average partition size can look healthy while one task reads ten times more data than the median. In the Spark UI, skew appears as a heavy tail: most tasks finish together and a few continue running.

The response depends on the operation:

- Let AQE optimize eligible skewed joins.
- Broadcast a genuinely small join side to avoid the shuffle.
- Filter and project before the wide transformation.
- Salt a hot key when business semantics allow it.
- Reconsider whether null or default values are collapsing unrelated records into one key.

Increasing the partition count may create more empty or small buckets without dividing the hot key itself.

## Multiple shuffles in one query

One query can contain several shuffle boundaries with very different data volumes. A single session-level count is therefore only an initial compromise. AQE is valuable because each completed map stage supplies statistics for its own downstream decision.

# How to tune with evidence

Use the Spark UI instead of tuning by elapsed time alone.

For the shuffle stage, inspect:

1. **Task count and waves:** Are there enough tasks to use the cores? Are there so many that most tasks do almost no work?
2. **Shuffle read size:** Compare median, upper percentiles, and maximum rather than only the total.
3. **Task duration:** A long maximum with a healthy median usually points to skew or an outlier.
4. **Spill:** Memory or disk spill indicates that task working sets exceed comfortable execution memory.
5. **AQE plan changes:** Confirm whether partitions were coalesced and which physical plan actually ran.

Then change one variable, rerun a representative workload, and compare the stage metrics. The goal is not to find the universally correct partition count. The goal is to give Spark enough initial resolution and let runtime evidence remove unnecessary work.

# Shuffle partitions versus input partitions

These settings solve different problems:

| Setting | Controls |
| --- | --- |
| `spark.sql.shuffle.partitions` | Initial partitions used by SQL/DataFrame shuffles such as joins and aggregations |
| `spark.sql.files.maxPartitionBytes` | How file-based input is packed into scan partitions |
| `repartition(n, columns...)` | An explicit shuffle and partitioning contract at that point in the plan |
| `coalesce(n)` | A narrow reduction in partition count when possible |
| AQE advisory partition size | The target used while coalescing post-shuffle partitions |

Changing `spark.sql.files.maxPartitionBytes` can increase scan parallelism without changing a later join's reduce partition count. Likewise, changing `spark.sql.shuffle.partitions` does not guarantee a particular number or size of output files.

# My default approach

For variable Fabric Spark workloads, I start with AQE enabled, a sufficiently high initial partition count, and an explicit advisory size. Then I validate the result in the Spark UI.

I lower the count only when I can demonstrate persistent scheduler overhead and confirm AQE is not already coalescing it away. I raise it when shuffle tasks are consistently too large, spill heavily, or cannot occupy the available cores.

Most importantly, I treat skew separately from partition count. A single hot key is a data-distribution problem wearing a task-sizing costume.

# References

- [Spark basics in Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/data-engineering/spark-best-practices-basics)
- [Apache Spark SQL performance tuning](https://spark.apache.org/docs/latest/sql-performance-tuning.html)
