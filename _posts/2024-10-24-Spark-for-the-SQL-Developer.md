---
layout: post
title: "Breaking the Myth: Spark Isn’t as Complex as You Think (And Yes, It Supports SQL!)"
tags: [Fabric, Spark, Lakehouse]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-17485738.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-17485738.jpeg"
published: True
---

I frequently hear people talk about Spark as being this complex, pro-dev oriented engine, that is unapproachable to the traditional SQL developer and modern Analytics Engineer. Commonly referenced is the necessity to learn Python, Scala, and completely different data processing constructs. 

I honestly used to be in this camp: when we learn over time to cherish the technologies and database engines that radically transform data into value for our business users, it is all too easy to put up blinders and see foreign engines in the data processing and management space as being complex and unapproachable. But is the proposition that Spark is not for SQL Developers and Analytics Engineers justified?
 
# Is Spark Complex and Unapproachable?
Before answering, I think it's helpful for readers to know my background, to summarize some of what I wrote in my [Confessions of a Spark Convert](https://milescole.dev/architecture/2024/04/24/Confessions-of-a-Spark-Convert.html): 


> I made the now quite common _business to IT_, _low/no-code to pro-code_ career transition. I started my career as a Financial Analyst, discovered Power BI in 2015, and quickly became a full-time Power BI Developer. 
<br>
<br>
Learning the necessity for dimensional modeling before the semantic model layer, I quickly evolved into a SQL Developer and then what we now call a modern Analytics Engineer. I could build ADF pipelines to extract and load data, write T-SQL transformations, wrap it in an SDLC framework with Git and CI/CD, and build Power BI models and reports for the business. My architectural decisions revolved around using exclusively GUI-based experiences with SQL supplementation.
<br>
<br>
Over time, as I reached the limits of GUI based experiences in numerous areas, I gave PowerShell a try which I didn't realize would turn out to be the gateway drug for me to learn a half-dozen other languages (Python, C#, Scala, JavaScript, YAML, etc.) which really opened a whole new world of possibilities. During this transition, against my better SQL Developer judgement, I decided to give Spark a try for a use case that wasn't possible in my beloved Synapse DW engine. The rest is history.

Now that you know my background, I'll say that **Spark is only as complex as you want it to be**. For typical data loading and transformation that SQL Developers do, in my experience, Spark isn’t complex and, in some scenarios, it’s easier than using a T-SQL-based engine. That said, as your requirements grow, Spark’s APIs across multiple programming languages allow you to build insanely complex applications to meet the most demanding requirements.

## Spark Supports SQL... SparkSQL!
One of Spark’s many beauties is that you can code in the language you know. If you love SQL, you can use **SparkSQL**! Yes, Spark supports its own SQL dialect, close to ANSI-SQL and feature-rich. You don’t need Python or Scala; an entire medallion architecture can be built using 100% SparkSQL in Fabric.

```sql
-- create bronze schema
CREATE SCHEMA IF NOT EXISTS bronze_wwi;
-- create bronze table
CREATE OR REPLACE TABLE bronze_wwi.customer
AS SELECT * FROM parquet.`abfss://<workspace_name>@onelake.dfs.fabric.microsoft.com/<lakehouse_name>.Lakehouse/Files/..../customer.parquet`;

-- create silver schema
CREATE SCHEMA IF NOT EXISTS silver_wwi;
-- create silver table
CREATE OR REPLACE TABLE silver_wwi.customer
AS SELECT c_customer_id as customer_id, concat(c_last_name, ',', c_first_name) as name, c_email_address as email FROM bronze_wwi.customer;
```
Need to run some ad-hoc queries? Just use SparkSQL! Got SQL in another dialect? Use SQLGlot (see my [blog](https://milescole.dev/data-engineering/2024/04/17/The-SQL-Decoder-Ring-for-Replatforming-to-Fabric-And-Databricks.html)) to transpile between dialects. While SparkSQL alone can accomplish many patterns found in relational DWs, I often combine PySpark and SparkSQL in any end-to-end engineering process to build more scalable and robust patterns.

That said, while you can acomplish the same types of patterns as compared to your relational DW of choice via SparkSQL alone, I always use a mix of both PySpark and SparkSQL in any end-to-end data engineering simply because of the opportunity to build more scalable and robust patterns than SQL alone makes possible.

In the prior example we performed a basic truncate and load pattern. In a future blog I'll cover best practices around various ways to incrementally move data across zones.

### Reasons to Love SparkSQL
1. **Robust Idempotency**: Having come from a T-SQL background, SparkSQL’s native support for idempotency in its `CREATE` operations is incredibly convenient and reduces the need for extra logic. 
    - `CREATE OR REPLACE`: Simplifies table management by allowing you to replace tables without manually writing `DROP` or `TRUNCATE` statements.
    - `CREATE... IF NOT EXISTS`: Removes the need to write complex checks for whether an object exists before creating it, streamlining your code.
1. **Time Saving Operators and Functions**: SparkSQL offers a wide range of built-in functions and “syntax sugar” to reduce the need for verbose code. With over [400 built-in functions](https://spark.apache.org/docs/latest/api/sql/index.html) compared to T-SQL’s ~200, SparkSQL has massive flexibility, particularly when it comes to ANSI-SQL functions and semi-structured data.
    - `GROUP BY ALL`: A standout feature that simplifies common operations like checking for duplicates by grouping all non-aggregated columns automatically. Instead of manually listing each non-aggregated column, GROUP BY ALL simplifies this significantly, saving time and reducing errors.
    ```sql
    SELECT key1, key2, count(1) 
    FROM table1 
    GROUP BY ALL
    ```
1. **Seemless Integration with Delta Lake**: SparkSQL’s native integration with Delta Lake adds powerful features for data reliability and management, including:
    - **Change Data Feed (CDF)**: Enables easy tracking of incremental changes to data, making it ideal for building efficient ETL pipelines without complex change-tracking logic.
    - **Time Travel**: You can query previous versions of your data, providing built-in auditability and flexibility in the event of needing to restore to a prior state of the table.
1. **Support for Complex, Nested, and Semi-Structured Data**: Handling complex structures is where SparkSQL truly shines, offering inline parsing and transformation tools that simplify otherwise complex tasks:
    - **Native Support for Complex and Nested Data**: Rather than having arrays, maps, structs, etc. stored as string values that need to be cast as JSON at time of read for parsing, Spark supports storing these complex data structures natively so that at read time you don't need to cast the strings to be interpreted as nested structured values.
        ```sql
        WITH dict as (
            SELECT map('key1', 'value1', 'key2', 'value2') AS key_value_pairs
        )
        SELECT key_value_pairs.key1
        FROM dict
        ```
        or
        ```sql
        WITH sample_data AS (
            SELECT array(
                map('id', '1', 'name', 'Alice', 'age', '30'),
                map('id', '2', 'name', 'Bob', 'age', '25'),
                map('id', '3', 'name', 'Charlie', 'age', '35')
            ) AS people_data
        )
        SELECT people_data[0].name AS first_persons_name
        FROM sample_data;
        ```
    - **Exploding Arrays**: Easily unnest arrays into rows with the EXPLODE function, reducing the complexity of working with nested or multi-valued data:
        ```sql
        SELECT explode(array('a', 'b', 'c')) AS value
        ```
These are just a sampling of reasons SparkSQL is an extremely expressive SQL dialect, simplifying complex tasks and reducing boilerplate code compared to T-SQL and other dialects.  For those transitioning from traditional SQL databases, these operators can make working with large datasets, semi-structured data, and complex transformations far more efficient with much less code.

## Comparing Core Development Concepts
### Compute Sizing
Compute is really the one area today where Spark can be justified as being more complex than your typical SQL based cloud data warehouse. While Fabric Spark enables Auto Scale and Dynamic Allocate be default to help make clusters more scalable and adapable to changing workloads, pure serverless data warehousing engines like Fabric Warehouse, Snowflake, and BigQuery certainly have an edge in the simplicity department in that you largely don't need to think about sizing your compute.

As a former SQL Developer learning Spark, learning how to size clusters was a significant hurdle. Node size, autoscale, number of nodes – there’s a lot to consider for job performance. However, having the ability to make jobs faster by adding more compute is invaluable. In pure serverless models, you typically have little to no control and are beholden to the capabilities of engines serverless architecture.

### Dynamic SQL
- **T-SQL**: In T-SQL, dynamic SQL typically involves constructing SQL statements as strings and executing them using the EXEC or sp_executesql commands. This allows flexibility, such as generating queries based on user inputs, but it can make code more difficult to debug and maintain. Additionally, there are potential security concerns (e.g., SQL injection) if user input is not properly sanitized.

    ```sql
    DECLARE @sql NVARCHAR(MAX)
    DECLARE @age_limit INT = 40
    SET @sql = 'SELECT * FROM users WHERE OPENJSON(dob, ''$.age'') <' + @age_limit
    EXEC sp_executesql @sql
    ```
- **SparkSQL**: SparkSQL supports dynamic SQL through both traditional SQL variable substitution and the more programmatic approaches available via the DataFrame API. Both are arguably simpler and much easier to debug.
    - Traditional variable substitution
        ```sql
        SET age_limit = 40;
        SELECT * FROM users where dob.age < ${age_limit};
        ```
    - Dynamic query building via the DataFrame API:
        ```python
        age_limit=40
        df = spark.sql(f"SELECT * FROM users where dob.age < {age_limit}")
        display(df)
        ```
        or we can use named parameters in our SparkSQL queries:
        ```python
        df = spark.sql("SELECT * FROM users where dob.age < {age_limit}", age_limit=40)
        display(df)
        ```
### Data Type Specificity
- **T-SQL**: In T-SQL, data types are strictly enforced, and developers often spend significant effort deciding between fixed-length (`CHAR`), variable-length (`VARCHAR`), and whether or not strings are UNICODE (`NCHAR`) data types to optimize storage and enforce data expectations. Choosing the wrong size can result in either excessive storage consumption (over-allocating) or errors from truncating values (under-allocating). Careful sizing of fields is essential to minimize the database size and optimize performance.
- **SparkSQL with Delta**: In SparkSQL, especially when using modern Parquet-based formats like Delta Lake, data type specificity is less of a concern. Parquet treats strings as STRING types, without distinguishing between fixed-length (`CHAR`) and variable-length (`VARCHAR`), making these distinctions purely metadata constraints. Parquet fully supports Unicode and various character sets, abstracting away encoding concerns for developers.

    You don’t need to focus on right-sizing fields to save storage space. Instead, Parquet’s columnar format applies efficient compression algorithms that minimize storage regardless of the string size. Additionally, Delta Lake logs detailed column statistics (e.g., min/max values, null counts) in its transaction log, which helps optimize queries by informing the query planner about the underlying data distribution. By defining strings as simple STRING types, you let Parquet and Delta Lake handle compression and optimization, enabling you to focus entirely on the data processing logic.

### PK/FKs - Do They Matter Anymore?
Daniel Beach wrote a great [blog](https://dataengineeringcentral.substack.com/p/primary-and-foreign-keys-in-the-lake) on the so-called “death” of Primary and Foreign Keys in the Lake House. Developers coming from the SQL world often see the absence of true PK and FK constraints as limitations in Spark and Delta. However, in compute/storage-separated engines—especially those with a distributed architecture—there’s no practical place for enforced PK and FK constraints.

While some platforms, like Databricks and Synapse Dedicated SQL Pools (which is distributed but not fully compute/storage-separated), allow for PK and FK constraints, they aren't enforced. Instead, these “constraints” serve as advisory metadata that may help users and, in some cases, hint query plans on expected relationships and uniqueness, without the overhead of enforcement.

As Daniel points out, we can write code to enforce primary key uniqueness and maintain foreign key relationships without the need for built-in constraints. With a thoughtfully designed approach, data integrity can be achieved without enforced constraints that would otherwise bottleneck performance in distributed engines.

### Writing and Maintaining Highly Optimized SQL
In many relational database systems, the way you write SQL can directly impact the final execution plan, sometimes causing completely different execution paths and runtimes. Here are just a couple of examples:
- Choosing a nested CTE vs. a flattened subquery can impact performance.
- Running queries against tables with outdated statistics can lead to suboptimal plans.
- Improperly using and maintaining table indexes.

This is because most relational databases generate static execution plans at runtime, relying on table statistics, the structure of the SQL query, and the history of prior execution plans.

Spark, on the other hand, has an exceptional feature called Adaptive Query Execution (AQE). Amnay Kanane wrote an excellent [blog](https://datatoast.net/posts/aqe/) that explains and illustrates AQE’s power in reducing query processing times. In summary, AQE allows Spark’s execution plan to adapt and optimize itself as processing stages are completed. By generating real-time statistics on the data as it’s processed, Spark continuously evolves the execution plan based on the actual data profile, even if table statistics aren’t perfectly up-to-date. I highly recommend reading Amnay’s blog—it’s a fantastic deep dive into this powerful Spark capability.

Without needing to micromanage indexing, statistics, or precise table structures to the same extent as traditional RDBMSs, Spark offers massive flexibility with all of the performance benefits that come with a distributed processing engine.

## SQL Feature Gaps Coming in Spark/Delta 4.0
I've mentioned a lot of goodness so far, now for the letdown of features that aren't supported yet, thanfully most should see the light of day in 2025:
1. **Multi-statement and table transactions**: [Delta 4.0](https://delta.io/blog/delta-lake-4-0/#:~:text=The%20updated%20Delta%20Lake%20commit%20protocol%20enables%20reliable,which%20will%20manage%20all%20writes%20to%20the%20table.) will be adding the preview of a "Commit Coordinator" which is fundamental for enabling multi-statement and multi-table transactions in a later 4.x release of Delta. Until then, consider that numerous enterprises have adopted the Lakehouse architecture without user defined commits, I used them heavily in my T-SQL days and I don't miss them at all.
1. **Advanced SQL Scripting Operators (`DECLARE`, `BEGIN`, `IF`/`ELSE`, `CASE`, `WHILE`, `FOR`, `CONTINUE`/`EXIT`, `EXECUTE`, etc.)**: Coming in Spark 4.0, Spark will be much closer to having full scripting parity with traditional RDBMSs. Until then, you can acomplish many of the same outcomes using a hybrid of PySpark or Scala w/ dynamic SparkSQL.
1. **Stored Procedures**: Again... Spark 4.0.
1. **Identity Columns**: I'd argue this is the most long awaited feature in Spark from a SQL standpoint. Yes, there's workarounds, however none of them are particularly elegant and all just make me annoyed that Databricks has been holding onto this feature for so long. But, alas, [Delta 4.0](https://delta.io/blog/delta-lake-4-0/#identity-columns-coming-soon:~:text=types%20during%20reads.-,Identity%20Columns%20(coming%20soon),-Identity%20columns%20are) promises the long awaited Identity Column.

# Fabric Makes Spark Easier

Hopefully, I’ve convinced you that Spark with SparkSQL isn’t intimidating and can be more expressive for working with both structured and semi-structured data. For those looking to explore PySpark to augment SparkSQL or go full-bore into the DataFrame API, Microsoft Fabric can help you learn, improve your productivity, and can even automatically tune your jobs.

## Starter Pools
No one likes waiting 3 to 5-minutes for a cluster to spin up, Fabric eliminates this wait time for many workloads via Starter Pools. This pool type allows for start up times in the tune of about 15 seconds. It's an insanely positive improvement in the Spark development experience when you might already be used to taking 10-15 seconds to open up SSMS, VS Code, or other IDE to connect to your SQL engine of choice.

## Data Wrangler
Data Wrangler is a GUI based experience for transforming datasets in Fabric Spark that generates PySpark code as an output. This can be fantastic for learning how to use the PySpark DataFrame API. If you've used this, please reach out and let me know what you think.

## AutoTune
[AutoTune](https://learn.microsoft.com/en-us/fabric/data-engineering/autotune?tabs=sparksql) is an innovative feature in Fabric that aims to decrease the the execution time of repeat Spark jobs over by progressively tuning key Spark configuriations using ML. More to come on this, I have a dedicated blog on this topic in the works.

# Closing Thoughts
While Spark may seem intimidating at first, its flexibility, adaptability, and SQL-friendly features make it far more approachable than many expect. Whether you stick with SparkSQL or dive into the DataFrame API, the platform gives you the tools to handle both simple and complex workloads at effectively any scale. And with powerful features like Adaptive Query Execution, Spark is forgiving enough to deliver optimized performance even without the kind of meticulous query tuning required by traditional relational databases. So, if you're a SQL developer or Analytics Engineer, there’s no reason to shy away from Spark—today it's designed just as much for SQL workloads as it is for pro-code data engineering and ML use cases.