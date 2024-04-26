---
layout: post
title: "Fabric Concurrency Showdown: RunMultiple vs. ThreadPool"
tags: [Fabric, Databricks, Delta Lake, Spark]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-kelly-2544989.jpeg"
thumbnail: "assets/img/feature-img/pexels-kelly-2544989.jpeg"
published: true
---

I recently blogged about [cluster configuration options in Spark and how you can maximize compute utilization and processing time](https://milescole.dev/optimization/2024/02/19/Unlocking-Parallel-Processing-Power.html). 

In this post I'll share the results of a benchmark I did comparing `RunMultiple` in Fabric vs. `ThreadPoolExecutor` (multi-threading via the Concurrency.Futures library).

# The RunMultiple vs. ThreadPool Showdown
## Methodology
To compare the performance of the two methods, I ran the N instances of a synthetic write operation. The number of jobs was set to equal the defined concurrency for both methods. To see how well each scales I ran 16, 32, 64, and 128 concurrent jobs.

## Setting up the Benchmark
There were three primary things I did to set this up:
1. Configure Spark Pool to have have sufficient nodes (5 for 1 driver and 4 executors) and disable _Dynamic Allocation_ to ensure that a fixed number of executors is used for each cluster config. Enabling _Dynamic Allocation_ with a min and max of 4 executors still results in the having potentially less than 4 executors allocated to the session.

    ![Dataframe Results](/assets/img/posts/RunMultiple-vs-ThreadPools/cluster-config.png)

1. Create Parent Notebook for executing both RunMultiple and ThreadPoolExecutor jobs.
1. Create Child Notebook with simple parquet write operation which the RunMultiple command will call.

The below code cell in the Parent Notebook defines the execution config of each test.

```python
import concurrent.futures
import pyspark.sql.functions as sf

spark.conf.set("spark.notebookutils.runmultiple.limit", 128)

instances = spark.conf.get("spark.executor.instances")
cores = spark.conf.get("spark.executor.cores")
print(f"{instances}x{cores}")

jobs = 128
concurrency = jobs
```
> As noted in the [Microsoft Documentation](https://learn.microsoft.com/en-us/fabric/data-engineering/microsoft-spark-utilities#reference-run-multiple-notebooks-in-parallel), the default upper limit of jobs that a RunMultiple command can support is 50. You can increase the limit as I did, however there's risk of stability and performance issues. I did have one instance of a `Failure to initilize the spark application` and a increasing cell timeouts when I went above 50, I was able to mitigate these failures by setting an unreasonably large cell timeout (`timeoutPerCellInSeconds` below).

In the below I use Python list comprehension to dynamically generate the RunMultuiple DAG.
```python
dag = {
    "activities": [
        {
            "name": f"Notebook{i}",
            "path": "RunMultiple_ChildJob",
            "timeoutPerCellInSeconds": 240,
            "args": {"job_id": i}
        }
        for i in range(1, jobs + 1)
    ],
    "concurrency": concurrency
}
mssparkutils.notebook.runMultiple(dag)
```
The below block of code is everything that runs for the ThreadPool method. We define a function (`write_job()`) and then submit _futures_ that call the function. The function generates a synthetic dataframe with 1M records that has a surrogate key and literal ID of the job. The child notebook for the RunMultiple has the same function.
```python
def write_job(job_id):
    df = spark.range(1000000)
    df = df.withColumn("sk", sf.monotonically_increasing_id()).withColumn("instance_id", sf.lit(job_id)).drop("id")
    df.write.mode("overwrite").parquet(f"abfss://<guid>@onelake.dfs.fabric.microsoft.com/<guid>/Files/benchmark/multithreading/{job_id}/")
    print(f"done: {job_id}")

with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
    # Submit all jobs to the executor
    futures = [executor.submit(write_job, job_id) for job_id in range(jobs)]
```

## Results
ThreadPools destroyed RunMultiple on the performance side of things. Regardless of the cluster config and number of concurrent jobs executed, ThreadPools consistently completed all operations about 5x faster then the RunMultiple command.

![Dataframe Results](/assets/img/posts/RunMultiple-vs-ThreadPools/method-chart.png)

I did test concurrency at all concurreny levels on both 2x8 and 4x8 clusters and as seen below, the results are nearly identical. I interpret the lack of improvement when increasing the number of executors is due to the reality that the workload of generating 1M rows of synthetic data is just too light to see an improvement with more compute available.

![Dataframe Results](/assets/img/posts/RunMultiple-vs-ThreadPools/cluster-chart.png)

## Observations
### Performance
To add context interpreting performance...

### Monitoring UI / UX
RunMultiple provides a **significantly** better user experience and interface for monitoring jobs. As seen in the GIF below, the UI has improved a lot lately to now include Fabric custom monitoring to show the progress of each task in addition to the ability to click into each to see the Notebook snapshot.

These Notebook snapshots also show up in the spark monitoring experience.

ThreadPools on the otherhand require the user to code logging functionality from scratch. Of course, this is entirely expected, `Concurrent.Futures`` is nothing more than a super powerful library for concurrent thread and process management. Building similar progress bar tracking capabilities as well as the ability to cancel in-progress or not yet stated _futures_ requires advanced Python coding skills and significant time for building and testing the framework.

### Development Pattern
- I like being able to programmatically generate a DAG
- I don't like that the code has to be in another notebook.

# Closing Thoughts

Is the RunMultiple monitoring experience worth a 5x less performant* solution? Ultimately this will depend on your workload and capability, however I believe it is significant enough to make it worth testing more code intensive methods like multithreading via the Concurrent.Futures library, especially if you have the Python experience.

_* Performance will vary based on your use case._