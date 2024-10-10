---
layout: post
title: "Mastering Spark: Creating Resiliency with Retry Logic"
tags: [Fabric, Spark, Lakehouse, Optimization]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-17483907.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-17483907.jpeg"
published: False
---
In distributed systems, handling unreliable processes—whether due to API rate limiting, network instability, or transient failures—can be a significant challenge. In this post, we'll explore how to make any unstable process more resilient by leveraging the open-source library Tenacity. By adding robust retry logic with exponential backoff, we can gracefully handle API throttling, server-side failures, and network interruptions in a Spark environment. This post walks through practical strategies for improving the reliability of Spark workloads, whether you’re calling external APIs or managing any resource-intensive tasks prone to failure.

## How to Handle Throttling in Real-World Use Cases
In my case study, we were dealing with a non-real-world use case about cats, and I was fine simulating the throttled API calls to mimic the duration of a successful call. But what should you do when working in production scenarios with unstable or rate-limited APIs?

While it’s not overly complex to write your own retry logic with exponential backoff to handle API failures or throttling, the open-source library Tenacity makes this much easier. The great news is that [Tenacity](https://tenacity.readthedocs.io/en/latest/) is included as part of the Fabric Spark Runtime, so you have access to it out of the box.

### Using Tenacity for Retry Logic
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

With Tenacity, we can add the `@retry()` decorator to automatically retry the function when it fails. With just two additional lines, we can create a retry policy ensuring that the `connect_to_database()` function eventually succeeds.

```python
import random
from tenacity import retry

@retry()
def connect_to_database():
    if random.choice([True, False]):
        raise ConnectionError("Failed to connect to database")
    else:
        return "Connected to database successfully!"

connect_to_database()
```

In real-world scenarios, however, it’s not a good idea to retry tasks infinitely. Unstable operations should have controlled retry conditions to avoid overwhelming the system, service, or resulting in the application being in an infinite loop. Tenacity provides simple decorator options to configure the retry logic for specific conditions.

#### Practical Retry Strategy with Tenacity
For our use case of making API calls more robust, we’ll configure Tenacity with the following criteria:
1. **Only server-side and throttling exceptions** should trigger a retry.
1. **Eponential backoff**: subsequent retries should increase the wait time.
1. **Retry a maximum of 5 times** before giving up.
Here’s how we can implement this with Tenacity in the `get_cat_json()` function:

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
- `retry_if_exception_type(requests.exceptions.RequestException)` ensures that retries only happen for server-side or network-related errors.
- **Exponential backoff** waits longer between each retry, starting at 5 seconds and capping at 60 seconds.
- The retry policy will stop after **5 failed attempts** to prevent infinite retries.

#### Production-Level API Resilience
Whether you’re making API calls serially on the driver, using multithreading, or leveraging Spark’s parallelization with `parallelize()` or a UDF, Tenacity is a extremely valuable library for adding resiliance to any unstable process. By introducing retry logic and exponential backoff, you can handle throttling and intermittent failures, increasing the chances of successful API requests even in unstable environments.

# Closing Thoughts