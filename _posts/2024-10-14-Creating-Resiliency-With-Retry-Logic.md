---
layout: post
title: "Mastering Spark: Creating Resiliency with Retry Logic"
tags: [Fabric, Spark, Lakehouse, Optimization]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-padrinan-2882552.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-padrinan-2882552.jpeg"
published: True
---

In any programming environment, handling unreliable processes—whether due to API rate limiting, network instability, or transient failures—can be a significant challenge. This is not exclusive to Spark but applies to distributed systems and programming languages across the board. In this post, we’ll focus on Python (since I’m a PySpark developer) and explore how to make any unstable process more resilient by leveraging the open-source library _Tenacity_. By adding strategic retry logic with exponential backoff, we can gracefully handle API throttling, server-side failures, and network interruptions to build more robust and fault tolerant solutions.

# How to Handle Throttling and other Transient Failures
In my prior post where I illustrated [how to parallelize running thousands of API calls](https://milescole.dev/data-engineering/2024/10/11/Parallelizing-Non-Distributed-Tasks.html) to _TheCatAPI_ service, I was fine simulating the throttled API calls to mimic the duration of a successful call. But what should you do when working in production scenarios when dealing with unstable or rate-limited APIs?

While it’s not overly complex to write your own retry logic with exponential backoff to handle API failures or throttling, the open-source library Tenacity makes things significantly easier. The great news is that [Tenacity](https://tenacity.readthedocs.io/en/latest/) is included as part of the Fabric Spark Runtime, so you have access to it out of the box.

## Using Tenacity for Retry Logic
Before integrating Tenacity into the `get_cat_json()` function, let’s walk through a basic example. In the function below, I simulate a _ConnectionError_ by randomly failing a connection to an unstable database. Run it a couple of times, and statstically, you'll encounter a _ConnectionError_.
```python
import random

def connect_to_database():
    if random.choice([True, False]):
        raise ConnectionError("Failed to connect to database")
    else:
        return "Connected to database successfully!"

connect_to_database()
```

With _Tenacity_, we can add the `@retry()` decorator to automatically retry the function when it fails. With just two additional lines, we now have a policy ensuring that the `connect_to_database()` function eventually succeeds.

```python
import random
from tenacity import retry # Import retry module from tenacity

@retry() # The retry decorator is added before the function we want to retry
def connect_to_database():
    if random.choice([True, False]):
        raise ConnectionError("Failed to connect to database")
    else:
        return "Connected to database successfully!"

connect_to_database()
```

In real-world scenarios, however, it’s not a good idea to retry tasks infinitely. Unstable operations should have controlled retry conditions to avoid overwhelming the system, service, or resulting in the application being in an infinite loop. _Tenacity_ provides simple decorator options to configure the retry logic for specific conditions.

### A Practical Retry Strategy with Tenacity
For our use case of making API calls more robust, we’ll configure Tenacity with the following criteria:
1. **Only server-side and throttling exceptions** should trigger a retry.
1. **Eponential backoff**: subsequent retries should increase the wait time.
1. **Retry a maximum of 5 times** before giving up.

Here’s how we can implement this with _Tenacity_ to make the `get_cat_json()` function more robust:

```python
import requests
import json
from tenacity import *

api_key = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
generate_n_rows = 1000

@retry(
    retry=retry_if_exception_type(requests.exceptions.RequestException),  # Retry on RequestException only
    wait=wait_exponential(multiplier=1, min=5, max=60),  # Exponential backoff for retries
    stop=stop_after_attempt(5)  # Stop after 5 attempts
)
def get_cat_json(_):
    try:
        response = requests.get(f"https://api.thecatapi.com/v1/images2/search?limit=1&has_breeds=true&api_key={api_key}")

        # Ensure response is successful before parsing content
        if response.status_code != 200:
            response.raise_for_status()

        cat_json = json.loads(response.content)[0]

        breeds = cat_json.get("breeds", [])
        return (breeds, cat_json.get("id", None), cat_json.get("url", None), 
                cat_json.get("width", None), cat_json.get("height", None))
    except requests.exceptions.HTTPError as e:
        # Raise a RequestException for non-client-side errors and user thorrling to trigger a retry
        if response.status_code not in (400, 401, 403, 404, 405):
            raise requests.exceptions.RequestException(e)
        else:
            raise
```
In this configuration:
- `retry_if_exception_type(requests.exceptions.RequestException)` in conjunction with categorizing specific errors (`response.status_code not in (400, 401, 403, 404, 405)`) ensures that retries only happen for server-side or network-related errors.
- **Exponential backoff** waits longer between each retry, starting at 5 seconds and capping at 60 seconds.
- The retry policy will stop after **5 failed attempts** to prevent infinite retries.

# Other Use Cases for Retry Logic
While the API call use case is super easy to illustrate as almost all APIs have some sort of rate limiting which can quickly result in failures, there's two other scenarios where I wouldn't hesitate to fold in retry policies for:
- **Database connections**: Network failures are inevitable, regardless of the driver or database you're using. By incorporating retries with exponential backoff, you can safeguard against transient network issues and ensure that temporary connectivity problems don't cause permanent failures in your pipeline.
- **Notebook Utilities**: often times Notebook Utilities (i.e. `notebookutils` in Fabric and `dbutils` in Databricks) are backed by APIs, thus specific method can be subject to rate limiting. If you experience any rate limiting, assuming that there isn't an alternative method that isn't API based, use _Tenacity_ to avoid the scenario where rate limiting causes data pipelines to fail.
- **Potentially Conflicting Writes**: In situations where multiple applications or users are writing to the same Delta table simultaneously, write conflicts can occur. By adding a retry policy, you can handle these conflicts gracefully and avoid failures when trying to append or update data in highly concurrent environments.

# Production-Level API Resilience
Whether you’re making API calls serially on the driver, using multithreading, or leveraging Spark’s parallelization with `parallelize()` or a UDF, _Tenacity_ is a extremely valuable library for adding resiliance to any unstable process. By introducing retry logic and exponential backoff, you can handle throttling and intermittent failures, increasing the chances of successful API requests even in unstable environments.