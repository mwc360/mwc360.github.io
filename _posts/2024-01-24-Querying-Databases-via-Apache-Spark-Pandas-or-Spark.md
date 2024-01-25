---
layout: post
title: "Querying Databases in Apache Spark: Pandas vs. Spark API vs. Pandas-on-Spark"
tags: [Microsoft Fabric, Azure Databricks, Lakehouse]
categories: Optimization
feature-img: "assets/img/feature-img/pexels-suki-lee-16200703.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-suki-lee-16200703.jpeg"
published: true
---

Apache Spark offers tremendous capability, regardless of the implementation—be it Microsoft Fabric or Databricks. However, with vast capabilities comes the risk of using the wrong "tool in the shed" and encountering unnecessary performance issues.

With the ability to code in various languages (Scala, PySpark, R, and SparkSQL), there's an abundance of packages and libraries that can simplify a wide range of tasks. However, it's important to understand whether these libraries fully leverage the distributed computing power of Apache Spark. For example, Python libraries originally written for Python and not PySpark tend to be executed at the driver level. In contrast, PySpark-specific libraries execute on the executors, allowing big data processing to benefit from the performance advantages of a distributed architecture.

One such example is Pandas, a favorite Python library among many data engineers and scientists. While there are tasks in Apache Spark where a developer could use Pandas, PySpark Pandas (a.k.a. Pandas-on-Spark, formerly known as Koalas), or the Spark API based on their own comfort with the library without suffering performance degradation, it would be incorrect to assume there isn’t a set of guidelines to follow to prevent unnecessary performance degradation.

It is commonly known that Pandas executes at the driver level, whereas Pandas-on-Spark and the Spark API run on the executors and therefore benefit from the distributed architecture. In this post, I want to focus on showcasing why you shouldn't just pick one and always use it. For a new data engineer, it might seem intuitive to think, "I'm running a Spark Cluster, this is distributed compute, therefore I should always use the Spark API (or Pandas-on-Spark)." This assumption is a good starting point but is flawed because there's an overhead involved in running distributed operations. For data tasks that are small (e.g., OLTP transactions like singleton queries or lightweight Python transformations), Pandas (or other libraries that only execute at the driver level) may be much more performant.

## Where Pandas is Faster
Let's imagine that we want to query a single record from an Azure SQL Database and convert to a json object so that we can use the data retrieved as the parameters for downstream data processing operations.

When running via pandas the below operation completes in **1.5 seconds**. 
```python
import pandas as pd
from sqlalchemy import create_engine
import pyodbc
import urllib
import json

driver = 'ODBC Driver 18 for SQL Server'
server = 'xxxxxxxxxx.database.windows.net'
database = 'WorldWideImporters'
user_name = 'xxxxxxxxxxx'
user_password = 'xxxxxxxxxxxxx'

sqlStatement = f"""
SELECT top 1 * from Sales.Invoices
"""

connectionString = f"DRIVER={{{driver}}};SERVER={server};DATABASE={database}"
encodedConnectionString = urllib.parse.quote(connectionString)
db = create_engine(f"mssql+pyodbc:///?odbc_connect={encodedConnectionString}", connect_args={'password': user_password, 'user': user_name})
db.connect()

df = pd.read_sql_query(sqlStatement, db)
raw_data = df.to_json(orient='records')
json_record = json.loads(raw_data)[0]
json_record['InvoiceID']
```

The equivalent code run via the Spark API returns in **8+ seconds**.
```python
from pyspark.sql import SparkSession
import json

jdbc_url = 'jdbc:sqlserver://xxxxxxxxxxx.database.windows.net:1433;database=WorldWideImporters;encrypt=true;trustServerCertificate=false;hostNameInCertificate=*.database.windows.net;loginTimeout=30;'
user_name = 'xxxxxxxxxxx'
user_password = 'xxxxxxxxx'

sqlStatement = f"""
SELECT top 1 * from Sales.Invoices
"""
spark = SparkSession.builder.appName("test").getOrCreate()

df = spark.read.format("jdbc") \
    .option("query", sqlStatement)\
    .option("url", jdbc_url) \
    .option("user", user_name) \
    .option("password", user_password) \
    .load()
    
json_rdd = df.toJSON()
json_strings = json_rdd.collect()  # Collects the JSON strings into a Python list

json_array_str = '[' + ','.join(json_strings) + ']' # Combine into a single JSON object (as an array)

json_record = json.loads(json_array_str)[0] # Convert the string to a Python dictionary
json_record['InvoiceID']
```

The equivalent code run via Pandas-on-Spark returns in **5 seconds**, a bit faster than the Spark API, likely because Pandas has more native Json support (to_json). As expected, it is also running the opertion in a distributed fashion which caused it to be slower than regular Pandas.
```python
import pyspark.pandas as pd
import json

user_name = 'xxxxxxxxxx'
user_password = 'xxxxxxxxxx'
jdbc_url = f"jdbc:sqlserver://xxxxxxxxxxxxx.database.windows.net:1433;database=WorldWideImporters;encrypt=true;trustServerCertificate=false;hostNameInCertificate=*.database.windows.net;loginTimeout=30;user={user_name};password={user_password}"

sqlStatement = f"""
SELECT TOP 1 * from Sales.Orders
"""

df = pd.read_sql_query(sqlStatement, jdbc_url)
raw_data = df.to_json(orient='records')
json_record = json.loads(raw_data)[0]
json_record['InvoiceID']
```
### Which was fastest?
**Pandas**. Why is 1.5 seconds versus 8 seconds important? Consider that it is quite common for a data platform to run _millions_ of ELT operations per month. A simple query like this in PySpark might just be a minor step in a single ELT operation, but the seconds truly add up.

### Which was easier to code?
**Pandas-on-Spark**. In this case it required fewer lines of code while using the same simple `read_sql_query()` method as regular Pandas. However, since it uses a JDBC driver instead of ODBC like regular Pandas, you don't need to use SQLAlchemy and PyODBC for the database connection object. This can be somewhat complicated to learn and requires importing extra libraries that may not always come pre-installed on your cluster.

**PANDAS FOR THE WIN!!!**
<div style="width:100%;height:0;padding-bottom:69%;position:relative;"><iframe src="https://giphy.com/embed/EPcvhM28ER9XW" width="100%" height="100%" style="position:absolute" frameBorder="0" class="giphy-embed" allowFullScreen></iframe></div><p><a href="https://giphy.com/gifs/panda-angry-breaking-EPcvhM28ER9XW"></a></p>

> Database connections were made via standard SQL authentication (username and password). In my next blog post, I'll show how you can use token-based authentication for Service Principals.

### Repeat Executions
Repeat executions within the same Spark session, with only a change to the SQL statement to force an invalidated dataframe cache, are much faster for all APIs. Regular Pandas is now only 3x faster at these very small queries.
- Pandas completes in 300ms
- Spark completes in 900ms
- Pandas-on-Spark completes in 900ms

>This appears to be due to the overhead of establishing a connection to the source database in each API. As long as the Spark session is active, the connection remains alive.

## Where Spark and Pandas-on-Spark are Fast
I'm not going to repeat what many in the community have already demonstrated. _Effectively any task that is large enough to benefit from distributed processing will be faster with Spark or Pandas-on-Spark. Think million-row-plus tables, complex transformations, etc. The larger the size of your data the more you can benefit for distributing the workload across many workers/cores._

# Summary
Get to know your data workloads and evaluate the size before you commit to a specific dataframe API.

_General guidelines:_
- If you aren't familiar with Pandas, start with the Spark API.
- If you have steps in your process that do singleton lookups or run very low-volume queries, use regular Pandas.
- If you know Pandas already, you have options :)

# Practical Guidance
It’s essential to understand your data workloads and evaluate the size before committing to a specific dataframe API. The key to efficient data processing in Apache Spark lies in understanding the strengths and limitations of each tool as your disposal and applying them appropriately to your specific data tasks.

_General Guidelines_:
- Start with the Spark API if you are new to Pandas.
- Use regular Pandas for singleton lookups or low-volume queries.
- If you are proficient with Pandas, assess the task at hand and choose the tool that best fits the job.