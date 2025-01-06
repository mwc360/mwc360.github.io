---
layout: post
title: "Mastering Spark: Session vs. DataFrameWriter vs. Table Configs"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-andreea-ch-371539-4178808.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-andreea-ch-371539-4178808.jpeg"
published: True
---

With Spark and Delta Lake, just like with Hudi and Iceberg, there are several ways to enable or disable settings that impact how tables are created. These settings may affect data layout or table format features, but it can be confusing to understand why different methods exist, when each should be used, and how property inheritance works.

While platform defaults should account for most use cases, Spark provides flexibility to optimize various workloads, whether adjusting for read or write performance, or for hot or cold path data processing. Inevitably, the need to adjust configurations from the default will arise. So, how do we do this effectively?

# Spark Session vs. Delta Table Configurations
## Configuration Scopes Explained
I decided to blog about this topic after encountering a job writing to partitioned tables that ran 10x slower than expected and queries that were over 6x slower. I obviously had a _"small-file"_ problem at hand. Initially, I thought the issue could be resolved by enabling Optimize Write at the table level, assuming it would always be leveraged. However, I soon realized that the session-level config was disabled which takes precedence, meaning the Delta table property I added had no functional effect. 

## Hierarchy of Precedence and Scopes
The following order determines which configuration is applied when there’s a conflict:
1. **Spark Session-Level Configurations** (Highest Priority): (e.g., spark.databricks.delta.optimizeWrite.enabled) are global for the duration of the Spark session.
    - **Scope**: These configurations apply globally across all operations within the active Spark session but can be overriden by some DataFrameWriter options.
    - **Use Cases**: Ideal for cluster-wide defaults or platform-level behavior, ensuring consistency across multiple jobs.

    ```python
    spark.conf.set('spark.databricks.delta.autoCompact.enabled', 'true')
    ```
    or
    ```sql
    SET spark.sql.parquet.vorder.enabled = TRUE
    ```

1. **DataFrameWriter Options**: Settings applied directly in the DataFrameWriter (e.g., .option("optimizeWrite", "true")). Some writer options override both session-level and table-level configurations.
    - **Scope**: Apply only during the execution of a specific write operation.
    - **Use Cases**: Best for ad-hoc or one-off scenarios where temporary overrides are needed without altering global or table-level settings.

    _Example_:
    ```python
    df.write.option('optimizeWrite', 'true').saveAsTable('dbo.t1')
    ```

1. **Table-level properties** (e.g., delta.autoOptimize.optimizeWrite) are settings tied to the specific table. Tables have three functional types of properities:
    1. **Persistent**: Applied permanently, will be enforced across any writer (or reader) until the feature is dropped. Session and DataFrameWriter configs do not override the function of the feature.

        _Examples_:
        - delta.enableChangeDataFeed
        - delta.enableDeletionVectors
        - delta.logRetentionDuration
        - delta.checkpointInterval

    1. **Transient**: Features that apply by default if a session or DataFrameWriter setting does not override it.

        _Examples_:
        - delta.parquet.vorder.enabled
        - delta.autoOptimize.optimizeWrite
        - delta.autoOptimize.autoCompact
        - delta.schema.autoMerge.enabled

    1. **Symbolic**: Any arbitrary key-value pair, these don't determine the function of the table but enrich the table with supporting metadata.
        
    ```sql
    CREATE TABLE dbo.table_with_properties
    TBLPROPERTIES (
        'delta.enableChangeDataFeed' = 'true', --persistent
        'delta.autoOptimize.autoCompact' = 'true', --transient
        'foo' = 'bar' --symbolic
    )
    ```

    Any table property can be retrieved via running: 
    ```sql
    SHOW TBLPROPERTIES dbo.table_with_properties
    ```
    
    **Why the deliniation between persistent and default?**:
    - **Persistent Table Properties**: Designed for features that are core to table behavior and must persist across sessions and jobs.
    - **Transient Table Properties**: Offer runtime flexibility based on workload types, allowing configurations to be customized for specific Spark jobs.

### Why Do Multiple Scope Exist?
- **Flexibility**: Different workloads require different optimization strategies, and multiple scopes allow fine-tuning.
- **Isolation**: Ensures that provided that global settings don't set a precedence, table-specific requirements are respected and isolated.
- **Compatibility**: Supports the evolving needs of distributed systems where various users and tools interact with the same datasets.

## Key Configurations

| Feature                | Session-Level Config                                             | DataFrameWriter Option                   | Table-Level Config               |
| ---------------------- | ---------------------------------------------------------------- | ---------------------------------------- | -------------------------------- |
| Optimize Write         | spark.databricks.delta.optimizeWrite.enabled                     | option('optimizeWrite', 'true')          | delta.autoOptimize.optimizeWrite |
| Auto Compaction        | spark.databricks.delta.autoCompact.enabled                       | option('autoCompact', 'true')            | delta.autoOptimize.autoCompact   |
| Change Data Feed (CDC) | spark.databricks.delta.properties.defaults.enableChangeDataFeed  |                                          | delta.enableChangeDataFeed       |
| Schema Auto-Merge      | spark.databricks.delta.schema.autoMerge.enabled                  |                                          | delta.schema.autoMerge.enabled   |
| Log Retention Duration | spark.databricks.delta.logRetentionDuration                      |                                          | delta.logRetentionDuration       |
| Checkpoint Interval    | spark.databricks.delta.checkpointInterval                        |                                          | delta.checkpointInterval         |
| Deletion Vectors       | spark.databricks.delta.properties.defaults.enableDeletionVectors |                                          | delta.enableDeletionVectors      |
| V-Order                | spark.sql.parquet.vorder.enabled                                 | option('parquet.vorder.enabled', 'true') | delta.parquet.vorder.enabled           |

You'll notice the DataFrameWriter options only eixsts for transient writer settings.

## Precedence Rules: What Happens When They Conflict
### Optimized Write Example
What happens when the session-level config for _Optimize Write_ is disabled, but the Delta table property `delta.autoOptimize.optimizeWrite` is enabled? 
```python
spark.conf.set('spark.databricks.delta.optimizeWrite.enabled', 'false')

spark.sql("""
    CREATE TABLE dbo.ow_is_not_enabled PARTITIONED BY (country_sk)
    TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true')
    AS SELECT 1 as country_sk
""")
```
As hinted earlier, the session-level config takes precedence. Although the table has the Optimized Write property enabled, writes to the table will **not** use the Optimized Write feature. To control this setting on a table-by-table basis, we should **unset** the session-level config so that we can selectively enable the setting only for partitioned tables.

```python
spark.conf.unset('spark.databricks.delta.optimizeWrite.enabled')

spark.sql("""
    CREATE TABLE dbo.ow_is_now_enabled PARTITIONED BY (country_sk)
    TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true')
    AS SELECT 1 as country_sk
""")
```
### V-Order Example
There are exceptions to the standard precedence rule for transient writer configs. In the example below, we have V-Order enabled at the session level, but when writing to a table using the DataFrameWriter, we attempt to disable V-Order. The result is that the table is still written with the V-Order optimization. This is an exception where the session-level config **always takes precedence** when set.

```python
spark.conf.set('spark.sql.parquet.vorder.enabled', 'true')

df.write.option('parquet.vorder.enabled', 'false').saveAsTable('dbo.vorder_is_enabled')
```

To allow for defining V-Order for individual tables on an _opt-in_ basis we have to unset a two session-level configs so that they don't take precedence over the DataFrameWriter, or better yet, the table property:
```python
spark.conf.unset('spark.sql.parquet.vorder.enabled') # session-level config | priority #1
spark.conf.unset('spark.sql.parquet.vorder.default') # session-level config which sets V-Order as default for the DataFrameWriter option | priority #2, takes precedence if the prior config is unset and the DataFrameWriter option is not defined

# SCENARIO 1
df.write.saveAsTable('dbo.vorder_is_not_enabled') # NOT ENABLED since we didn't define the DataFrameWriter option and the session-level configs are unset

# SCENARIO 2
df.write.option('parquet.vorder.enabled', 'true').saveAsTable('dbo.vorder_is_enabled') # ENABLED since we specified the DataFrameWriter option as enabled

# SCENARIO 3
spark.sql("""
    CREATE TABLE dbo.vorder_is_enabled
    TBLPROPERTIES ('delta.parquet.vorder.enabled' = 'true')
    AS SELECT 1 as c1
""") # ENABLED since we specified the table property and higher precedence configs are not defined
```

## Best Practices for Config Management
Given the precedence hierarchy, evaluate which configurations should be applied table-by-table or as a default behavior for writers and sessions.

For writer features that do not automatically enable the feature as a table property, these configs should always be defined as table properties. V-Order is an example of a feature that automatically enables the table property if set at the session or DataFrameWriter level:
```python
spark.conf.get('spark.microsoft.delta.parquet.vorder.property.autoset.enabled') # if a table is written to with V-Order optimizations and the table property is not already set, it will enable it
```
### Why This Matters
Some properties do not automatically apply as table properties, risking inconsistent writes from other sessions or writers. Optimized Write and Auto Compaction are examples where enabling them via session or DataFrameWriter options does not persist the setting as a table property. This can cause serious issues.
#### Example: Risk of Inconsistent Writes
- **Session 1**:
    ```python
    df.write.option("optimizeWrite", "true").partitionBy("country_sk").saveAsTable("dbo.partitioned_table")
    ```

- **Session 2**:
    ```python
    spark.conf.unset('spark.databricks.delta.optimizeWrite.enabled') # OR spark.conf.set('spark.databricks.delta.optimizeWrite.enabled', 'false')

    df.writeTo("dbo.partitioned_table").append()

    spark.sql('OPTIMIZE dbo.partitioned_table')
    ```

**What Happens?**
- Session 1 successfully creates a partitioned table using Optimized Write.
- Session 2, with different session-level defaults, appends without Optimized Write.
- The OPTIMIZE command rewrites the entire table, worsening the small file problem.

### The Solution: Use Table Properties
Rely on table properties where possible and avoid session-level defaults for settings that won’t be used consistently across your environment.

#### Corrected Example Using Table Properties:
- **Session 1**:
    ```python
    spark.sql("""
        CREATE TABLE dbo.partitioned_table PARTITIONED BY (country_sk)
        TBLPROPERTIES ('delta.autoOptimize.optimizeWrite' = 'true')
        AS SELECT * from df_tempview
    """)
    ```

- **Session 2**:
    ```python
    spark.conf.unset('spark.databricks.delta.optimizeWrite.enabled') # OR spark.conf.set('spark.databricks.delta.optimizeWrite.enabled', 'false')

    df.writeTo("dbo.partitioned_table").append()

    spark.sql('OPTIMIZE dbo.partitioned_table')
    ```
In this scenario, since the Delta table itself has the transient `delta.autoOptimize.optimizeWrite` feature enabled, Session 2, which does not define whether Optimized Write is used at the session or DataFrameWriter level, the optimization is still applied due to the Delta table property. 

> When properties like Optimized Write and Auto Compaction are enabled at the table level, Spark automatically applies them when the DataFrameWriter or session configs are unset. This ensures consistent writes and simplifies troubleshooting by making table metadata a source of truth for data layout properties.

### General Best Practices
**Use Table Properties for Long-Term Consistency**
- **Why**: Table properties persist across sessions, ensuring consistent behavior across all jobs and writers.
- **Best Practice**: Always set critical features like `delta.autoOptimize.autoCompact` or `delta.autoOptimize.optimizeWrite` as table properties to avoid reliance on consistent session configurations across various writers.

**Minimize Session-Level Configs**
- **Why**: Session-level configs only apply to the current Spark session and can cause unexpected results if forgotten or if other writers use different session configs.
- **Best Practice**: Use session-level configs only for temporary testing or configurations that should be applied platform-wide.

**Use DataFrameWriter Options Selectively**
- **Why**: DataFrameWriter options only apply to the current write operation and do not persist across sessions.
- **Best Practice**: Only use DataFrameWriter options if the feature supports automatically enabling the corresponding table property (e.g., parquet.vorder.enabled for V-Order). Otherwise, restrict their use to testing or ad-hoc writes, where applying the same feature for future writes does not matter.

## Retrieving Active Configs
Given that it is important to understand what session-level configurations are set and what the active values are, the below function can be extremely handy as it will return a dictionary of key-value pairs which can easily be viewed in whole or queried. Kuddos to this [Stack Overflow Post](https://stackoverflow.com/questions/76986516/how-to-retrieve-all-spark-session-config-variables) for the source code.

```python
def get_spark_session_configs() -> dict:
    scala_map = self.spark.conf._jconf.getAll()
    spark_conf_dict = {}

    iterator = scala_map.iterator()
    while iterator.hasNext():
        entry = iterator.next()
        key = entry._1()
        value = entry._2()
        spark_conf_dict[key] = value
    return spark_conf_dict
```

With this function we can now create a dictionary variable that encompasses all session configs and easily query the dictionary to check for how configs are set:

```python
spark_configs = get_spark_session_configs()

print(spark_configs['spark.databricks.delta.optimizeWrite.enabled']) # if we want to throw an error if the config is not set

print(spark_configs.get('spark.databricks.delta.optimizeWrite.enabled', 'unset')) # if we want to gracefully handle configs not being set
```