---
layout: post
title: "Mastering Spark: DataFrameWriterV2 vs. DataFrameWriterV1"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-25626435.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-25626435.jpeg"
published: True
---

Most Spark developers learn to write data with `df.write` long before they ever encounter `df.writeTo`. It is simple, familiar, and everywhere: choose a format, pick a mode, add a few options, and save the result to a table or path. For years, that mental model worked well enough. Spark was often writing files first and tables second.

But modern lakehouse systems have changed the contract. A Delta table is not just a folder of Parquet files. It has transaction metadata, protocol features, table properties, constraints, generated columns, clustering metadata, schema evolution rules, and catalog-level behavior. In that world, the older `DataFrameWriter` API starts to show its age. A call like `mode("overwrite").saveAsTable(...)` can hide several different intentions: create the table, replace the table, overwrite the data, change the schema, or update existing metadata. The code is compact, but the semantics are overloaded.

`DataFrameWriterV2` was introduced to make those intentions more explicit. Instead of saying "write this DataFrame somewhere using this mode," the V2 API says "perform this specific table operation." Create, append, replace, create-or-replace, overwrite-by-expression, and overwrite-partitions become distinct actions rather than behaviors inferred from a combination of mode, format, options, and table existence.

That distinction matters more as Delta and Spark add richer table capabilities. Features like explicit table properties, dedicated schema-evolution semantics, and catalog-managed tables fit more naturally into a table-oriented API than a file-oriented one. Some features Spark exposes (like `clusterBy` on the writer) aren't fully wired into Delta yet, but the direction of travel is clear: V2 is where new table-level capabilities land.

In this post, we will compare the two writer APIs, look at the concrete differences in behavior, and highlight what is new in V2 as of Spark 4.2 and delta-spark 4.2.

## The old mental model: `df.write`

Most Spark developers start with the original `DataFrameWriter` API:

```python
df.write \
  .format("delta") \
  .mode("overwrite") \
  .saveAsTable("dbo.orders")
```

The core ingredients are:

```text
format + mode + options + path/table
```

That design makes sense when the output is primarily a set of files. But Delta tables are more than a directory of files. They have transaction logs, table metadata, features, schema rules, constraints, and catalog behavior. When the write target is a table, the question is no longer just "where should these rows go?" It is also "what table operation am I performing?"

That is where the older writer API becomes less clear. The biggest source of ambiguity is `mode("overwrite")`. Depending on table existence, catalog behavior, provider implementation, options like `overwriteSchema` or `replaceWhere`, and Spark configuration, the same line can mean: create the table, replace the table definition, keep the definition but overwrite the contents, replace only matching partitions or a `replaceWhere` predicate, or change the schema. The code is short, but the intent is overloaded.

## The newer mental model: `df.writeTo`

The V2 writer starts from a different place:

```python
df.writeTo("dbo.orders")
```

Instead of saying "save this DataFrame somewhere," V2 says "write this DataFrame to this table." From there, the operation is explicit:

```python
df.writeTo("dbo.orders").create()
df.writeTo("dbo.orders").append()
df.writeTo("dbo.orders").replace()
df.writeTo("dbo.orders").createOrReplace()
df.writeTo("dbo.orders").overwrite(col("order_date") == "2026-01-01")
df.writeTo("dbo.orders").overwritePartitions()
```

With V1, intent is inferred from `mode`, `format`, `options`, and target. With V2, intent is the method you call.

> Note: `format` (V1) and `using` (V2) are both optional. If you don't specify the provider, the default catalog format is used. In Microsoft Fabric, this is `delta`. The rest of the examples in this post omit `format("delta")` and `using("delta")` to avoid being unnessesarily verbose.

## A simple comparison

| Operation | V1 | V2 |
| --- | --- | --- |
| Create | `df.write.saveAsTable("t")` (errors if exists, depending on mode) | `df.writeTo("t").create()` |
| Append | `df.write.mode("append").saveAsTable("t")` | `df.writeTo("t").append()` |
| Replace table | `df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable("t")` | `df.writeTo("t").replace()` |
| Create or replace | `df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable("t")` | `df.writeTo("t").createOrReplace()` |
| Overwrite by predicate | `df.write.mode("overwrite").option("replaceWhere", "order_date = '2026-01-01'").saveAsTable("t")` | `df.writeTo("t").overwrite(col("order_date") == "2026-01-01")` |
| Overwrite matching partitions | `df.write.mode("overwrite").insertInto("t")` (with `partitionOverwriteMode=dynamic`) | `df.writeTo("t").overwritePartitions()` |

The V2 versions separate ideas that V1 conflates: `replace` requires the table to exist, `createOrReplace` does not, and `overwrite(condition)` and `overwritePartitions()` are no longer encoded as side-channel options on top of `mode("overwrite")`.

## Table properties vs. options: V2 gives them separate seats

This is the single biggest semantic improvement, and it is often misunderstood. **In V2, `tableProperty(...)` and `option(...)` are not interchangeable.** They are stored in two distinct internal maps and are routed to two different places ([`DataFrameWriterV2.scala` in Spark 4.2](https://github.com/apache/spark/blob/master/sql/core/src/main/scala/org/apache/spark/sql/classic/DataFrameWriterV2.scala)):

```scala
private val options    = new mutable.HashMap[String, String]()
private val properties = new mutable.HashMap[String, String]()
```

- `tableProperty(k, v)` populates the **table metadata** that the catalog persists when creating or replacing the table. For Delta, that means it lands in the `Metadata` action in the transaction log and shows up under `SHOW TBLPROPERTIES` and in `DESCRIBE DETAIL`. Examples: `delta.enableChangeDataFeed`, `delta.appendOnly`, `delta.deletedFileRetentionDuration`, `delta.feature.timestampNtz`, `delta.checkpointPolicy`.
- `option(k, v)` populates **write options** that are passed to the data source for this particular write. They do not become table metadata. Examples: `mergeSchema`, `replaceWhere`, `txnAppId`, `txnVersion`, `userMetadata`.

In V1, both of these had to be funneled through `.option(...)`, which blurred a real distinction:

```python
# V1: everything is just an "option"
df.write \
  .option("delta.enableChangeDataFeed", "true") \  # actually a table property
  .option("mergeSchema", "true") \                  # actually a per-write option
  .mode("append") \
  .saveAsTable("dbo.orders")
```

In V2, the two roles are visible at a glance:

```python
df.writeTo("dbo.orders") \
  .tableProperty("delta.enableChangeDataFeed", "true") \
  .tableProperty("delta.feature.timestampNtz", "supported") \
  .option("mergeSchema", "true") \
  .createOrReplace()
```

This separation is also what allows V2 to round-trip a real table definition. The properties map is what the catalog stores; the options map is what the writer hands to the data source for this specific operation.

> Practical note: V2 still accepts `option(...)`. The improvement is not that options went away — it is that table-level metadata is no longer pretending to be a per-write option.

### Paths still work — they just aren't the headline

V2 is table-first, but it has not dropped path support. `option("path", "...")` is still honored and is used as the table location at create time:

```python
df.writeTo("dbo.orders") \
  .option("path", "/lakehouse/silver/orders") \
  .create()
```

That is useful for external tables. The shift is one of emphasis: in V1, paths and tables were two equally prominent ways to call `save(...)` / `saveAsTable(...)`; in V2, the identifier is the table and the path is just one more option that influences where the table lives.

## Liquid clustering on the API surface (Spark 4.0+)

`CreateTableWriter.clusterBy(...)` was added in [Spark 4.0.0](https://github.com/apache/spark/blob/master/sql/api/src/main/scala/org/apache/spark/sql/DataFrameWriterV2.scala) and Spark enforces that `partitionedBy` and `clusterBy` aren't both set on the same writer (it throws `clusterByWithPartitionedBy`). That matches Delta's rule that a table is partitioned **or** clustered, not both.

The caveat: on the Delta side, `clusterBy` from the DataFrame writers (V1 *or* V2) is **not wired in yet**. There is an open PR — [delta-io/delta#7060 "support accepting clusterBy from both v1 and v2 dataframe writers"](https://github.com/delta-io/delta/pull/7060) that adds this support. Until it lands, the only first-class way to create a liquid-clustered Delta table is via SQL:

```sql
CREATE OR REPLACE TABLE dbo.orders
CLUSTER BY (customer_id, order_date)
AS SELECT ...
```

Or, write and then alter the table:

```python
df.writeTo("dbo.orders") \
    .create()

spark.sql("ALTER TABLE dbo.orders CLUSTER BY (customer_id, order_date)")
```

This is a good example of the gap noted earlier: Spark's V2 API can express the intent, but the table provider still has to implement it.

## Explicit schema evolution (Spark 4.2 + delta-spark 4.2)

The `withSchemaEvolution()` method on `DataFrameWriterV2` is new in [Spark 4.2.0](https://github.com/apache/spark/blob/master/sql/api/src/main/scala/org/apache/spark/sql/DataFrameWriterV2.scala). It only applies to write operations against an existing table — `append`, `overwrite(condition)`, and `overwritePartitions` — and throws on `create`/`replace` (where schema evolution is implicit in the new definition):

```python
df.writeTo("silver.orders") \
  .withSchemaEvolution() \
  .append()
```

On the Delta side, this is gated by a `TableCapability.AUTOMATIC_SCHEMA_EVOLUTION` flag. Delta's [Spark version shims](https://github.com/delta-io/delta/blob/master/spark/src/main/scala-shims/spark-4.2/SparkTableShims.scala) only enable this capability on the **spark-4.2** build:

- spark-4.0 shim: capability not available at all.
- spark-4.1 shim: capability exists in Spark but is intentionally not advertised by Delta because MERGE/INSERT schema evolution wasn't yet properly wired.
- spark-4.2 shim: capability is advertised, and `df.writeTo(...).withSchemaEvolution().append()` works end-to-end on Delta.

In other words: if you are on delta-spark built against Spark 4.2, `withSchemaEvolution()` is the new, explicit replacement for `.option("mergeSchema", "true")` on V2 appends and overwrites.

## MERGE finally has a DataFrame API (Spark 4.0+)

For years, the only way to do `MERGE INTO` from Python/Scala was either raw SparkSQL or Delta's `DeltaTable.merge(...)` builder. Spark 4.0 added a Spark-native DataFrame entry point and like the rest of the V2-era APIs, it's table-oriented and explicit.

The shape is `df.mergeInto(target, condition)`, not `df.writeTo(target).merge(...)`. It's presumably kept separate because merge needs a join condition and a chain of `whenMatched` / `whenNotMatched` / `whenNotMatchedBySource` clauses that don't fit the create/append/overwrite builder shape:

```python
source.alias("s") \
    .mergeInto("dbo.orders", expr("dbo.orders.id = s.id")) \
    .whenMatched().updateAll() \
    .whenNotMatched().insertAll() \
    .whenNotMatchedBySource().delete() \
    .merge()
```

`df.mergeInto(...)` does not return a `DataFrameWriterV2` — it returns a separate `MergeIntoWriter`. But it sits on the same V2 foundations. From [`MergeIntoWriter.scala`](https://github.com/apache/spark/blob/master/sql/core/src/main/scala/org/apache/spark/sql/classic/MergeIntoWriter.scala) the builder produces a `MergeIntoTable` logical plan against an `UnresolvedRelation` with V2 multi-part identifier resolution and the V2 `requireWritePrivileges` model — the same plan SQL `MERGE INTO` produces. Providers implement it through V2 row-level operations (Iceberg via `SupportsRowLevelOperations`; Delta via its own analyzer rules that route to the existing Delta MERGE execution).

`MergeIntoWriter` also has its own `withSchemaEvolution()` builder method, separate from the one on `DataFrameWriterV2` but conceptually identical: explicit, builder-set, no magic `option("mergeSchema", "true")` required.

What this means in practice:

- For new Delta merge code in Python/Scala, `df.mergeInto(...)` is now the V2-native equivalent of `DeltaTable.forName(...).merge(...)`. It's not faster, but it doesn't require importing `delta.tables` and it plays naturally with the rest of the V2 DataFrame surface.
- `DeltaTable.merge(...)` is not going away — it still exposes Delta-specific knobs — but `df.mergeInto(...)` is the cross-provider, Spark way to express the same operation.
- If merging based on paths instead of catalog references, you will need to continue using the `DeltaTable.merge(...)` builder, the new Spark API requires a catalog reference for the table being merged into.

## Replace semantics are clearer (and Delta knows the difference)

Delta has special-cased V2's create/replace behavior for a long time. From [`CreateDeltaTableLike.scala`](https://github.com/delta-io/delta/blob/master/spark/src/main/scala/org/apache/spark/sql/delta/commands/CreateDeltaTableLike.scala):

> In DataFrameWriterV1, `mode("overwrite").saveAsTable` behaves as a CreateOrReplace table, but we have asked for `overwriteSchema` as an explicit option to overwrite partitioning or schema information. With DataFrameWriterV2, the behavior asked for by the user is clearer: `.createOrReplace()`, which means that we should overwrite schema and/or partitioning.

So `df.writeTo("t").replace()` and `.createOrReplace()` are not just nicer-looking — Delta uses the API choice itself as the signal that schema and partitioning should be replaced, without needing `overwriteSchema=true` as a hint. Domain metadata (used by features like clustering) is also only updated on these explicit replace paths.

## Partitioning is part of the table definition

With V1, `partitionBy` is a write-time layout hint. With V2, `partitionedBy` is part of the table definition you are creating or replacing:

```python
df.writeTo("dbo.orders") \
  .partitionedBy("order_date") \
  .create()
```

V2 also supports partition transforms (`years`, `months`, `days`, `hours`, `bucket`) for providers that implement them such as Apache Iceberg. Delta doesn't implement partitioned transforms so it has to be a static column reference.

## When V1 is still the right tool

V1 is not going away, and it is still the right choice for file-oriented writes and very simple appends:

```python
df.write.mode("overwrite").parquet("/exports/orders")
df.write.format("json").mode("append").save("/exports/events")
df.write.format("delta").mode("append").save("/lakehouse/bronze/events")
df.write.mode("append").saveAsTable("bronze.raw_events")
```

The point is not that V1 is obsolete. The point is that V1 carries ambiguity when you are managing modern tables, and V2 now has the features (clustering, explicit schema evolution, table properties) to fully replace it for table lifecycle work.

## Watch out for compatibility differences

V2 is cleaner, but it is not magic. Capabilities depend on the Spark version, the catalog, and the provider:

- `clusterBy` requires Spark 4.0+ on the API side, and a provider that implements it. Delta does **not** yet honor `clusterBy` from the DataFrame writers — track [delta#7060](https://github.com/delta-io/delta/pull/7060). For now, use SQL `CLUSTER BY` to create liquid-clustered Delta tables.
- `withSchemaEvolution()` requires Spark 4.2+ **and** a provider that advertises `AUTOMATIC_SCHEMA_EVOLUTION`. On Delta, that means a build against the spark-4.2 shim.
- Some V2-looking code can still fail if the provider hasn't fully implemented the requested transform (for example, older Delta versions and partition transforms).

The rule of thumb:

```text
V2 gives Spark a clearer way to express intent.
The table provider still has to implement that intent correctly.
```

## Recommended style

For modern Delta work, a reasonable default style guide:

Use SQL or V2 for table lifecycle operations:

```sql
CREATE OR REPLACE TABLE silver.orders
CLUSTER BY (customer_id, order_date)
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true')
AS SELECT ...
```

or, until [delta#7060](https://github.com/delta-io/delta/pull/7060) lands, the DataFrame equivalent without clustering:

```python
df.writeTo("silver.orders") \
  .tableProperty("delta.enableChangeDataFeed", "true") \
  .createOrReplace()
```

Use V2 for writes against existing managed tables:

```python
df.writeTo("silver.orders").append()
df.writeTo("silver.orders").withSchemaEvolution().append()         # Spark/Delta 4.2+
df.writeTo("silver.orders").overwrite(col("order_date") == d)      # replaceWhere, explicit
df.writeTo("silver.orders").overwritePartitions()                  # dynamic partition overwrite for partitioned tables
```

Use V1 for path-based exports and simple file outputs:

```python
df.write.mode("overwrite").parquet("/exports/orders")
```

Be cautious with V1 `mode("overwrite").saveAsTable(...)`. That code may be correct, but it deserves a second look. Make sure the intended behavior — create, replace, replaceWhere, overwriteSchema — is obvious to the next person who reads it. If it isn't, V2 will say it for you.

## Final thought

The difference between V1 and V2 writers is not just syntax. It reflects a broader shift in Spark itself. The older API comes from a world where Spark jobs mostly wrote files. The newer API fits a world where Spark manages tables — with first-class properties, clustering, and (as of Spark/Delta 4.2) explicit schema evolution.

`df.write` is still useful. But when the code is creating, replacing, or managing Delta tables, `df.writeTo` now tells the truth more clearly, and it has the features to back it up.