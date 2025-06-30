---
layout: post
title: "Announcing: 🌊 LakeBench v0.1"
tags: [Fabric, Spark, Lakehouse, Delta Lake, DuckDB, Polars, Daft]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-danielspase-2091351.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-danielspase-2091351.jpeg"
published: False
---

I'm excited to announce **LakeBench**, v0.1, the first Python-based multi-modal benchmarking library that supports multiple data processing engines on multiple benchmarks. You can find it on [GitHub](https://github.com/mwc360/LakeBench) and [PyPi](https://pypi.org/project/lakebench/). 

Traditional benchmarks like TPC-DS and TPC-H focus heavily on analytical queries, but they miss the reality of modern data engineering: building **complex ELT pipelines**. LakeBench bridges this gap by introducing **novel benchmarks** that measure not just query performance, but also data loading, transformation, incremental processing, and maintenance operations. The first of such benchmarks is called _ELTBench_ and is initially available in `light` mode.

While the beta release focuses on _code-first data processing engines available in Microsoft Fabric_, the stable release milestone is planned to include additional benchmarks (i.e., ELTBench in full mode, AtomicELT, potentially ClickBench) and other data processing engines available in Azure.

While there are other benchmarking projects out there, I designed LakeBench with a few key things in mind, which in total, make it unique:
1. **Python**: While most data engineering benchmarking projects are Scala or Java-based, I created LakeBench as a Python project to make it the most easily accessible benchmarking library available. No need to build and package the binaries, just `%pip install lakebench` directly from PyPi.
1. **Multiple modalities**: Most projects (with the exception of Lake Loader by the OneHouse team, which is Scala-based) are a one-trick pony. They either focus on supporting many engines (i.e., ClickBench), focus on multiple benchmarks, or maybe they just do one thing well—one engine that runs one benchmark. I designed LakeBench to solve for the challenges that come with the intersection of combining many benchmarks with many engines. As you combine the two, you multiply the possible scenarios that code needs to account for. However, by doing a few key things listed below, it becomes possible, and dare I boldly say on the day of its beta release: _maintainable_.
    - **Separation of engine configuration from the benchmark protocol**: When benchmarking different systems, you want to ensure they all follow the same standards. This is why there are distinct Benchmarking classes that are abstracted away from the actual code implementation. This way, a benchmark can be defined in an abstract way, with the actual operation being handled by the required engine instance that must be passed in as a variable. 
    - **Support for both benchmark-specific code paths and shared generic engine methods**: Each benchmark subclass maintains a _benchmark implementation registry_ (`self.BENCHMARK_IMPL_REGISTRY`), which defines which engines are supported and optionally maps benchmark-specific code to be used by the respective engine. Some benchmarks will have very custom code (i.e., `ELTBench`), while others (`TPCDS` and `TPCH`) use entirely generic methods contained in the engine class (i.e., `load_parquet_to_delta()`, `execute_sql_query`, `optimize_table()`). This provides the flexibility that generic stuff only needs to be defined once and can be used across many benchmarks, whereas code can be very custom as needed for novel benchmarks.
1. **Self-contained data generation**: Data required by the various benchmarks can be generated via LakeBench DataGenerator classes. DuckDB is used today for the data generation. The LakeBench wrapper around DuckDB provides additional functionality to target specific row group sizes in MB, whereas DuckDB only supports specifying the target count of rows. Targeting row group sizes in MB is extremely important for benchmarking to avoid having row groups that are too small. Both TPC-DS and TPC-H parquet datasets can be created in minutes.
1. **Robust telemetry**: LakeBench captures key information, including the size of the compute leveraged, total number of cores, and other data points. LakeBench will also soon support extended engine-specific telemetry (i.e., leveraging SparkMeasure for Spark) logged into a single struct column so that each engine can log what is needed without having a schema maintenance nightmare.

## Running a benchmark is now as simple as:

### Install LakeBench from PyPi
```python
%pip install lakebench[duckdb]
```

### One-Time Data Generation

```python
from lakebench.datagen.tpcds import TPCDSDataGenerator

datagen = TPCDSDataGenerator(
    scale_factor=1,
    target_mount_folder_path='/lakehouse/default/Files/tpcds_sf1'
)
datagen.run()
```

### Run Benchmark: TPC-DS Power Test

```python
from lakebench.engines.duckdb import DuckDB
from lakebench.benchmarks.tpcds import TPCDS

engine = DuckDB(
    delta_abfss_schema_path='abfss://.........../Tables/duckdb_tpcds_sf1'
)

benchmark = TPCDS(
    engine=engine,
    scenario_name="SF1 - Power Test",
    parquet_abfss_path='abfss://........./Files/tpcds_sf1',
    save_results=True,
    result_abfss_path='abfss://......../Tables/dbo/results'
)
benchmark.run(mode="power_test")
```

### Run Benchmark: ELTBench in `light` Mode

```python
from lakebench.engines.duckdb import DuckDB
from lakebench.benchmarks.elt_bench import ELTBench

engine = DuckDB(
    delta_abfss_schema_path='abfss://.........../Tables/duckdb_eltbench_test'
)

benchmark = ELTBench(
    engine=engine,
    scenario_name="SF1",
    tpcds_parquet_abfss_path='abfss://........./Files/tpcds_sf1',
    save_results=True,
    result_abfss_path='abfss://......../Tables/lakebench/results'
)
benchmark.run(mode="light")
```

## Q&A
1. **Why didn't you use Ibis to write engine-abstracted generic DataFrame transformations?**: In concept, part of what I'm doing is quite similar to the aim of the [Ibis](https://ibis-project.org/) project. However, I didn't use Ibis for a few reasons:
    - I wanted to maintain full control and provide transparency over the engine-specific code leveraged in all benchmarking scenarios (without users having to drill into another project and understand a much larger code base).
    - Ibis doesn't support all of the engines that I wanted LakeBench to support in the beta release (Daft) or in the planned stable milestone.
    - I don't intend for the scope of what LakeBench supports to be anywhere near Ibis.
    - Ibis can add additional latency or possibly even inefficiencies as Ibis DataFrame APIs are translated to the backend engine leveraged.
1. **I don't like the way __ was implemented for engine __, what can I do about it?**: Please submit a PR if you are comfortable, or minimally log an [Issue](https://github.com/mwc360/LakeBench/issues).

Cheers!
