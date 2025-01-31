---
layout: post
title: "Automating V-Order: A Targeted Approach for Direct Lake Models"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-pixabay-262438.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-pixabay-262438.jpeg"
published: True
---

I've previously blogged in detail about [V-Order optimization](https://milescole.dev/data-engineering/2024/09/17/To-V-Order-or-Not.html). In this post, I want to revisit the topic and demonstrate how V-Order can be strategically enabled in a programmatic fashion.

Since V-Order provides the most benefit and consistent improvement for Direct Lake Semantic Models, why not leverage platform metadata to enable it automatically—but only for Delta tables used by these models?

This will be a short blog—let’s get straight to the concept, the source code, and then move on to more strategic use of this feature.

# How to Implement

1. **Unset the V-Order Session Config**  
   By default, the Spark config `spark.sql.parquet.vorder.default` is set to `true`, meaning V-Order is enabled automatically for the `DataFrameWriter` class. This takes precedence if the `spark.sql.parquet.vorder.enabled` session config is unset (default), causing write operations to enable V-Order. Additionally, the `spark.microsoft.delta.parquet.vorder.property.autoset.enabled` session config ensures the Delta table V-Order property is automatically applied.  
    
   To prevent V-Order from being applied universally, we either need to unset or disable `spark.sql.parquet.vorder.default`, ensuring that no write operation automatically writes V-Ordered data. As a result, the table property won't be automatically applied.  
    ```python
    spark.conf.unset('spark.sql.parquet.vorder.default')
    ```
   You should ensure that all your data engineering jobs either unset this session config or explicitly set it to `false` in your environment configurations.


2. **Remove the V-Order Table Property from Existing Tables**  
   This step is optional but useful if you have multiple tables with V-Order enabled that are not used in Direct Lake Semantic Models. While I may provide a bulk removal script later, for now, you can manually list your tables and run an `ALTER TABLE` command to remove the property.  
    ```sql
    ALTER TABLE dbo.vordered_table UNSET TBLPROPERTIES ('delta.parquet.vorder.enabled')
    ```
   This doesn’t rewrite existing data to remove V-Order—it simply removes the feature from the table properties. Future writes will not use V-Order as long as the session config from the previous step remains unset or disabled.


3. **Schedule an Automatic V-Order Maintenance Script**  
   The script provided below should be scheduled (e.g., weekly) to automatically update tables used in Direct Lake Semantic Models, selectively enabling the V-Order Delta table property only for relevant tables.


---

While this functionality may eventually be packaged into a formal Python library, for now, I’m sharing it as a [GitHub Gist](https://gist.github.com/mwc360/e2ca91667c8fb95f75435f32aa3c27bb). Just copy and paste the code into your preferred notebook (Python, not Spark), update the workspace scope filtering, schedule it, and you're all set!

> **Why Python instead of Spark?**  
> _This workload is a great example of where plain Python shines. Since we're just calling APIs and performing lightweight metadata updates, there's no need for the overhead of Spark. Running this job in Spark would be much slower._ 

> **Why do I need to provide a list of workspaces?**  
> _Your Semantic Models could be hosted in a different workspace than your Lakehouses. Scoping to multiple workspaces allows you to bridge this separation. As long as you have write access to the source Lakehouse, you’ll be able to automatically set the table property. If no workspace list is provided, it defaults to the current workspace._


<script src="https://gist.github.com/mwc360/e2ca91667c8fb95f75435f32aa3c27bb.js"></script>

---

With this approach, there’s no need to enable V-Order by default across the board or manually analyze which tables need it. Just run this script, and any table used in a Direct Lake Semantic Model will have V-Order automatically enabled. The next time data is written to these tables, new data will be V-Ordered.  

For older data, you may want to run a full `OPTIMIZE` operation to ensure all data benefits from the optimization.

Cheers!