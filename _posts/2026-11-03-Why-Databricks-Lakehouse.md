---
layout: post
content_tracks: [oss, databricks]
title: "Why a Databricks Lakehouse"
description: The lakehouse can be built anywhere, but it is best realized on the platform that invented it. Here's why robust data management comes standard on Databricks.
tags: [Databricks, Lakehouse, Delta Lake, Apache Iceberg, Liquid Clustering, Predictive Optimization, Unity Catalog, Spark]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-eberhardgross-1612351.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-eberhardgross-1612351.jpeg"
published: True
---

> If you've followed my blog, you know that most of what I write about comes back to the same handful of technologies: Apache Spark, Delta Lake, and the lakehouse architecture that ties them together. Those technologies transformed my career. I went from being an obstinate Spark skeptic, to a practitioner implementing them for customers, to spending the last 2.5 years at Microsoft working on Spark and Delta Lake on the product side. I'm incredibly proud of what we built for customers there, and grateful to the people I got to build it with.
> 
> I recently joined Databricks as a Staff Product Manager focusing on Spark and performance. The blog isn't changing personality; it's still going to be about Spark, Delta, and making data engineering better. But since this is my first post in the new role, it felt right to start by explaining what draws me to the lakehouse as Databricks builds it.

The lakehouse architecture introduced a simple but powerful idea: unify the robust data management of the data warehouse with the openness, flexibility, and decoupled storage of the data lake. In principle, a lakehouse can be implemented _anywhere_, on _any object store_, with _any compute engine that supports open table formats_. In this post I want to make the case for why I believe the lakehouse is best realized on the platform that invented the product category in the first place: Databricks.

I'll make the case with three points:
1. Robust data management comes standard
1. Flexibility without the complexity
1. A track record of innovation

> _A quick note on scope:_ In this blog I will only focus on what is _unique to Databricks_: the capabilities that make it the best place to implement a lakehouse rather than just one more place you can build one.

# 1. Robust data management comes standard

A lakehouse, by definition, implies robust data management. Half of its heritage comes from the data warehouse, where engines shipped with nearly all of the bells and whistles needed to make your life easier and minimize how much practitioners needed to know about system internals just to get the job done.

Plenty of engines can read and write open table formats today, so in a loose sense the lakehouse is everywhere. Far fewer deliver the full vision, where robust data management is the default rather than something you assemble yourself.

When I think about robust data management, I think about SQL. While I love digging into internals and low-level capabilities, I also remember that I used to be a [SQL guy to the point that I avoided Spark with a passion](https://milescole.dev/architecture/2024/04/24/Confessions-of-a-Spark-Convert.html). The unnecessary complexities—part perception, part reality—made me avoid Spark. So what makes a lakehouse platform exceptional? One that gives you all the flexibility Spark offers, but makes it _feel_ like a modern cloud database. I don't want to think about data layout, small files, configs to enable, or whether I picked the right clustering key.

These challenges are much of what I've blogged about over the last few years:

- [Delta Table Maintenance 101](https://milescole.dev/optimization/2023/10/08/Delta-Table-Maintenance-101.html)
- [Optimizing Spark: A Deep Dive into Optimized Write](https://milescole.dev/data-engineering/2024/08/16/A-Deep-Dive-into-Optimized-Write-in-Microsoft-Fabric.html)
- [Mastering Spark: The Art and Science of Table Compaction](https://milescole.dev/data-engineering/2025/02/26/The-Art-and-Science-of-Table-Compaction.html)
- [How Incremental Liquid Clustering Works](https://milescole.dev/data-engineering/2026/07/24/Incremental-Liquid-Clustering-Fabric-Runtime-2.html)
- [Mastering Spark: Session vs. DataFrameWriter vs. Table Configs](https://milescole.dev/data-engineering/2024/12/20/Understanding-Session-and-Table-Configs.html)
- [Unlock Faster Writes in Delta Lake with Deletion Vectors](https://milescole.dev/data-engineering/2024/11/04/Deletion-Vectors.html)
- [To V-Order or Not: Making the Case for Selective Use of V-Order in Fabric Spark](https://milescole.dev/data-engineering/2024/09/17/To-V-Order-or-Not.html)

While I still have a great appreciation for understanding how features work under the hood and how they impact data pipelines, the best outcome for most teams is to not need to think about them at all. The platform should remove any burden that would require a user to go beyond expressing business logic via SQL.

## Tables that take care of themselves

What stands out to me is how many of these concerns are handled for you on Unity Catalog managed tables, and with nothing to turn on.

### Table maintenance

**Background automatic compaction.** Small files are the original lakehouse tax. On [Unity Catalog managed tables](https://www.databricks.com/blog/how-unity-catalog-managed-tables-automate-performance-scale), Databricks runs [auto compaction](https://docs.databricks.com/aws/en/tables/tune-file-size#upgrade-to-background-auto-compaction) as a background process after qualifying writes. The writing compute doesn't wait for the async compaction job, so your code moves on immediately with minimal net impact to the overall data pipeline. There's no table property to remember and no session config to set.

**Intelligent write amplification reduction.** Optimized write is automatically enabled for writes that commonly generate small files. As I showed in my [compaction study](https://milescole.dev/data-engineering/2025/02/26/The-Art-and-Science-of-Table-Compaction.html), shuffling data pre-write to write healthy-sized files is generally more efficient than doing it post-write. Other platforms leave this as a user decision. Additionally, manually triggered `OPTIMIZE` jobs automatically _no-op_ under certain conditions. Want to know why something didn't trigger? The table history in Unity Catalog shows the reason why operations no-op even though there's no Delta commit in these cases.

**Predictive optimization.** Beyond compaction, [predictive optimization](https://www.databricks.com/blog/announcing-general-availability-predictive-optimization) handles the rest of the maintenance you'd normally schedule yourself: `OPTIMIZE` to compact and cluster, `VACUUM` to remove files that are no longer referenced, `ANALYZE` to keep statistics fresh for the optimizer, and `PURGE` in the event that you have a high ratio of soft-deleted rows which need to be removed. All of this runs on serverless background compute, so maintenance doesn't compete with your workloads or your SLAs. The system decides _when_ each operation is worth running based on how the table is actually used, so you aren't stuck planning maintenance windows or scheduling extra jobs.

> Table maintenance, specifically the lack of, is easily the biggest performance and cost trap that I've seen in lakehouse environments. Even if maintenance is scheduled and running at the optimal time, there's arguably no business value behind a data engineer maintaining this themselves. It's an extra, unnecessary burden that reflects a data platform maturity gap, not something users should need to worry about.

**Statistics where your queries need them.** One part of predictive optimization deserves its own callout, because almost nobody I talk to is aware of the problem it solves: by default, data skipping statistics (min/max values, null counts) are only collected on the [first 32 columns of a table](https://learn.microsoft.com/en-us/azure/databricks/tables/data-skipping#specify-statistics-columns). If your queries filter on column 33 or beyond, there are no statistics to skip files with, and the engine falls back to scanning far more data than it needs to. Normally, avoiding that means understanding your query workload well enough to know which columns are filtered on, and then manually reordering the schema or configuring stats collection for them:

```sql
ALTER TABLE sales.orders
SET TBLPROPERTIES ('delta.dataSkippingStatsColumns' = 'order_id, customer_id, order_ts, region');

ANALYZE TABLE sales.orders COMPUTE DELTA STATISTICS;
```

On Unity Catalog managed tables, predictive optimization does this for you. It identifies the columns beyond the first 32 that are frequently used in query filters and collects file-skipping statistics on them automatically.

> **Missing data skipping stats results in unnecessary full scans.** Because so few engineers know about the 32-column default, wide tables on most platforms quietly run full scans that can make queries much slower and more expensive than they need to be. This is yet another normal operational burden that Databricks automates away, and that's the part I find most compelling: even the most junior engineers can build highly performant environments because the platform itself automates much of the complexity that would otherwise require an engineer with enough experience to have learned these performance traps.

### Data layout

**[`CLUSTER BY AUTO`](https://www.databricks.com/blog/announcing-automatic-liquid-clustering).** I'll admit I was skeptical of how well automatic clustering key selection could work. Choosing clustering keys has always been part art, part science, and the right answer changes as query patterns evolve. Then I read the paper, [AutoLiquid: Autonomic Data Layout Optimization for the Databricks Lakehouse](https://www.vldb.org/pvldb/vol19/p4023-liang.pdf), and was blown away by how the complexity of the solution appropriately aligns with the complexity of the problem. AutoLiquid observes the query workload, evaluates candidate keys, and only changes the layout when the predicted savings justify the cost of reclustering.

```sql
CREATE TABLE sales.orders (
    order_id BIGINT,
    customer_id BIGINT,
    order_ts TIMESTAMP,
    amount DECIMAL(18, 2)
)
CLUSTER BY AUTO;
```

No keys to pick up front, and no decision to revisit later as query patterns drift. The system self-optimizes.

**Clustering on write.** Why wait for the next compaction job to cluster data that was just written? With [clustering on write](https://docs.databricks.com/aws/en/delta/clustering), operations like `INSERT INTO`, `CTAS`/`RTAS`, `COPY INTO`, and DataFrame appends can cluster data during the write itself when the write is large enough for it to be worthwhile. Thresholds scale with the number of clustering columns, and when it kicks in, data lands already clustered. That means less write amplification, because data doesn't get written once and then rewritten by `OPTIMIZE`. It also means newly written data benefits from file skipping sooner, which translates to lower cost and better query performance.

### Automatic upgrades

We all know that table protocols change over time. For any current pain point, there's likely to be a future table feature that solves the problem, but this often requires opting into the feature due to a protocol change (e.g., deletion vectors, v2 checkpoints, catalog managed commits). The constant flow of innovation in the open table format space creates a unique burden for data engineers and platform operators around upgrades. Do you enable the new feature? Does it work with the combination of writers and readers that access your tables?

Databricks provides [**automatic upgrades**](https://docs.databricks.com/aws/en/tables/automatic-upgrades) to eliminate this burden, again putting best practice table layouts on autopilot. Databricks monitors the unique combination of writers and readers hitting every table and will automatically opt in to new best practice features that are fully supported. You get automatic upgrades custom-tailored to your unique environment.

## Database semantics on open tables

Warehouses have always given you transactions, concurrency, and other database semantics without a second thought. Open table formats brought ACID guarantees to the data lake, but plenty of database-grade behaviors were left as feature gaps for data engineers to creatively work around. On Databricks, open tables get the rest.

### Transactions

Multi-statement, multi-table transactions are a warehouse capability that didn't seem possible with lakehouse architectures, so we data engineers got crafty with how we built pipelines to work around the gap. Delta has always given you ACID guarantees, but only one table at a time. Need to archive old orders, delete them from silver, and bump a watermark as a single unit of work? Traditionally you'd run each step, hope nothing fails halfway, and write compensating logic for when it does. On Databricks, [multi-statement transactions](https://docs.databricks.com/aws/en/transactions) make it one atomic unit:

```sql
BEGIN ATOMIC
  INSERT INTO sales.archive.orders
    SELECT * FROM sales.silver.orders WHERE order_ts < '2026-01-01';
  DELETE FROM sales.silver.orders WHERE order_ts < '2026-01-01';
  UPDATE sales.ops.watermarks
    SET archived_through = DATE'2026-01-01'
    WHERE table_name = 'orders';
END;
```

Either every statement commits or none of them do. Unity Catalog coordinates the commit across tables, Delta and Iceberg alike, rather than each table's log acting alone. Transactions are now [generally available](https://www.databricks.com/blog/transactions-are-generally-available-advancing-warehousing-lakehouse), and they're one of the clearest examples of the lakehouse finally feeling like a database. While I personally wouldn't build around transactions for a greenfield project, since idempotent, single-table pipelines are still simpler to reason about and recover, they're incredibly useful in legacy DW migration scenarios.

### Concurrent writes

Another common scenario for data teams coming from the warehouse side of things: concurrent writes. You design your pipelines to run multiple `MERGE` jobs against the same table, as after all, this was possible and low risk in warehouse land. Then you encounter the wonderful `ConcurrentWriteException` and start questioning everything: "Where did I go wrong?" and "Why did I give in to the allure of being able to have it all?"

Those rows happened to live in the same Parquet file, and conflict detection works at the file level. The usual workarounds are partitioning schemes designed around write patterns rather than queries, serializing jobs that could run in parallel, or wrapping writes in retry loops. With [row-level concurrency](https://docs.databricks.com/aws/en/optimizations/isolation/row-level-concurrency), Databricks detects conflicts at the _row_ level instead, just like a traditional warehouse engine. Concurrent `UPDATE`, `DELETE`, and `MERGE` operations only conflict when they modify the same row, and it's enabled automatically. Same-row edits and metadata changes still conflict, as they should. Higher-level coordination like the [job locks I wrote about recently](https://milescole.dev/data-engineering/2026/08/05/Why-you-might-lease-a-blob.html) is still useful when a whole process must not overlap, but a whole class of table-level write conflicts goes away.

### Change data

Classic Change Data Feed asks you to make a tradeoff up front. You opt in per table, then pay for it on every write by materializing change files and storing extra data, all for consumers who may or may not exist yet. [Automatic CDF](https://docs.databricks.com/aws/en/delta/delta-change-data-feed) flips that model: the Databricks Runtime computes row-level changes at _query time_ from row tracking metadata. Downstream consumers read changes with the same `table_changes()` and `readChangeFeed` APIs, and writers don't pay a CDF tax, all enabled by default.

## A catalog that feels like a database

Every platform has some sort of catalog. Most of them answer one question: _where is this table, and who's allowed to read it?_ That's table stakes. [Unity Catalog](https://docs.databricks.com/aws/en/data-governance/unity-catalog/) is what makes Databricks feel like a modern database in all of the best ways, because everything you'd expect a database to know about itself is built in, with nothing extra to deploy or configure:

- **Column-level lineage:** [Captured automatically](https://www.databricks.com/blog/announcing-general-availability-data-lineage-unity-catalog) at runtime for SQL, Python, Scala, and R, across notebooks, jobs, pipelines, and dashboards. There's nothing to bolt on and nothing to maintain.
- **Usage insights:** Every table shows [who queries it most](https://docs.databricks.com/aws/en/discover/table-insights), which tables it's frequently joined with, which notebooks and dashboards depend on it, and how popular each column is.
- **System tables:** [Query history, lineage, audit logs, billing, job runs, and more](https://docs.databricks.com/aws/en/admin/system-tables/), all exposed as tables you can query with plain SQL.

Unity Catalog includes an incredibly robust system table schema to answer just about any question with SQL. Want to know what breaks before you drop a column? Ask the catalog:

```sql
SELECT DISTINCT target_table_full_name, target_column_name, entity_type
FROM system.access.column_lineage
WHERE source_table_full_name = 'sales.silver.orders'
  AND source_column_name = 'discount_pct'
  AND event_time >= current_date() - INTERVAL 90 DAYS;
```

Or find the slowest queries hitting that table this week:

```sql
SELECT executed_by, total_duration_ms, read_bytes, statement_text
FROM system.query.history
WHERE start_time >= current_date() - INTERVAL 7 DAYS
  AND statement_text ILIKE '%sales.silver.orders%'
ORDER BY total_duration_ms DESC
LIMIT 20;
```

Impact analysis, cost attribution, and "who is still using this table?" are now simple SQL.

# 2. Flexibility without the complexity

## Open formats, open engines, open catalogs

Notice the common thread? Defaults. None of these features asks you to become an expert in file layout or maintenance scheduling; the best practice is just what you get. Now, after reading that list, you might reasonably conclude that the answer is to adopt a SQL-first platform. Unfortunately, that has historically meant major tradeoffs in flexibility and openness: proprietary storage, limited support for complex data types and semi-structured data, being locked-in to a single engine, and data that's awkward to reach from anything else. The point of the lakehouse was to stop making that choice. With Databricks, you get warehouse-grade data management on open formats, in your own cloud storage, accessible from Spark, SQL, Python, and any engine that speaks Delta or Iceberg. There's no reason you can't have it all.

I'm obviously a huge Delta Lake fan, but the reality is that organizations end up on different formats because of their tech stack and past strategic decisions. Databricks offers [first-class Apache Iceberg support](https://www.databricks.com/blog/unity-catalog-and-next-era-apache-icebergtm) alongside Delta, including Unity Catalog managed Iceberg tables and Iceberg v3. Most features unique to Databricks, such as `CLUSTER BY AUTO`, predictive optimization, and automatic upgrades, carry over so that you can choose the format that's right for your organization without giving up platform maturity.

Need to move your tables from one catalog to another? Migrating from or to another platform? Databricks recently released `REGISTER` and `UNREGISTER` [APIs](https://www.databricks.com/blog/unlocking-data-portability-preventing-catalog-lock-register-and-unregister-apis) to the Iceberg Rest Catalog specification. It's your data, so why not have the freedom to move your data between catalogs, zero data movement involved. 

## Pipelines without the plumbing

Flexibility usually comes with a tax: more plumbing, more configuration, and more code just to get data from A to Z. So the real question isn't whether you _can_ build it. It's how long it takes to go from idea to a reliable production pipeline, and how much code you're left owning once you get there.

### Declare what you want, not how to build it

Declarative pipelines, in my opinion, are the biggest shift in how Spark data engineering gets done since the DataFrame API and open table formats. Instead of writing imperative code that reads, transforms, writes, checkpoints, and orchestrates each step, you declare the datasets you want. The engine works out the dependency graph, checkpoints, retries, and parallelism. The core framework is now open source as Spark Declarative Pipelines. **Lakeflow Spark Declarative Pipelines** on Databricks adds what makes it production-grade: [Auto Loader](https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/), [data quality expectations](https://docs.databricks.com/aws/en/ldp/expectations), incremental materialized view refresh, AUTO CDC, and serverless execution.

This new paradigm also presents the largest ongoing optimization opportunity for your data pipelines. As you give up control over how data gets from _raw_ to _fact_ or _A_ to _Z_, you enable the system to have maximum freedom in optimizing your jobs while your output data contract remains in place. Every automatic runtime upgrade gives some of the best engineers on the planet the ability to seamlessly ship crafty optimizations that reduces the cost of running your pipelines, all without you needing to touch a single line of code.

Here's a complete declarative medallion pipeline:

```sql
CREATE OR REFRESH STREAMING TABLE orders_bronze
COMMENT 'Raw order events, incrementally ingested from cloud storage'
AS SELECT *
FROM STREAM read_files('/Volumes/sales/landing/orders/', format => 'json');

CREATE OR REFRESH STREAMING TABLE orders_silver (
  CONSTRAINT valid_order_id EXPECT (order_id IS NOT NULL) ON VIOLATION DROP ROW,
  CONSTRAINT positive_amount EXPECT (amount > 0)
)
COMMENT 'Validated orders'
AS SELECT * EXCEPT (order_ts), to_timestamp(order_ts) AS order_ts
FROM STREAM(orders_bronze);

CREATE OR REFRESH MATERIALIZED VIEW daily_revenue_gold
COMMENT 'Daily revenue by customer'
AS SELECT customer_id, to_date(order_ts) AS order_date, sum(amount) AS revenue
FROM orders_silver
GROUP BY customer_id, to_date(order_ts);
```

There's no checkpoint location to manage, no `foreachBatch`, no orchestration code to say that silver runs after bronze, and no separate data quality framework. Auto Loader tracks which files have already been processed, and schema inference and evolution are handled for you. Expectations record pass/fail metrics for every update, so you can see data quality trends over time instead of discovering bad data downstream.

### Automatic incremental file processing

Spark Structured Streaming has amazing incremental file processing capabilities. Just point to a directory where files land and the streaming API can incrementally process only new arriving files. The catch is that make it production grade, you need to enable file archival or deletion to prevent unbounded growth in file list API calls. To manage state, the files in the directory are listed and then compared against the files the checkpoint notes as having been processed.

> If you do not enable file archival via `cleanSource` your data pipeline will get slower every single run simply from listing the files in the root folder.

```python
df = (
  spark.readStream
    .format("csv")
    .option("cleanSource", "archive")
    .option("sourceArchiveDir", archive_path)
    .schema(schema)
    .load(folder_path)
)
```

The major downside of file archival is that you can't have multiple subscribers reading from the same folder and that reprocessing a table requires moving the archived files back to the folder which is being read from.

While you could build some complex solution with storage events and storage queues to decouple _files to be processed_ from object store file listing APIs, Databricks has long had [Autoloader](https://docs.databricks.com/aws/en/ingestion/cloud-object-storage/auto-loader/) for this exact purpose. It manages automatically provisioned cloud infra so that a simple change to your DataFrame code encapsulates all of the complexitites of incremental file processing at scale, but without the maintenance and scalability tradeoffs.

```python
autoloader_df = (
  spark.readStream
    .format("cloudFiles")
    .option("cloudFiles.format", "csv")
    .option("cloudFiles.useManagedFileEvents", "true") # uses UC managed file events
    .option("cloudFiles.schemaLocation", schema_path)  # enables automatic schema inference that is performant and scalable!
    .load(main_path)
)
```

What makes Databricks unique here is the proximal compatibility with OSS Apache Spark. Other platforms generally require using a completely different proprietary API for scalable file processing. With Databricks you get to use the same OSS DataFrame `readStream` API, but just swap the format to `cloudFiles` and a couple other settings and your existing data pipeline will operate as is, but now with scalable processing!

### Change data capture in a few lines

Slowly changing dimensions are a rite of passage for data engineers. They're also a reliable source of engineering investment and bugs: out-of-order events, late-arriving deletes, and `MERGE` statements that grow a new edge case every quarter. [**AUTO CDC**](https://docs.databricks.com/aws/en/ldp/developer/ldp-python-ref-apply-changes) reduces SCD type 1 and type 2 to a simple declaration, available in PySpark and SparkSQL:

```python
from pyspark import pipelines as dp
from pyspark.sql import functions as sf

dp.create_streaming_table("customers_scd2")

dp.create_auto_cdc_flow(
    target="customers_scd2",
    source="customers_cdc_feed",
    keys=["customer_id"],
    sequence_by="change_ts",
    apply_as_deletes=sf.expr("operation = 'DELETE'"),
    except_column_list=["operation", "change_ts"],
    stored_as_scd_type=2,
)
```

Records are applied in `sequence_by` order even when they arrive out of order, deletes are handled correctly, and the `__START_AT`/`__END_AT` history columns are maintained for you. Switching to SCD type 1 is a one-character change. Sure, you could roll your own OOP dimension generation framework like many of us have done in the past, but why add extra complexity when functions exist for this exact purpose.

### Ingestion without the middleware

[**Zerobus Ingest**](https://docs.databricks.com/aws/en/ingestion/zerobus-overview) solves a problem most of us just accepted as a reason data engineers are paid a pretty penny. If an application, device, or service produces events, the traditional answer has been to stand up a message bus, a streaming job to consume from it, and then write to the sink (table). Zerobus is a serverless, push-based API that writes records directly into Unity Catalog tables:

```python
from zerobus.sdk.sync import ZerobusSdk
from zerobus.sdk.shared import RecordType, StreamConfigurationOptions, TableProperties

sdk = ZerobusSdk(
    "https://<workspace-id>.zerobus.<region>.cloud.databricks.com",
    "https://<workspace-url>",
)
stream = sdk.create_stream(
    client_id,
    client_secret,
    TableProperties("iot.telemetry.device_readings"),
    StreamConfigurationOptions(record_type=RecordType.JSON),
)

try:
    offset = stream.ingest_record_offset(
        {"device_id": "sensor-42", "temperature": 21.7, "humidity": 48}
    )
    stream.wait_for_offset(offset)  # block until the record is durable
finally:
    stream.close()
```

For telemetry, IoT, and clickstream use cases, Zerobus removes an entire tier of infrastructure, along with the brokers you'd otherwise size and the consumer jobs you'd otherwise babysit.

### Extensible data extraction

When the data lives in a SaaS application or operational database instead, [**Lakeflow Connect**](https://www.databricks.com/blog/announcing-general-availability-lakeflow-connect) provides managed connectors, including CDC from databases, that land data in Unity Catalog tables without custom extraction code. For sources that aren't covered yet, [**community connectors**](https://docs.databricks.com/aws/en/ingestion/community-connectors) allow teams to build and share open-source connectors against a simple common interface, so the connector you write for a niche API or service can be reused rather than rebuilt by the next team.

## Compute that manages itself

The lakehouse decoupled compute from storage. Serverless takes the next step and decouples _you_ from managing, upgrading, and sizing compute.

### Compute without the tuning

Of all the Spark developers I've talked to, I've never heard a single one say they enjoy tuning clusters. It's an advanced skill, and even then it can often come down to trial and error: which VM SKU, how many workers, how much memory per executor, autoscaling or fixed? _If you do enjoy it, please reach out. I have questions._

It gets harder once you try to optimize for utilization. You can pack multiple jobs into a single session to save on compute, but pack too many and you're likely to start hitting OOMs or REPL failures. Getting it right takes deep knowledge of your workloads and what runs concurrently with them, and in the end it's still trial and error. And does every run of an incremental job process the same amount of data and need the same compute? No. Because we data engineers have to optimize for reliability, we either size compute for the _largest_ incremental run and overpay for every other run, or turn on autoscaling and accept its tradeoffs: delayed scale-up, overly eager scaling, and other inefficiencies that can hurt TCO.

[**Serverless compute**](https://docs.databricks.com/aws/en/compute/serverless/) for notebooks, jobs, and pipelines removes all of that. It starts in about 1 second and scales to what each run actually needs. Cluster sizing, SKU selection, and pool pre-warming simply aren't your problem anymore. Developers get to focus on what they actually enjoy, building data pipelines and business logic, rather than the infrastructure underneath.

Similar to declarative pipelines, serverless compute lets the platform auto-optimize your workload over time. Did your data volume double after a stellar year? Serverless adapts. Your hand-tuned clusters will need exactly that: more hand tuning.

### A runtime that upgrades itself

If that wasn't enough, there's the runtime itself. Think about what happens when the next Spark release comes out. The new runtime ships with a better optimizer, faster I/O, and a pile of bug fixes. Getting those benefits means updating the version in every cluster and job definition, regression-testing in a lower environment, and hoping nothing behaves differently in production. So upgrades get deferred, and a surprising number of production workloads end up running on runtimes that are years old. They miss every performance improvement shipped since, and eventually they're at risk of not running at all once the runtime passes its end-of-support date.

Serverless removes that burden entirely because it's [**versionless**](https://www.databricks.com/blog/examining-versionless-apache-sparktm-ai-powered-upgrades-and-seamless-stability-2-billion). Your code talks to the engine through a stable client API built on Spark Connect, so Databricks can upgrade the engine underneath you continuously without changing your code. Every workload picks up the latest performance improvements and fixes automatically, and there's no version to bump.

The obvious worry: what happens when an upgrade breaks my job? If a job fails on a new runtime release, an AI-powered release stability system classifies whether the failure could be a regression. If it does, the job is automatically retried on the prior stable version and pinned there, and a bug is filed internally. Once the fix ships, the workload moves forward again on its own. You don't open a ticket or roll anything back; in most cases you never even know it happened. Across more than 2 billion Spark workloads and 25 runtime releases, including the jump to Spark 4, only 0.000006% of jobs have needed an automatic rollback.

> **The fastest runtime for your code is the one you're running.** A performance improvement that requires a migration project is a performance improvement most teams won't see for a year or more. Versionless means every engine improvement Databricks ships reaches every serverless workload without anyone lifting a finger.

### Enterprise networking ready

Finally, enterprise networking and security requirements shouldn't force you to settle for a degraded subset of platform capabilities. Meeting them often comes with a laundry list of constraints and nuances. [**Serverless private connectivity**](https://docs.databricks.com/aws/en/security/network/serverless-network-security/) uses network connectivity configurations to let serverless compute reach your storage accounts, databases, and services over private endpoints, and you configure it once at the account level for the workspaces that need it. That lets serverless workloads reach supported resources over private endpoints without giving up the platform capabilities they need.

> **Simple is not the same as limited.** Every capability in this section is still Spark underneath. When you need to drop down to a custom `foreachBatch`, a hand-tuned job, or a classic cluster with specific configs, you can. The difference is that additional complexity and configurability is your escape hatch, not your starting point.

# 3. A track record of innovation

Sure, all of that is today. But a fair question is: _can Databricks keep leading here?_ Or, more skeptically: _give it a couple of years and everyone else will catch up._ The best answer I have is the track record.

Let's get the obvious part out of the way. Apache Spark was created at UC Berkeley's AMPLab by the people who went on to found Databricks, and Databricks engineers remain among the largest contributors to the project. Delta Lake was created by a team at Databricks that also led the creation of Spark SQL and Structured Streaming.

So Databricks is the company behind two of the most influential data projects of the last decade. Is that all? Not even close. Year after year, Databricks keeps shipping ideas that the rest of the industry ends up adopting:

- **[Structured Streaming](https://www.databricks.com/blog/2016/07/28/structured-streaming-in-apache-spark.html) (2016):** Unified batch and streaming in Spark under a single DataFrame API, so streaming became "just another query".
- **[Databricks Delta](https://databricks.com/blog/2017/10/25/databricks-delta-a-unified-management-system-for-real-time-big-data.html) (2017):** ACID transactions and schema enforcement on top of cloud object storage, unifying batch and streaming writes. This was the transactional layer that made the lakehouse possible. It was open-sourced as Delta Lake in 2019.
- **[MLflow](https://www.databricks.com/blog/2018/06/05/introducing-mlflow-an-open-source-machine-learning-platform.html) (2018):** The open-source standard for tracking, packaging, and deploying ML models. It has since grown into the GenAI era with tracing and evaluation for agents.
- **[Medallion architecture](https://www.databricks.com/blog/2019/08/14/productionizing-machine-learning-with-delta-lake.html) (2019):** Databricks popularized the bronze/silver/gold vocabulary that nearly every data team now uses to describe multi-zone data refinement.
- **[Photon](https://www.databricks.com/blog/2020/11/12/announcing-the-launch-of-databricks-sql.html) (2020):** A native, vectorized C++ query engine that is fully compatible with Spark APIs. It brings modern analytical database performance to existing Spark and SQL workloads without code changes. Following Databricks' lead, today just about every managed Spark platform now offers a vectorized Spark acceleration engine.
- **[Delta Sharing](https://www.databricks.com/blog/2021/05/26/introducing-delta-sharing-an-open-protocol-for-secure-data-sharing.html) (2021):** The first open protocol for secure, cross-platform data sharing, so recipients don't have to be on the same platform as the provider.
- **Unity Catalog (2021):** Unified governance for data and AI assets across clouds and formats. It was [open-sourced in 2024](https://www.databricks.com/blog/open-sourcing-unity-catalog) and now serves as the external data access API for Delta providers.
- **[Dolly 2.0](https://www.databricks.com/blog/2023/04/12/dolly-first-open-commercially-viable-instruction-tuned-llm) (2023):** The first open-source, instruction-following LLM licensed for commercial use. It was trained on a human-generated instruction dataset that Databricks employees created and open-sourced.
- **[Variant](https://www.databricks.com/blog/introducing-variant-new-open-standard-semi-structured-data-apache-parquettm-delta-lake) (2024):** An open data type and binary encoding for semi-structured data. Databricks contributed it to Apache Spark and Apache Parquet, and it's now part of Delta Lake and Iceberg v3, so every engine can share one fast representation instead of parsing JSON strings.
- **[Spark Declarative Pipelines](https://www.databricks.com/blog/bringing-declarative-pipelines-apache-spark-open-source-project) (2025):** Years of experience with declarative ETL in Delta Live Tables (2021), contributed back to Apache Spark so that anyone can define pipelines as datasets and let the engine handle orchestration.
- **[Lakebase](https://www.databricks.com/blog/announcing-lakebase-public-preview) (2025):** A fully managed, serverless Postgres with decoupled compute and storage, scale-to-zero, and instant zero-copy branching. It's governed by Unity Catalog and built for the era of apps and agents that need a real operational database next to their data.
- **[Real-time mode](https://www.databricks.com/blog/introducing-real-time-mode-apache-sparktm-structured-streaming) (2025):** Millisecond-latency Structured Streaming on the same Spark APIs. Fraud detection, personalization, and operational alerting no longer require bolting a separate streaming engine onto your stack.
- **[Omnigent](https://www.databricks.com/blog/introducing-omnigent-meta-harness-combine-control-and-share-your-agents) (2026):** An open-source "meta-harness" for building, running, governing, and sharing AI agents across different agent harnesses, extending the same open, governed philosophy into the agentic era.
- **[LTAP](https://www.databricks.com/blog/lakebase-ltap-rethinking-database-storage) (2026):** Lake Transactional/Analytical Processing, and yet another reinvention of the data space. For decades, transactional and analytical systems have lived apart, held together by fragile CDC and ETL pipelines that copy data from one to the other. HTAP tried to solve that by forcing both workloads into one engine, with all the compromises that implies. LTAP unifies at the _storage_ layer instead: as transactions commit in Lakebase, the data is materialized into open columnar formats in the lake. Postgres serves the application, lakehouse engines serve analytics, and both work against a single governed copy of the data with no pipelines in between. It isn't publicly available yet, but just as Delta Lake brought transactions to the data lake, LTAP brings the lake to the transactional database.

In case it's not apparent, Spark and Delta Lake weren't one-offs. Innovation is the norm, and that's the best indicator I know of better things to come.

# Final thought

The lakehouse was always meant to be the best of both worlds: the openness and flexibility of the data lake with the data management of the warehouse. Many platforms deliver the first half but fall short on robust, simple, and automated data management. What I love about Databricks is how much complexity simply doesn't exist: maintenance that runs itself, layouts that tune themselves, runtimes that self-upgrade, and on-demand serverless compute tuned to your workload.

Is it perfect? It's as close as any platform, but there's still work to do and the target keeps moving: technology changes both what's required and what's possible every day. But if the last decade is any indication, from Spark and Delta Lake to MLflow, Photon, Unity Catalog, and Spark Declarative Pipelines, I wouldn't bet against Databricks being the one to close those gaps first. The lakehouse was invented here, and it keeps getting reinvented here.

I spent the early part of my career avoiding Spark, and the years since making it work as well as possible for the people who depend on it. Now I get to do that alongside the people who started it all. I'm excited to keep writing about Spark, Delta, and the lakehouse, and there's a lot more to come.

Anyone can run a lakehouse. Databricks is where the lakehouse increasingly runs itself.