---
layout: post
title: "Mastering Spark: UDFs vs. Parallelize for APIs"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-17483907.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-17483907.jpeg"
published: False
---

Spark is fantastic for distributed computing but can it help with tasks that are not distributed in nature? Reading from a Delta table or similar is simple, Spark APIs natively parallelize these type of tasks, but what about user defined tasks that are not distributed?

In this post, I'm going to show how you can take advantage of the distributed nature of spark for non-Spark native tasks.

# Parallelizing Any Operation
Fill the blank... ___, you have some sort of operation that runs in Python that takes too long to run, simply because of the volume of processes that are run serially. A very typical use case is making API calls. Maybe you're starting with a large array of IDs and you need to make an API call for each ID, collate and save the API responses.

Before we dig into the couple different ways we can distribute such an task, let's frame up the example use case: cats! Honestly, I'm not a fan of cats, however my children love them and coincidentally there's a pretty neat API called _TheCatAPI_. Yes, an API for cats - well not for cats, as cats aren't programmers, however the API returns information about cats. Fun!

My goal is to see how quickly I can make 1000 API calls to the TheCatAPI and then save the JSON structure with completely useless information about cats to OneLake for further cat analysis.

## Why would we distribute such a task?
To start with the results of the non-distributed method, running the below code takes nearly 10 minutes. That's an average of 600 milliseconds per API call.

```python
data = []
def get_random_json_data():
    import requests
    import json
    try:
        response = requests.get(f"https://randomuser.me/api/")
        json_content = json.loads(response.content)
        results = json_content.get('results')[0]
        data.append(results)
        return
    except Exception as e:
        print(str(e))

for i in range(1000):
    get_random_json_data()

df = spark.createDataFrame(data)
df.write.saveAsTable(name="api_data_serial", mode="overwrite")

```

There's two options for parallelizing the API calls in Spark. We could use `parallelize` or use a PySpark `udf`.

Staring with `parallelize`

## Parallelize

```python

```

## UDFs
Processing this as a scalar UDF, this took 30 seconds.
```python
import pyspark.sql.functions as sf
from pyspark.sql.types import *

schema = StructType(
    [
        StructField("cell", StringType(), True),
        StructField("dob", MapType(StringType(), StringType(), True), True),
        StructField("email", StringType(), True),
        StructField("gender", StringType(), True),
        StructField("id", MapType(StringType(), StringType(), True), True),
        StructField(
            "location",
            MapType(StringType(), MapType(StringType(), LongType(), True), True),
            True,
        ),
        StructField("login", MapType(StringType(), StringType(), True), True),
        StructField("name", MapType(StringType(), StringType(), True), True),
        StructField("nat", StringType(), True),
        StructField("phone", StringType(), True),
        StructField("picture", MapType(StringType(), StringType(), True), True),
        StructField("registered", MapType(StringType(), StringType(), True), True),
    ]
)

def get_random_api_data(_):
    import requests
    import json
    try:
        response = requests.get(f"https://randomuser.me/api/")
        json_content = json.loads(response.content)
        results = json_content.get('results')[0]
        return results
    except Exception as e:
        print(str(e))

get_random_api_data_udf = sf.udf(get_random_api_data, schema)
df = spark.range(1000) \
    .withColumn("response", get_random_api_data_udf(sf.col("id"))) \
    .drop(sf.col("id")) \
    .select("response.*")
df.write.saveAsTable(name="api_data_udf", mode="overwrite")
```

