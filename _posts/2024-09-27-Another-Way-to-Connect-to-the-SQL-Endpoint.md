---
layout: post
title: "Yet Another Way to Connect to the SQL Endpoint / Warehouse via Python"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-alex-andrews-271121-821754.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-alex-andrews-271121-821754.jpeg"
published: True
---

Options, options, options. There are now plenty of documented ways to connect from a Spark (or soon Python) notebook to run Data Query Language (DQL) or Data Manipulation Language (DML) commands on top of the SQL Endpoint or Fabric Warehouse. Sandeep has already done a recap of these options in his [blog](https://fabric.guru/querying-sql-endpoint-of-fabric-lakehousewarehouse-in-a-notebook-with-t-sql), and Bob Duffy explores another method, using PyOdbc + SqlAlchemy in his [post](https://prodata.ie/2024/08/26/connecting-to-fabric-sqlendpoints-using-aad-entra-token-in-notebooks/). While each method has pros and cons, I wanted to jump in with yet another way to connect, one I believe is the simplest and most streamlined method available in Python.

# Introducing JayDeBeApi
[JayDeBeApi](https://pypi.org/project/JayDeBeApi/) is a lightweight python library that connects to databases supporting the JDBC protocol. The main advantage here is that JayDeBeApi integrates seamlessly with Java JDBC, providing a straightforward connection to any database with a JDBC driver, with minimal setup. You don’t need multiple libraries like PyOdbc and SqlAlchemy for authentication and connection handling—just JayDeBeApi. This method not only requires less lines of code but simplifies the entire setup process, making it ideal for quick integrations in Python environments.

Since Fabric Runtimes already include Pandas by default, all you need to install JayDeBeApi is a quick `%pip install JayDeBeApi` or a reference to the library in PyPi in your Environment.

Here’s what this method looks like in action:

```python
import pandas as pd
import jaydebeapi

def create_connection(server_name: str):
    token = mssparkutils.credentials.getToken('https://analysis.windows.net/powerbi/api')
    return jaydebeapi.connect(jclassname="com.microsoft.sqlserver.jdbc.SQLServerDriver", url=f"jdbc:sqlserver://{server_name}:1433", driver_args{'accessToken': token})

server_name = "xxxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxx.datawarehouse.fabric.microsoft.com"
connection = create_connection(server_name)
```
You'll notice that with this method there's no need to format the token and it involves about 5-6 less lines of code.

Once you have the connection, a Python [DB-API](https://peps.python.org/pep-0249/) object, it's as easy as calling Pandas' `read_sql_query()` function to run queries and return results to a Pandas dataframe.
```python
import pandas as pd
pd.read_sql_query("SELECT TOP 100 * FROM bronze_lh.dbo.sales", connection)
```

When using the JayDeBeApi connection in Pandas, it currently prints a warning that the DB-API connection object is not officially supported by SqlAlchemy, but it reliably works nonetheless. This can be ignored via adding the below to the scope where `read_sql_query()` is run.
```python
import warnings
warnings.simplefilter("ignore", UserWarning)
```
## What Connection Method is Ideal for your Workload?
Now that we've got another connection option sorted, the next step is deciding which method you’ll use to execute your queries. I’ve covered the advantages of Pandas vs. Spark vs. Pandas-on-Spark in detail in a previous [blog](https://milescole.dev/optimization/2024/01/24/Querying-Databases-via-Apache-Spark-Pandas-or-Spark.html). Here’s a quick summary:

**Pandas:** Best for queries returning small result sets, as it is 3x + faster than Spark when reading via JDBC. If you expect the query to return a small dataset (think small lookups or returning 1000s of rows of data), Pandas should be your go-to. Combine it with either PyOdbc + SqlAlchemy or JayDeBeApi to establish the connection.

**Spark (or Pandas-on-Spark):** Ideal for large datasets, especially when the result set approaches 100K rows of data. In these cases, take advantage of Spark’s distributed computing capabilities to improve performance. To truly unlock Spark’s distributed nature, enable dynamic partitioning, which splits your query into parallel jobs, allowing Spark to process large queries much faster, and greatly increase your throughput.

# Bonus Tips and Tricks
## Executing Warehouse Stored Procedures with Pandas
While Pandas’ `read_sql_query()` function is designed for DQL statements (like SELECT queries), we don't need to revert to using cursors and commits as SqlAlchemy normally requires for DML operations since Pandas handles this for us. Pandas can also be used to execute stored procedures or multi-statement operations in Fabric Warehouses with a simple trick: include a DQL statement at the end of your procedure and add `SET NOCOUNT ON` at the beginning.
- **Why NOCOUNT:** `SET NOCOUNT ON` prevents SQL Server from returning row count information after each operation that would normally cause `read_sql_query()` to throw an error since it expects data as a result.
- **How to meet the Pandas result set requirement:** Add a dummy query like `SELECT 1 AS Success` at the end of your stored procedure. This will satisfy `read_sql_query()`'s requirement of returning a DataFrame.

```python
pd.read_sql_query(f"EXEC dbo.usp_load_staging @batch_id = {batch_id}", connection)
```
If you need to execute multi-statement operations, either run multiple read_sql_query() calls or wrap your operations inside a stored procedure to ensure they execute in the proper sequence.

In comparison, the cursor/commit method requires manual cursor handling and the explicit committing of transactions:

```python
with connection.cursor() as cursor:
    cursor.execute(f"EXEC dbo.usp_load_staging @batch_id = {batch_id}")
    connection.commit()
connection.close()
```

The cursor/commit method is even more complicated when running DQL to return results sets into a dataframe since you have to fetch the rows and parse column names from the response:
```python
with connection.cursor() as cursor:
    cursor.execute(f"SELECT * FROM some.table")
    # data must be manually fetched
    rows = cursor.fetchall()
    # column names must be retrieved
    columns = [desc[0] for desc in cursor.description]
    df = pd.DataFrame(rows, columns=columns)
connection.close()
```
Pandas for the win!

## Transpiling SparkSQL to T-SQL with Qualified Table Names
If you have a query that runs on your lakehouse tables that you need to later execute via T-SQL via the SQL Endpoint, you have a couple of challenges.
1. Converting SQL dialects
1. Depending on how you are connecting to the SQL Endpoint, you might need to qualify the table names to include the catalog and schema.

To acomplish this we can use SQLGlot and then execute the transpiled and qualified SQL via one of the prior mentioned methods:

```python
import sqlglot as sg
from sqlglot.optimizer.qualify_tables import qualify_tables
parsed_abstract_sql = sg.parse_one(sparksql, dialect='spark')
qualified_tsql = qualify_tables(parsed_abstract_sql, catalog=catalog_name, db=schema_name, dialect='spark').sql('tsql', normalize=True)
```

```python
import pandas as pd
pd.read_sql_query(qualified_tsql, connection)
```

This approach simplifies the process of translating SparkSQL queries to run on the SQL Analytics Endpoint or Fabric Warehouse, ensuring your queries are properly formatted and executed in the correct context.

---------
There you go, yet another way to connect to the SQL Analytics Endpoint! 