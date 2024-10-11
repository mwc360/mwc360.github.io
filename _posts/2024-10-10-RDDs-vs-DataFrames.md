---
layout: post
title: "Mastering Spark: RDDs vs. DataFrames"
tags: [Fabric, Spark]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-25626446.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-25626446.jpeg"
published: True
---

I was 95% done with writing a fun case study on how to parallelize API calls and other non-distributed tasks in Spark when I realized that I was about to gloss over a extremely foundational topic in Spark: RDDs. While most developers minimally understand the basics of DataFrames, RDDs are less commonly known, partly because they are a lower-level abstraction in Spark and DataFrames are full featured enough that you can often get away without needing to know what an RDD is.

For those niche scenarios where you really need to take full advantage of the Spark distributed architecutre, particularly for tasks that aren't natively distributed in nature, or are unstructured, understanding RDDs is a must. Let's dive in.

# Resiliant Distributed Datasets (RDDs)
An **[RDD (Resilient Distributed Dataset)](https://spark.apache.org/docs/latest/rdd-programming-guide.html)** is the core abstraction in Spark for handling distributed data and computation. It represents a distributed collection of objects across a Spark cluster. When an RDD is created, Spark builds a logical declaration (a lineage graph) of the transformations that will be applied to the data across a number of partitions. However, no data is processed or distributed at this stage. Once a triggering action occurs, Spark divides the data into partitions, and these partitions are then distributed across different worker nodes (executors) in the cluster. Each partition contains a subset of the data, which can then be processed in parallel by the executors.

## How RDDs Are Different Than DataFrames
While the definition I gave for an RDD might sound similar to a DataFrame, they are distinctly different abstractions in Spark, each serving different purposes with varying levels of control and use cases. RDDs are a lower-level API that provides fine-grained control over data processing but lacks the automatic optimizations that DataFrames offer. You can convert an RDD to a DataFrame, which results in the DataFrame being backed by the RDD in the lineage graph. However, a newly created DataFrame (e.g., via `spark.read()` or `spark.range()`) is not simply an abstraction of an RDD. Instead, it is part of an entirely different API, optimized for more efficient query execution and memory management.

DataFrames, by contrast, are a higher-level abstraction built on top of Spark’s execution engine. They allow Spark to perform optimizations using the _Catalyst optimizer_ and _Tungsten execution engine_, which make queries and operations on structured data faster and more efficient, particularly for SQL-like operations.

While both RDDs and DataFrames use lazy evaluation, DataFrames benefit from query optimization, where the Catalyst optimizer can reorganize and compress transformation steps for improved performance. RDDs, on the other hand, execute exactly as coded, with no such optimization.

Lastly, RDDs can handle things that DataFrames cannot, such as parallelizing native Python objects or working with complex, unstructured data. DataFrames, however, are limited to tabular datasets with predefined schemas, making them better suited for structured data processing.

| Feature                 | RDD                                        | DataFrame                                 |
|-------------------------|--------------------------------------------|-------------------------------------------|
| **Abstraction Level**   | Low-level                                  | High-level                                |
| **Ease of Use**         | More complex, lower-level coding (lambda)  | SQL-like, simpler syntax                  |
| **Schema**              | No schema                                  | Has schema                                |
| **Optimization**        | No automatic optimization                  | Catalyst query optimizer, Tungsten engine |
| **Performance**         | Slower for large datasets                  | Faster due to optimizations               |
| **Fault Tolerance**     | Yes (via lineage graph)                    | Yes (inherits from design of RDDs)        |
| **Use Case**            | Unstructured data, complex transformations | Structured data, SQL-like queries         |
| **Data Representation** | Distributed collection of objects          | Distributed table with schema             |

### What can I do with an RDD that I can't do with a DataFrame??
One thing you can do with an RDD but cannot do directly with a DataFrame is process arbitrary or complex objects (e.g., custom objects, deeply nested structures) without the need to enforce a tabular schema.

#### Example: Processing Arbitrary or Custom Objects with RDDs
Let’s say you have a custom class called `Person`, and you want to work with a collection of `Person` objects in Spark. You can do this directly with RDDs because they allow you to handle any type of Python object, including complex, nested, or custom types. DataFrames, on the other hand, require a well-defined schema and wouldn’t natively handle complex objects without flattening them into rows and columns.

```python
# Define a custom class
class Person:
    def __init__(self, name, age, occupation):
        self.name = name
        self.age = age
        self.occupation = occupation

    def __repr__(self):
        return f"Person(name={self.name}, age={self.age}, occupation={self.occupation})"

# Create an RDD of custom objects
rdd = spark.sparkContext.parallelize([
    Person("Amanda", 30, "Engineer"),
    Person("Chris", 25, "Data Scientist"),
    Person("Andrew", 35, "Teacher")
])

# Apply RDD transformations to custom objects (e.g., filter by age)
adults_rdd = rdd.filter(lambda person: person.age >= 30)

# Collect and print the results
for person in adults_rdd.collect():
    print(person)
```
- **Custom Objects**: The RDD contains Person objects, which are instances of a custom class. RDDs allow you to handle any kind of data (including complex or non-tabular data) without worrying about defining a schema.
- **Transformations**: We can apply transformations (like filter) directly on these custom objects, working with them as Python objects.

To use the Person objects in a DataFrame, you would have to convert them into a form that can be represented by a schema (such as a dictionary or tuple) and provide a schema definition.

## How RDDs Are Generated
Spark's [parallelize](https://spark.apache.org/docs/latest/api/python/reference/api/pyspark.SparkContext.parallelize.html) function is used to generate an RDDs from a collection of objects. 

The below code is an example of a simple RDD defined as having 3 partitions:
```python
rdd = spark.sparkContext.parallelize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3)
```
In this example:
- `parallelize([1, 2, 3, ..., 10], 3)` splits the data into 3 partitions. Spark then distributes these partitions to the worker nodes (executors).
- Each partition contains a chunk of the data. For example:
  - Partition 1: `[1, 2, 3]`
  - Partition 2: `[4, 5, 6]`
  - Partition 3: `[7, 8, 9, 10]`

This RDD now holds the data in a fault-tolerant manner and can be operated on in parallel. RDDs are named as being _Resiliant_ because Spark keeps track of the transformations applied to each RDD in the form of a _lineage graph_. If a partition of an RDD is lost, Spark can recompute the lost data by applying the necessary transformations from the original dataset.

## The Life Cycle of an RDD
After an RDD is created with `parallelize`, just like with DataFrames, you can apply **transformations** (which return a new lazily evaluated RDD) or **actions** (which trigger execution and return results) to process the data in parallel.

1. **RDD Creation**:
    - When you call `parallelize`, the RDD is split into partitions, which Spark distributes across worker nodes. Each worker node processes its assigned partition in parallel. If the number of partitions, the second argument, is not specified, Spark defaults to the number of executor cores allocated to the cluster assuming the RDD is not derived from another RDD.
1. **Transformations**:
    - Transformations like `map`, `filter`, `mapPartitions`, and `zip` create new RDDs from the original RDD. They are lazily evaluated, meaning Spark doesn't perform the transformations until an action is triggered.
1. **Actions**:
    - Actions (i.e: `foreach`, `reduce`, `collect`, `foreachPartition`) trigger the actual computation of the transformations. For example, collect will gather all the transformed data from the executors and return it to the driver, while foreach or foreachPartition can perform side effects like writing to a database or logging.

There are more methods explained in the [RDD documentation](https://spark.apache.org/docs/latest/api/python/reference/api/pyspark.RDD.html#pyspark.RDD) than one can possibly remember, I'll highlight a few of the basics. You'll notice that nearly all of these same methods are also referenced in the [DataFrames documentation](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/dataframe.html). Having similar features for both RDDs and DataFrames allows for a more consistent API, user experience, and ability to migrate between the two.

### Example RDD Transformations
1. `map`
    - **What It Does**: Applies a function to each scalar element of the RDD and returns a new RDD. 
    - **Example**:
        ```python
        transformed_rdd = rdd.map(lambda x: x * 2)
        print(transformed_rdd.collect())
        ```
    - **Use Case**: Great for scalar transformations where each record is processed independently.
1. `mapPartitions`
    - **What It Does**: Applies a function to each partition of the RDD and returns a new RDD. It processes data at the partition level, which is more efficient for bulk operations.
    - **Example**:
        ```python
        def process_partition(partition):
            return [x * 2 for x in partition]
        transformed_rdd = rdd.mapPartitions(process_partition)
        print(transformed_rdd.collect())  # Collects the transformed data from all partitions
        ```
    - **Use Case**: Ideal for batch processing where you want to operate on multiple records within a partition before returning results, minimizing overhead by processing data in bulk.

1. `filter`
    - **What It Does**: Returns a new RDD that only contains elements that satisfy a given condition.
    - **Example**:
        ```python
        filtered_rdd = rdd.filter(lambda x: x % 2 == 0)
        print(filtered_rdd.collect())
        ```
    - **Use Case**: When you need to filter out specific elements based on some condition.

### Example RDD Actions
1. `collect`
     - **What It Does**: Returns all the elements of the RDD to the driver. This is typically used for small datasets, as returning all elements to the driver can overwhelm memory.
    - **Example**:
        ```python
        collected_data = rdd.collect()
        print(collected_data)
        ```
     - **Use Case**: When you need to retrieve the entire dataset from the executors to the driver for further local processing or inspection.
1. `foreach`
    - **What It Does**: Applies a function to each element of the RDD but doesn't return anything. Like foreachPartition, it is used when performing operations with side effects (e.g., writing to an external system) but at an individual element level.
    - **Example**:
        ```python
        rdd.foreach(lambda x: print(f"Processing record {x}"))
        ```
    - **Use Case**: Useful for performing side-effect operations at the element level.

1. `foreachPartition`
    - **What It Does**: Applies a function to each partition of the RDD without returning a new RDD. This method is typically used when you want to perform an action with side effects (e.g., writing to a database or sending API requests) rather than transforming the data.
    - **Example**:
        ```python
        def write_partition_to_db(partition):
            for record in partition:
                print(f"Writing {record} to database")

        rdd.foreachPartition(write_partition_to_db)
        ```
    - **Use Case**: Useful when interacting with external systems, like writing data to a database, without needing to return a transformed dataset.

## RDD Interoperability with DataFrames
While RDDs are fantastic for lower-level and/or unstructured use cases, after applying some RDD transformations to generated structured data, it is simple to convert the RDD to a DataFrame to take advantage of the SQL like transformations and syntax that DataFrames offer. Lazy evalution is maintained when converting between the two.

```python
# RDD to DataFrame via toDF()
rdd = spark.sparkContext.parallelize([(1, "Amanda"), (2, "Chris")])
df = rdd.toDF(["id", "name"])

# RDD to DataFrame via createDataFrame()
df2 = spark.createDataFrame(rdd, ["id", "name"])
display(df)

# DataFrame to RDD
new_rdd = df.rdd
print(new_rdd.collect())
```

## When to Use RDDs vs. DataFrames
**Why Choose RDDs?**
1. When working with **complex, unstructured, or semi-structured data**.
1. When handling **custom objects** or data that cannot easily be represented in a tabular form.
1. When **fine-grained control** over data processing and partitioning is required.

**Why Choose DataFrames?**
- When working with **structured data** and you want to leverage the **Catalyst optimizer** for faster performance.
- When you want the **simplicity of SQL-like operations** for data transformation and aggregation.

# Closing Thoughts
When you understand that RDDs are akin to a lower-level and more flexible version of a DataFrame, RDDs aren't so scary anymore and possibilities abound. Need to make a bunch of parallelized API calls from a large list of IDs? No problem. Need to run heavy numerical computations or Monte Carlo simulations? RDDs have you covered.