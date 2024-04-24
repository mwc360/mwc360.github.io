---
layout: post
title: "Confessions of a Spark Convert"
tags: [Fabric, Databricks, Delta Lake, Spark]
categories: Architecture
feature-img: "assets/img/feature-img/pexels-messalaciulla-942873.jpeg"
thumbnail: "assets/img/feature-img/pexels-messalaciulla-942873.jpeg"
published: true
---
I've had a draft blog post labeled _Are Azure Synapse Dedicated Pools Dead_ that I've periodically added thoughts to for the last year but haven't pulled the trigger on publishing. 

Many people have blogged on that topic, some quick to say Dedicated Pools are dead, others saying effectively the same but with more tact. I'm in the latter camp, partly because I was not a super early adopter of Spark, secondarily because Dedicated Pools were the defacto Data Warehouse of choice in the Microsoft data stack not more than a year ago. Microsoft being publically all in on lakehouse architecture for production workloads is effectively only a year old and many businesses have only recently (within the last 3 years) made large investments on the Synapse Dedicated platform. Therefore, we must move forward, but not without acknowledging that the industry at large has only recently made the widespread shift towards lake-centric architectures. 

That said, I assume many folks were or are in the same camp as I was and with large data architecture shifts we should attempt to reconcile the progression of technology rather than blindly accept it. In that spirit, I have historically been a huge proponent of Synapse Dedicated SQL Pools and am a Spark convert, these are my confessions.

# Why I didn't Adopt Spark Earlier
There were a few stumbling blocks I had when it came to adopting Spark and lake-centric architectures. 
1. **Performance:** In the light benchmarking I did, Spark wasn't giving me anything new in the performance department. However, the big variable I didn't consider was my own expertise in Synapse Dedicated. When it comes to tuning queries to run blazing fast on the Synapse MPP service, I'll propose that I can do it better than most. I've presented in depth and blogged on this topic, Synapse Dedicated has a lot of knobs (distributions, indexing, CCI, statistics, well-written SQL, etc.) that can produce query results nearly as fast and _on rare occasion_, even faster than Spark.
1. **Efficient Spark Execution at Scale:** as I wrote about in this [blog post](https://milescole.dev/optimization/2024/02/19/Unlocking-Parallel-Processing-Power.html), optimizing for efficient use of compute and parallelism is a challenging concept. Starting out using Spark, I'd now say I got things wrong more than I got them right, however, this is largely an area where technology can decrease the barrier to entry. As we have more serverless Spark compute options available, the knowledge needed to efficiently execute Spark at scale will dramatically decrease as the way we think about executing jobs starts to look much more like the RDBMS days where you just run things vs. thinking about cluster configurations.
1. **Delta Lake Features:** In Delta Lake versions before 3.0.0 there are a number of things that make development and data management a bit awkward:
   - **Table Clustering:** Ordering data for low latency reads and writes was clumsy. Z-ORDER indexes were a fantastic concept and major innovation but left me unsatisfied with the developer experience because tables could not be ordered on write. After write opterations, you have to run OPTIMIZE with Z-ORDER which rebuilds the entire table and is not an incremental operation. 
   - **Identity Columns:** This was simply not possible in the same way as most RDBMS systems support. Sure, you could do some manually derived row numbering, but for creating monotonically increasing surrogate keys as part of a merge operation, the process feels overly complicated.

# Why I'm a Spark Convert and You Should Be Too
Spark with Delta Lake is superior to every data platform technology that I've used. Whether you have small data or large data, focus on data warehousing or machine learning, prefer SQL dialects or programming languages like Python, Spark and Delta Lake are the winning combination. If you have data and have any grasp of its potential value, Spark and Delta Lake are for you.

Here's what caused me to become a Spark and Delta convert:  

## 1. Programmability
The big differentiator for Spark is its ability to execute APIs via comprehensive programming languages like Python and Scala. In contrast, traditional SQL dialects like T-SQL are primarily designed for data retrieval and manipulation. As the volume, veracity, and variety of your data processing workloads increase, so too does the challenge of maintaining modular, testable, scalable, and dynamic code. Spark, leveraging general-purpose languages, offers a unified approach to manipulating and querying data without compromising the ability to compose intricate data programs.

Consider this analogy: while you could technically use PowerShell for complex data engineering work, it’s not ideally suited to that purpose — similarly with SQL. It lacks general-purpose programming features, which restricts its utility for tasks that include:
   - Employing an Object-Oriented Programming approach to simplify and standardize ELT operations.
   - Encapsulating data engineering workflows into a reusable library.
   - Utilizing development tools that include features like breakpoints for debugging.
   - Managing task concurrency and parallelism within loops through multithreading and multiprocessing.
   - Processing a continuous stream of data from source to target.
   - List comprehension for applying bulk operations

A classic example to showcase Spark's superior programmability is the use case to alias all column names to be proper-case with spaces. I recommend storing columns as snake-case in Delta Lake to maximize readability and developer productivity. In TSQL, pre ChatGPT, we would manually create views on top of our tables which simply alias column names for our reporting layer. Via Python and Spark we can programmatically alias all column names with a few lines of code.

```python
import pyspark.sql.functions as sf
# Sample data
data = [("Alice", 25), ("Bob", 30)]
columns = ["first_name", "age_in_years"]

# Create DataFrame
df = spark.createDataFrame(data, schema=columns)

# Function to convert snake_case to Proper Case with spaces
def snake_case_to_proper_case(col_name):
    return ' '.join(word.capitalize() for word in col_name.split('_'))

df_renamed = df.select([sf.col(c).alias(snake_case_to_proper_case(c)) for c in df.columns])

display(df_renamed)
```
> Now imagine we have a table with 200 columns, with PySpark we can use the above code, with TSQL or other SQL dialects we would normally end up manually aliasing 200 column names, and with many typos.

## 2. Scalability and Cost
### Decoupled Compute and Storage
Architecturally, Spark mirrors MPP data warehousing platforms like Synapse Dedicated, with Spark using a driver and Synapse a controller—both serving similar fundamental roles. Similarly, Spark employs workers and Synapse uses nodes. The critical distinction lies in Spark’s compute capabilities being entirely decoupled from storage, which greatly enhances flexibility and if implemented correctly can significantly reduce costs.

Having compute and store decoupled means we can scale up and out our compute to meet the needs of our workload. In terms of possible concurrency, we are no longer limited by the database SKU or constraints of the platform, we can effectively spin up as much compute as cloud data centers offer and our subscription quotas allow.

From a cost perspective, we can pause or even terminate our compute resources and subsequently resume them as needed without bringing our data offline, our data is in the lake and therefore always accessible. Gone are the days when you need to have a database or server running 24/7 just in case someone wants to access the data, therefore you can strategically spin up compute based on when data engineering jobs run and immediately shut them down or have them automatically paused.

### Evaluation Model
Another major contributor to Spark's scalability is known as **lazy evaluation**. Almost all traditional SQL platforms leverage the opposite, _eager evaluation_. The distinction is that Spark will not compute results until absolutely necessary, whereas platforms like Synapse Dedicated employ eager evaluation, the major downside being that there is less opportunity for the compiler to optimize data processes. The result being that the user must write SQL with data movement principles in mind, which leaves a lot of room for leading the optimizer into a poor execution plan. For Spark, this means that until a write or explicit evaluation trigger like count, select, or cache command is run, you can chain many transformation steps together and the compiler will strategically rearrange or combine operations to optimize performance and reduce computational costs.

```python
# Create a dataframe
df = spark.createDataFrame(data)

# Define a transformation (lazy)
df_t1 = df.select("name", "info.age")

# Define another transformation (lazy)
df_t2 = df_t1.withColumn("age_in_months", sf.col("age") * 12)

# Define more transformations (lazy)
df_t3 = df_t2.distinct().drop("age")

# Still, no computation has happened

# Perform an action to trigger computation
display(df_t3) 
```

## 3. Simplicity
### Tuning Effort
This one surprised me. In my benchmarking of Spark and Synapse Dedicated, I spent a lot of time tuning queries (primarily via optimizing HASH distributions) to get Synapse to run as fast as Spark, I did nothing on the Spark side. No tuning effort and it was as fast as a heavily tuned MPP system. The developer experience and knowledge needed to maintain performance in Spark is less than with traditional MPP systems, though some tuning might occasionally be beneficial. 

### Handling of Data Types and Complex Structures
- In traditional DW platforms it's common to spend a lot of time on data types, do you store a column as a CHAR, VARCHAR, or NVARCHAR, and of what length? The world of Spark is much more simple because Parquet files as part of a Delta Table technically only have one string-based type: StringType. Delta Lake supports custom metadata on top of the table to support the concept of variable and fixed length constraints, however, this doesn't impact the size of the physical data. Lastly, with a singular string storage format, Unicode data types are no longer relevant.
- Complex structures like lists and dictionaries (think JSON structures) are natively supported as column types whereas in most SQL platforms you need to store them as strings and then serialize them as JSON at query time. Consider the below:

```python
data = [{"name": "Alice", "info": {"age": 25, "email": "alice@example.com"}},
     {"name": "Bob", "info": {"age": 30, "email": "bob@example.com"}}]

# Create DataFrame without explicitly defining the schema
df = spark.createDataFrame(data)
```
We can then easily explode or query the complex structure via dot notation:

```python
display(df.select("name", "info.age"))
```
Of course, we can also use SparkSQL after saving the dataframe as a temporary view:

```sql
SELECT name, info.age from df
```


## 4. Extensibility
Utilizing Python with Spark significantly broadens the extensibility options available, enhancing both Spark and Python functionalities. Here are a few notable libraries:

 - [MLflow](https://pypi.org/project/mlflow/) streamlines ML development.
 - [Great Expecations](https://github.com/great-expectations/great_expectations) for Data Quality
 - [SQLGlot](https://pypi.org/project/sqlglot/) for transpiling your code from various SQL dialects to SparkSQL (see [this blog post](https://milescole.dev/data-engineering/2024/04/17/The-SQL-Decoder-Ring-for-Replatforming-to-Fabric-And-Databricks.html))
 - [onelake-shortcut-tools](https://pypi.org/project/onelake-shortcut-tools/) (created by yours truly 😁)
 - [SynapseML](https://github.com/Microsoft/SynapseML) for various ML features and AI integrations
 - [and many more...](https://github.com/awesome-spark/awesome-spark)

## 5. Community Investment
Finally, the vibrant Spark and Delta Lake community contributes a wealth of knowledge, libraries, and continual improvements to the core technologies. Different from proprietary compute engines, Spark and Delta have massive investments from the broader community of users and companies that want to see the technologies continue to improve and evolve. Regular updates and a transparent roadmap, supplemented by contributions from community members (including myself 😁) ensure these technologies remain on the cutting edge.

# What If I'm Using Synapse Dedicated (or similar) Today?
The plug is not being pulled on Synapse Dedicated in the near term however there is not going to be further feature development, only product support and patching to ensure the same Azure service-level objectives are met.

# Should you replatform to a Spark + Delta Lake (Lakehouse) Architecture? 
Honestly, there's no better time like the present to invest in getting more value out of your data. Properly implemented Lakehouse architectures are cheaper, faster, more scalable, have low vendor lock, and the barrier to entry is lower today than it ever has been. Microsoft, Databricks, and other leaders in the market have been investing heavily in eliminating all points of friction to accomplish having an architecture with separated compute and storage while maintaining all of the feature-rich capabilities that data warehousing technologies have left us.

The industry is moving on from compute-storage coupled architectures, are you?