---
layout: post
title: "Write vs. Read Prioritization: Navigating V-Order Optimization in Fabric Spark"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-17483907.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-17483907.jpeg"
published: false
---
Microsoft Fabric Spark enables V-Order compression by default as a Spark configuration. Said simply, V-Order is a parquet write optimization that seeks to further compress data and improve scan performance of columnar parquet data via applying Power BI VertiPaq type compression algorithms. 

The goal of this blog post is to explore V-Order compression and the impliciations is has on various workloads to help inform the decision of whether it should always be enabled.

# What is V-Order

The [documentation](https://learn.microsoft.com/en-us/fabric/data-engineering/delta-optimization-and-v-order?tabs=sparksql#what-is-v-order) explains it quite clearly:

> 
    V-Order is a write time optimization to the parquet file format that enables lightning-fast reads under the Microsoft Fabric compute engines, such as Power BI, SQL, Spark, and others.

    Power BI and SQL engines make use of Microsoft Verti-Scan technology and V-Ordered parquet files to achieve in-memory like data access times. Spark and other non-Verti-Scan compute engines also benefit from the V-Ordered files with an average of 10% faster read times, with some scenarios up to 50%.

    V-Order works by applying special sorting, row group distribution, dictionary encoding and compression on parquet files, thus requiring less network, disk, and CPU resources in compute engines to read it, providing cost efficiency and performance. V-Order sorting has a 15% impact on average write times but provides up to 50% more compression.

    It's 100% open-source parquet format compliant; all parquet engines can read it as a regular parquet files. Delta tables are more efficient than ever; features such as Z-Order are compatible with V-Order. Table properties and optimization commands can be used on control V-Order on its partitions.

    V-Order is applied at the parquet file level. Delta tables and its features, such as Z-Order, compaction, vacuum, time travel, etc. are orthogonal to V-Order, as such, are compatible and can be used together for extra benefits.


# Workload Performance Impact
### Testing Framework
To compare the performance impact for various workloads, I used the TPC-DS data generator and ran all tests at the 10TB (sf10000), 1TB (sf1000), 100GB (sf100), and 10G (sf10) scale. I used TPC-DS over TPC-H because it provides a more realistic and comprehensive benchmark for evaluating the performance of modern big data systems, reflecting the complexity, scalability, and diverse workloads encountered in real-world environments.

Spark Cluster Config: 9 medium sized executors from a Spark Pool (8vCore / 56 GB RAM) w/ auto-scale and dynamic alocation disabled.

## Write Impact
To test the write impact of V-Order optimization, I measured the time to read the TPC-DS parquet files and write the output as Delta tables.

Since V-Order and its associated bin size config (1 Gb) is the default spark config in Fabric, I used the below to disable V-Order and set a bin size more commonly used in other Spark platforms (250 Mb):
```python
spark.conf.set("spark.sql.parquet.vorder.enabled", "false")
spark.conf.set("spark.microsoft.delta.optimizeWrite.binSize", 250000000) 
```

Below is the result measured in minutes. Writing out the TPC-DS datasets with V-Order optimization enabled took between 41% and 73% longer, with the average being 65%.

![Write Results](/assets/img/posts/Navigating-VOrder-Optimization/spark_write.png)

Did it have an impact on the size of the parquet data written via more efficicent compression? In this test case, V-Order optimization resulted in an average of 4% more data being written.

![Size Results](/assets/img/posts/Navigating-VOrder-Optimization/spark_write_size.png)

## Spark Read Impact
To evaluate the read impact of V-Order, I'll be testing two workloads: Fabric Spark and Power BI Direct Lake.

### Spark TPC-DS Queries
To measure the read impact, I ran ran the TPC-DS _Power test_ (99 sequentially executed queries) against V-Ordered Delta tables and tables where V-Order was disabled at time of creation across all TPC-DS scale factors.

To ensure that all scenarios were fairly measured, I made sure to stop and start the cluster each time before running to ensure that any data caching from prior runs would not influence the results.

![Read Results](/assets/img/posts/Navigating-VOrder-Optimization/spark_read.png)

Starting at 1TB, V-Order optimization improves the performance of executing the TPC-DS Power benchmark, and seems to increase in effect as the data volume increases. At 10TB, V-Order improved performance by 5%. Below are the tabular results:

| Scenario | V-Order | Duration (seconds) |
|----------|---------|--------------------|
| sf10     | No      | 223                |
| sf10     | Yes     | 229                |
| sf100    | No      | 224                |
| sf100    | Yes     | 229                |
| sf1000   | No      | 220                |
| sf1000   | Yes     | 216                |
| sf10000  | No      | 229                |
| sf10000  | Yes     | 212                |

### Power BI Direct Lake via Cold Cache
To evaluate the impact on Power BI Direct Lake Semantic Models, before executing queries in DAXStudio, I refreshed the Direct Lake model in the Service before running each test so that prior to the start of each query run the Analysis Service cache would be invalidated and thus force a cold cache query to be run against the source Delta tables.

Below are the results from a few DAX queries that I generated:

GRAPH TO BE ADDED... So far results with this test data show that the V-Order and higher bin size Delta tables are less performant via Direct Lake, I'm wondering if Bin Size is the key factor here as I was entirely expecting meaningful performance improvement.

THE BELOW IS BASED ON THE EXPECTED RESULTS OF SEEING DIRECT LAKE PERFORMANCE IMPROVED VIA VORDER... FURTHER ANALYSIS PENDING, i.e. IMPACT OF BIN SIZE, USING ANOTHER BENCHMARK DATASET TO CONFIRM RESULTS.

## What do the results mean?
When looking at the impact of V-Order across the 3 tested workloads it's clear that the cold cache performance improvement for Direct Lake Semantic Models comes at a cost. Across all scale factors, using the default V-Order optimization (and related bin size config) we see almost a 40% performance hit on writing the data. Reading the data in Spark saw almost no improvement. Therefore, would I recommend leaving V-Order optimization enabled for all Spark workloads in Fabric? No. Since V-Order optimization only provides significant benefits for cold cache Direct Lake queries, I would only consider enabling V-Order for tables in your Lakehouse that will be served up via Direct Lake Semantic Models.

Would I enable V-Order for _all_ Direct Lake Semantic Models? It depends, I'd really need to consider the frequency in which the underlying data is changing to measure the frequency that cold cache queries are actually run on the Semantic Model. For models that are refreshed once to a few times daily, I would likely prioritize write performance over periodic cold cache read improvements. A good example of where enabling V-Order optimization would be important and likely a no-brainer would be any hot path Semantic Models: models where the underlying Delta tables are being updated in near real-time via continuous mode structured streaming operations or EventStreams. In this scenario, report users would very frequently be hitting the cold cache, and therefore see meaningful user experience improvement via the performance boost of V-Order optimization.

# Closing Thoughts
Given that V-Order optimization was primarily created with improving cold cache performance of Direct Lake mode Power BI Semantic Models, it makes complete sense that that is where we see the benefits. I was a bit surprised that analytical queries run in spark didn't benefit much from the optimized data layout.