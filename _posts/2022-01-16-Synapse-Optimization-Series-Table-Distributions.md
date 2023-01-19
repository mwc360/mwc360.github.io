---
layout: post
title: "Synapse Optimization Series: Table Distributions"
tags: [Azure Synapse, Dedicated Sql Pools, Optimization]
categories: Optimization
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
    /*, DISTRIBUTION = ROUND_ROBIN */
    )
AS SELECT 1
```
The key disadvantage of **ROUND_ROBIN** distribution is that join operations involving the table will required data shuffling or broadcasting, a.k.a, data movement. The more data movement taking place to complete a SQL operation the longer it will run. Sometimes this is unavoidable, or with small lookup tables, tends to have diminishing returns.

Joining a **ROUND_ROBIN** distributed table with any other table will result in data movement to complete the operation because there is no guarantee (or even likelihood) that the common data required to perform the join exists on the same distribution, therefore the optimizer must choose to each broadcast or shuffle the data.

| CustomerId | ProductId | Sales  | 
|------------|-----------|--------|
| 1          | 1         | 10,532 |
| 2          | 1         | 10,532 |
| 3          | 3         | 542    |


Synapse Dedicated Sql Pools use a cost based query optimizer, where the cost of different methods to return the results is calcualted and the lowest cost plan is selected to run.

<table>
<tr><th></th><th></th></tr>
<tr><td>

| OrderLineId | ProductId | Sales  | _Distribution_ |
|-------------|:---------:|--------|----------------|
| 101         | 1         | 10,532 | _1_            |
| 102         | 1         | 10,532 | _2_            |
| 103         | 3         | 542    | _3_            |
| ...         | ...       | ...    | _N_            |

</td><td>

| ProductId | Name    | _Distribution_ |
|:---------:|---------|----------------|
| 1         | WidgetA | _1_            |
| 2         | WidgetB | _2_            |
| 3         | WidgetC | _3_            |
| ...       | ...     | _N_            |

</td></tr> </table>


```sql
SELECT *
FROM dbo.OrderLines ol
JOIN dbo.Product p
    ON ol.ProductId = p.ProductId 
```
# TEST 
<table>
<tr><th style="border-color:#000000"></th><th style="border-color:#000000"></th></tr>
<tr><td>
dbo.OrderLines (DISTRIBUTION = ROUND_ROBIN)
<table style="border-collapse:collapse;border-spacing:0" class="tg"><thead><tr><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-weight:bold;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">OrderLineId</th><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-weight:bold;overflow:hidden;padding:10px 5px;text-align:center;vertical-align:top;word-break:normal">ProductId</th><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-weight:bold;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">Sales</th><th style="background-color:#efefef;border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-style:italic;font-weight:bold;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">Distribution</th></tr></thead><tbody><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">101</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">2</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">10,532</td><td style="background-color:#efefef;border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-style:italic;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">1</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">102</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">3</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">450</td><td style="background-color:#efefef;border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-style:italic;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">2</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">103</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">1</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">542</td><td style="background-color:#efefef;border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-style:italic;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">3</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="background-color:#efefef;border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-style:italic;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">N</td></tr></tbody></table>


</td><td>
dbo.Product (DISTRIBUTION = ROUND_ROBIN)
<table style="border-collapse:collapse;border-spacing:0" class="tg"><thead><tr><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-weight:bold;overflow:hidden;padding:10px 5px;text-align:center;vertical-align:top;word-break:normal">ProductId</th><th style="border-color:black;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-weight:bold;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">ProductName</th><th style="background-color:#efefef;border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-style:italic;font-weight:bold;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">Distribution</th></tr></thead><tbody><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">1</td><td style="border-color:black;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">WidgetA</td><td style="background-color:#efefef;border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-style:italic;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">1</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">2</td><td style="border-color:black;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">WidgetB</td><td style="background-color:#efefef;border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-style:italic;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">2</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">3</td><td style="border-color:black;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">WidgetC</td><td style="background-color:#efefef;border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-style:italic;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">3</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:black;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="background-color:#efefef;border-color:inherit;border-style:solid;border-width:1px;font-family:Arial, sans-serif;font-size:14px;font-style:italic;overflow:hidden;padding:10px 5px;text-align:left;vertical-align:top;word-break:normal">N</td></tr></tbody></table>

</td></tr> </table>

Notice that in the dbo.OrderLines table ProductId 2 exists in distribution 1 whereas in the dbo.Product table, ProductId 2 exists in distribution 2, it cannot return the result of the join at the distribution level. To return the results when data is not colocated, it will do one or multiple of 3 operations:
1. A **Broadcast Move** operation could take place to create a temporary table replicating all dbo.Product data to each of the 60 distributions. This effectively will temporarily multiply your dbo.Product storage footprint by 60x to meet the needs of this query. The larger the dataset being broadcasted the most expensive this operation is.
1. Two **Shuffle Move** operations could take place to create temporary tables reorganizing all dbo.Product and dbo.OrderLines data to be HASH distributed on ProductId, thus allowing data to be joined locally at each of the 60 distributions.
1. A compute node join could take place in which all data to produce the results are returned to each compute node (1 until you get to DW1000c).

For this particular query the optimizer will select to **Broadcast Move** the smaller of the two datasets, likely the dbo.Product table.

The estimated query plan looks like the following:
QUERY PLAN

## Hash 