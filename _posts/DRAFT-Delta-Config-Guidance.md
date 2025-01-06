
# Guidance on Core Delta Configs That Impact Performance 
While there are always exceptions, the vast majority of workloads would be well suited to adhere to the following recommendations. For anything not listed, the existing default configuration typically shouldn't need to be changed.

| Feature          | Recommendation | Session Level Config Change (if appliable on Fabric Spark Runtime 1.3) | Writer Code Change (if applicable) |
| -----------------| ---------------|------------------------------------------------------------------------|------------------------------------|
| V-Order          | Default to _opt-in_ rather than _opt-out_ by disabling at session-level. Enable at the table level only for Direct Lake Semantic Models where Power BI performance should be prioritized over availability SLAs (time to make data available from source to reporting layer). | `spark.conf.set('sql.parquet.vorder.default', 'false')` |  `option('parquet.vorder.enabled', 'true')` OR `TBLPROPERTIES ('delta.parquet.vorder.enabled', 'true')`                                 |
| Deletion Vectors | Enable at the session-level since it is generally always beneficial. | `spark.conf.set('spark.databricks.delta.properties.defaults.enableDeletionVectors', 'true')` | To enable on existing tables:  `ALTER TABLE ... SET TBLPROPERTIES ('delta.enableDeletionVectors', 'true')` |
| Optimize Write   | Unset at the session-level. **Only enable for partitioned tables!** | `spark.conf.unset('spark.databricks.delta.optimizeWrite.enabled')` | `TBLPROPERTIES ('delta.autoOptimize.optimizeWrite', 'true')` |
| Auto Compaction  | Leave it unset at the session-level. Enable for tables where writes are latency-insensitive and have frequent small operations. | | `TBLPROPERTIES ('delta.autoOptimize.autoCompact', 'true')` |
