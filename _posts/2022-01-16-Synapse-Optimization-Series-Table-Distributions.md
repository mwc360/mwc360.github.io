---
layout: post
title: "Synapse Optimization Series: Table Distributions"
tags: [Azure Synapse, Dedicated Sql Pools, Optimization]
categories: optimization
feature-img: "assets/img/feature-img/circuit.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/circuit.jpeg"
---

Proper use of table distributions in Synapse Dedicated Sql Pools is easily the #1 shortcoming in Synapse implementations. 

If there's anything to remember from this post, it is the following:
**Synapse Dedicated Sql Pools <> SqlServer**

Dedicated Sql Pools (formerly Azuer Sql Data Warehouse) are a massively parallel processing (MPP) implementation of Microsoft SQL built exclusively for analytical workloads (i.e. data warehouseing). Under the hood, Dedicated Sql Pools have many separate CPUs that are able to operate on their own _distribution_ of data in parallel. This is what makes Synapse Dedicated Sql Pools so fast and optimized for data warehousing workloads, potentially large operations are broken into many different parallel jobs, orchestrated by a central control node.

!["SynapseArchitecture](/assets/img/posts/SynapseArchitecture.png)
_Synapse Dedicated Sql Pool Architecture_

The biggest architectural differentiator compared to SqlServer is also not so coincidentally the biggest driver of performance compared to SqlServer: **Table Distributions**.

# Table Distributions
The distribution of a table defines how it is phyically stored across the 60 distributions (think 60 Sql Databases) that make up Synapse Dedicated Sql Pools. The massive distribution of data across 60 phyical storage layers in which compute can operate on independently allows for a potential parallelism of 60. While every job levelerages parallel processing, the efficiency in doing so heavily relies on the method in which data is distributed.

By default, tables created without a defined _DISTRIBUTION_ (i.e. below) are created w/ **ROUND_ROBIN** distribution. This means that data is written randomly and evenly distributed across the 60 storage layers. This has the advantage of fast writes, an absence of data skew, and having no need to understand the underlying data and related query patterns.

```sql
CREATE TABLE dbo.table1
WITH (
    CLUSTERED COLUMNSTORE INDEX
    /*, HASH = ROUND_ROBIN */
    )
AS SELECT 1
```
The key disadvantage of **ROUND_ROBIN** distribution is that join operations involving the table will required data shuffling or broadcasting, a.k.a, data movement. The more data movement taking place to complete a SQL operation the longer it will take to complete. Sometimes this is unavoidable, or with small lookup tables, tends to have diminishing returns.

Joining a **ROUND_ROBIN** distributed table with any other table will result in data movement to complete the operation because there is no guarantee (or even likelihood) that the joined data exis



Synapse Dedicated Sql Pools use a cost based query optimizer, where the cost of different methods to return the results is calcualted and the lowest cost plan is selected to run.
