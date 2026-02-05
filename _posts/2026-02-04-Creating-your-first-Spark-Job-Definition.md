---
layout: post
title: "Creating your first Spark Job Definition"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-25626517.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-25626517.jpeg"
published: True
---

Coming from a notebook-first Spark background, I wanted to write the introduction to Spark Job Definitions (SJDs) that I wish I had when I first encountered them. If you are first interest in _why_ you might want to use a Spark Job Definition over a Notebook, see my blog [here](https://milescole.dev/data-engineering/2026/02/04/Notebooks-vs-Spark-Jobs-in-Production.html).

My first job was in finance, and I learned Spark much later while consulting in environments where **everything ran in notebooks**. That wasn't unique to any one company — it's simply how most consulting teams work. So when I first opened a Spark Job Definition while exploring additional things I could do in Synapse, my reaction was:

> “Wow… what the heck is this thing?”

This post is meant for anyone who learned Spark through notebooks and is now staring at SJDs wondering what role they play and how to use them. Think of this as a bridge from interactive development to job-based execution.

# What Is a Spark Job Definition?

A Spark Job Definition is effectively a way to run a packaged Spark application, Fabric's version of executing a `spark-submit` job. You define:

- what code should run (the **entry point**),
- which code files or resources should be shipped with it,
- and which **command-line arguments** should control its behavior.

Unlike a notebook, there is no interactive editor or cell output, but this is arguably not a missing feature, it's the whole point... an SJD is not meant for exploration; it is meant to deterministically run a Spark application.

You can think of it as:

**Notebook = interactive development environment (IDE)**  
**SJD = execution mechanism**

## Core Concepts

At a high level, creating an SJD revolves around five things which you will commonly configure:

1. **Entry Point** – the `.py`, `.scala`, or `.r` file that Spark executes
2. **Reference Files** [OPTIONAL] – additional `.py`, `.scala`, or `.r` files that can be referenced from your entry point via `import module_name`.
3. **Command-Line Arguments** [OPTIONAL] – runtime parameters
4. **Lakehouse Reference** – the default metastore context for tables 
4. **Environment Reference** – the Environment context that includes public and custom libraries, Spark pool (a.k.a. cluster) configuration, spark configs, and reference files 

If you understand the purpose of each of these, you will be well on your way to running your first successful SJD.

# So Where Do I Start?

Start by developing your Spark logic either in a notebook or, ideally, in a local IDE like VS Code. Write modular code that can be packaged as a Python Wheel or JAR.

Once your logic works locally or in a notebook, create a small standalone file whose job is to:

- import your package,  
- initialize Spark and logging,  
- and run the main executable logic.

At its simplest, this could look like:

```python
from pyspark.sql import SparkSession

spark = (
    SparkSession
        .builder
        .appName("myApp")
        .getOrCreate()
)

spark.range(1).write.saveAsTable("dbo.test")
```

But for production use, it's better to structure this code more explicitly. In particular, it helps to:

- configure logging,  
- contain executable code in a `main()` function,  
- and use a *main guard*.

That separates code meant to run when the file is executed from code meant to be imported and reused (for example, in unit tests).

```python
from pyspark.sql import SparkSession
import sys
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

def main() -> None:
    spark = (
        SparkSession
            .builder
            .appName("myApp")
            .getOrCreate()
    )

    spark.sparkContext.setLogLevel("ERROR")

    logger.info("=" * 80)
    logger.info("Starting...")
    logger.info("=" * 80)

    # Executable code goes here

    logger.info("=" * 80)
    logger.info("Completed...")
    logger.info("=" * 80)

if __name__ == "__main__":
    main()
```

# What About Parameterization?

There are two methods available, both of which are frequently used as they serve different but potentially overlapping use cases.

## 1. Configuration Data

For configuration-driven pipelines (for example, a list of objects or tables to process), YAML files are highly recommended. They are readable, easy to edit, and trivial to parse using the [`pyyaml`](https://pypi.org/project/PyYAML/) library. For you Rust lovers out there, there's even a Rust based [pyyaml-rs](https://pypi.org/project/pyyaml-rs/) library in case your config data is massive.

```yml
tables:
  - name: table_1
    config1: ....
  - name: table_2
    config1: ....
    dependencies:
      - table_1
```

These files can either be built into your Python Wheel or JAR (for tight coupling of framework and configuration), or staged in OneLake and imported via full ABFSS path or default Lakehouse reference.

```python
import yaml

with open('File/...', "r") as f:
    table_registry = yaml.safe_load(f)
```

## 2. Runtime Control Flow

For higher-level control flow, the kind of things you normally override in a notebook cell via Pipeline parameters, you should use **command-line arguments**.

This was the biggest learning gap for me. Instead of overwriting variables in a chosen parameter cell, your application must *expect* arguments and validate them.

```python
import argparse

def parse_args(argv):
    p = argparse.ArgumentParser()
    p.add_argument("--zone", type=lambda s: s.lower(), required=True)
    p.add_argument("--load-group", type=int, default=0)
    p.add_argument("--config-file-url", required=True)
    p.add_argument("--compression", choices=["snappy", "zstd"], default="snappy")
    p.add_argument("--debug", action="store_true")

    return p.parse_args(argv)
```

The `argparse` library that comes included in Python gives you validation, help text, and type enforcement without boilerplate. See the [docs](https://docs.python.org/3/library/argparse.html) for all of the creative ways your can control and constrain inputs.

Your arguments are then provided to the SJD like this:

```bash
--zone bronze --load-group 1 --config-file-uri Files/.../table_registry.yml --compression zstd --debug
```

And parsed inside your executable:

```python
import sys

def main() -> None:
    args = parse_args(sys.argv[1:])
```

Which exposes them as attributes of a named Python object (i.e. `args`):

```python
args.zone
args.load_group
args.config_file_uri
args.compression
args.debug
```

> The neat thing about this seemingly more complex parameterization process is that there's clear deliniation between variables that are inputs since it is self contained as a Python object (i.e. `args`). When doing Notebook development, deliniation between input parameters and regular Python variables is 100% up to developer hygene in consistently applied naming conventions.

---

# Additional Gotchas

There's a few things that us notebook-developers take for granted because the notebook UX is all about convience and agility:

1. **`spark` is not automatically defined**

   A Spark session exists, but you must assign it:

   ```python
   from pyspark.sql import SparkSession

   spark = (
       SparkSession
           .builder
           .appName("myApp")
           .getOrCreate()
   )
   ```

2. **Common imports are not pre-imported for the user**

   Anything automatically injected into notebooks must be explicitly imported, such as:

   - `from pyspark.sql import SparkSession`
   - `import notebookutils`

SJDs make implicit behavior explicit — which is both the challenge and the benefit.

# Putting It All Together

A typical SJD entry point ends up looking something like this _(`my_elt_package` contains the the locally built and tested business logic, transformations, etc.)_:

```python
from pyspark.sql import SparkSession
import sys
import logging
import argparse

# import your python packge
from my_elt_package import Controller

# if using yaml for configs
import yaml 
def load_table_registry(path: str) -> dict:
    with open(path, "r") as f:
        table_registry = yaml.safe_load(f)
    return table_registry

def parse_args(argv):
    p = argparse.ArgumentParser()
    p.add_argument("--zone", type=lambda s: s.lower(), required=True)
    p.add_argument("--load-group", type=int, default=0)
    p.add_argument("--config-file-url", required=True)
    p.add_argument("--compression", choices=["snappy", "zstd"], default="snappy")
    p.add_argument("--debug", action="store_true", help="Enable DEBUG logging")
    return p.parse_args(argv)

def configure_logging(debug: bool) -> logging.Logger:
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )
    return logging.getLogger(__name__)

def create_spark(app_name: str, debug: bool) -> SparkSession:
    spark = (
        SparkSession
            .builder
            .appName(app_name)
            .getOrCreate()
    )
    spark.sparkContext.setLogLevel("INFO" if debug else "ERROR")
    return spark

def main(argv: list[str]) -> None:
    # parse input arguments
    args = parse_args(argv)

    # configure logging
    logger = configure_logging(args.debug)

    # assign SparkSession as variable
    spark = create_spark("myApp", args.debug)

    logger.info("=" * 80)
    logger.info(f"Starting load group {args.load_group} for zone {args.zone}...")
    logger.info("=" * 80)

    # main executable code
    table_registry = load_table_registry(args.config_file_uri)

    controller = Controller(
        spark=spark,
        config={
            load_group = args.load_group, 
            compression = args.compression
        },
        table_registry=table_registry
    )

    controller.run_pipeline(zone=args.zone)

    logger.info("=" * 80)
    logger.info(f"Completed load group {args.load_group} for zone {args.zone}...")
    logger.info("=" * 80)

if __name__ == "__main__":
    main(sys.argv[1:])
```

Because the executable logic lives inside `main()`, it can be imported and called from test suites or other programs:

```python
# some_other_file.py
import sjd_main as job

def test_bronze_is_created(spark):
    job.main(["--zone", "bronze", "--config-file-uri", "C:/user/dev/table_registry.yml", "--load-group", "1"])
    assert spark.catalog.tableExists("bronze.test_sjd")
```

Now you can make changes locally, run unit tests, and have high confidence that your job will behave the same way in the cloud. No need to blindly submit a job and cross your fingers :)


# How Do I Monitor a Spark Job?

With notebooks, you get cell output and visual cues. With SJDs, monitoring shifts to:

- the Spark UI for Spark execution details,  
- and `stdout` / `stderr` logs for application behavior.

Your logging configuration determines what you see. Prints become logs. Cell outputs become structured messages.

It's less visual — but more precise.

# Typical Development Flow

I plan to expand on this in a future post, but the high-level flow usually looks like:

1. Iterate on code locally or remote in a Fabric Notebook to develop a working PoC.
1. Formalize your PoC into a locally packaged library with unit tests.
1. Create a small entry-point script for execution.
1. Test the entry-point.
1. Attach the package to a Fabric Environment.
1. Create an SJD referencing the entry point, any reference files, command line arguments, Lakehouse and Environment reference.
1. Run 🚀

This development workflow will feel heavier than a notebook at first, but the requirement to develop with strong intentionality will provide you with a more reliable production solution. It buys you testability, repeatability, and modularity that are all critical for well designed Spark applications. 

Lastly, this development workflow is not for everyone or all projects. However, if you have already begun to explore packaging your code, and you want to take things to the next level, I highly enourage considering whether the rigor of a Spark Job Definition would force adopting more mature development habits that will result more reliable production jobs. 