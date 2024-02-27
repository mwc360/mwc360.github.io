---
layout: post
title: "Beyond Information Schema: Metadata Mastery in a Fabric Lakehouse"
tags: [Fabric, Spark]
categories: Tips and Tricks
feature-img: "assets/img/pexels/search-map.jpeg"
thumbnail: "assets/img/pexels/search-map.jpeg"
published: true
---
Have you ever needed to delve into the _Information Schema_ within a notebook environment? There are myriad reasons for wanting to do so, such as:
- Programmatically recreating view definitions in another lakehouse
- Identifying table dependencies via view definitions
- Locating tables that include a soon-to-be-dropped column

Accessing this vital metadata in a Fabric Notebook, however, presents its challenges. In Databricks, one might simply query `INFORMATION_SCHEMA.VIEWS` or `INFORMATION_SCHEMA.COLUMNS` to quickly access the needed information. Attempt the same in Fabric, and you're met with a perplexing error:
> [TABLE_OR_VIEW_NOT_FOUND] The table or view `INFORMATION_SCHEMA`.`VIEWS` cannot be found. Please verify the spelling and schema correctness.

This error is returned because _Information Schema_ is exclusive to the SQL Endpoint, designed as a gateway for SQL queries atop your Lakehouse (e.g., for use with SSMS, Power BI, Fabric Warehouses, etc.). You might think to bypass this by querying the SQL Endpoint directly from your Notebook via JDBC `spark.read`, but this path too is fraught with limitations — attempting to query the SQL Endpoint in a Fabric Notebook will return a pesky port error.

### Embracing SparkSQL Metadata Commands

Despite these hurdles, SparkSQL offers a lifeline through its array of metadata commands. These commands, while not as streamlined as _Information Schema_ queries, can provide similar results via a more programatic approach. Unlike the system-wide sweep of _Information Schema_, SparkSQL's commands tend to focus on individual objects, which can be less efficient but equally effective with the right strategy.

For instance, while there's no single command to extract all view definitions at once, we can iteratively gather all views within a database and subsequently loop through them to capture each definition and append to a singular dataframe.

```python
import pyspark.sql.functions as sf

database_name = 'silver_mc'
views = spark.sql(f"SHOW VIEWS IN {database_name}").collect()


for view in views:
    view_name = view['viewName']
    new_df = spark.sql(f"SHOW CREATE TABLE {database_name}.{view_name}") \
        .withColumnRenamed("createtab_stmt", "view_definition") \
        .withColumn("view_name", sf.lit(view_name)) \
        .withColumn("view_database", sf.lit(database_name)) \
        .withColumn("full_name", sf.lit(f"{database_name}.{view_name}"))
    if views[0] != view:
        df = df.union(new_df)
    else:
        df = new_df

display(df)
```

![Get view definitions](/assets/img/posts/Fabric-Lakehouse-Information-Schema/results.png)

While this approach is admittedly more cumbersome than a straightforward _Information Schema_ query, encapsulating it within a function or utility class method simplifies future metadata retrieval efforts.

```python
from pyspark.sql import SparkSession
import pyspark.sql.functions as sf

def get_view_definitions(database_name: str):
    # Retrieve all views from the specified database
    views = spark.sql(f"SHOW VIEWS IN {database_name}").collect()
    
    # Initialize an empty DataFrame for concatenation
    df = None

    for view in views:
        view_name = view['viewName']
        # Generate the DataFrame for each view's create statement
        new_df = spark.sql(f"SHOW CREATE TABLE {database_name}.{view_name}") \
            .withColumnRenamed("createtab_stmt", "view_definition") \
            .withColumn("view_name", sf.lit(view_name)) \
            .withColumn("view_database", sf.lit(database_name)) \
            .withColumn("full_name", sf.lit(f"{database_name}.{view_name}"))
        
        # Concatenate the new DataFrame with the existing one
        if df is not None:
            df = df.union(new_df)
        else:
            df = new_df

    return df
```

```python
# Use the function to return a dataframe with the view metadata
df = get_view_definitions('silver_mc')
display(df)
```

While navigating metadata without Information Schema in Fabric might initially seem daunting, SparkSQL's metadata commands open up a realm of possibilities, all you need to do is dive in.

## Common SparkSQL Metadata Commands

| Command Syntax                          | Description                                             |
|-----------------------------------------|---------------------------------------------------------|
| `SHOW DATABASES`                        | Lists all databases or schemas in the Spark SQL catalog.           |
| `SHOW TABLES [IN database_name]`        | Lists all tables in a database.                         |
| `SHOW VIEWS [IN database_name]`         | Lists all views in a database.                          |
| `DESCRIBE DATABASE [EXTENDED] db_name`  | Shows metadata of a database, including its description and location. Including `EXTENDED` will return additional attributes. |
| `DESCRIBE TABLE [EXTENDED] table_name`  | Describes the schema of a table, including column names and data types. Including `EXTENDED` will return additional attributes. |
| `SHOW CREATE TABLE table_name`          | Shows the SQL statement to create the table or view.    |
| `DESCRIBE FUNCTION [EXTENDED] function_name` | Describes a function, showing its usage and parameters. Including `EXTENDED` will return additional attributes. |
| `SHOW COLUMNS [IN table_name]`          | Lists all columns in a table.                           |
| `SHOW TBLPROPERTIES table_name`          | Lists table properties in a table or view.             |

> The spark documentation refers to these types of commands as _Auxiliary Statements_, I prefer to call the subset that only return metadata, metadata commands.

## Last Words
If you are coming from a T-SQL background, I highly recommend getting familiar with SparkSQL. The syntax is often the same, but if there's something that isn't supported, there's typically a SparkSQL way to accomplish the same thing. Although most of the time I find that the SparkSQL way of doing things is easier and less verbose (e.g., `GROUP BY ALL`), I still hope that accessing Information Schema is on the Fabric Lakehouse roadmap as for bulk operations, it is more flexible and performant.