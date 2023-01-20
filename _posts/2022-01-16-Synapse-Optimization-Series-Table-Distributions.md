---
layout: post
title: "Synapse Optimization Series: Hash Table Distributions"
tags: [Azure Synapse, Dedicated Sql Pools, Optimization]
categories: Optimization
feature-img: "assets/img/feature-img/circuit.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/circuit.jpeg"
---

Proper use of table distributions in Synapse Dedicated Sql Pools is easily the #1 shortcoming in Synapse implementations.

I regularly see large queries that take hours to run (and potentially never even finish) and can almost always get them down to under a few minutes. Table distributions are the #1 thing I look at when tuning Synapse SQL.

# Synapse Dedicated Sql Pool Architecture
Dedicated Sql Pools (formerly Azuer Sql Data Warehouse) are a massively parallel processing (MPP) implementation of Microsoft SQL built exclusively for analytical workloads (i.e. data warehouseing). Under the hood, Dedicated Sql Pools have many separate CPUs that are able to operate on their own _distribution_ of data in parallel. This is what makes Synapse Dedicated Sql Pools so fast and optimized for data warehousing workloads: potentially large operations are broken into many different parallel jobs, orchestrated by a central control node.

!["SynapseArchitecture"](/assets/img/posts/Synapse-Optimization-Series-Table-Distributions/SynapseArchitecture.png)
_Synapse Dedicated Sql Pool Architecture_

The biggest architectural differentiator compared to SqlServer is also not so coincidentally the biggest driver of performance compared to SqlServer: **Table Distributions**.

# Table Distributions
The distribution of a table defines how it is phyically stored across the 60 distributions (think 60 Sql Databases) that make up Synapse Dedicated Sql Pools. The massive distribution of data across 60 phyical storage layers in which compute can operate on independently allows for a potential parallelism of 60. While every job levelerages parallel processing, the efficiency in doing so heavily relies on the method in which data is distributed.

## Round Robin Distribution
By default, tables created without a defined _DISTRIBUTION_ (i.e. below) are created w/ **ROUND_ROBIN** distribution. This means that data is written randomly and evenly distributed across the 60 storage layers. This has the advantage of fast writes, an absence of data skew, and having no need to understand the underlying data and related query patterns.

```sql
CREATE TABLE dbo.table1
WITH (
    CLUSTERED COLUMNSTORE INDEX
    /*, DISTRIBUTION = ROUND_ROBIN */
    )
AS SELECT 1
```
The key disadvantage of **ROUND_ROBIN** distribution is that join operations involving the table will required data shuffling or broadcasting from distribution to distribution, a.k.a, data movement. The more data movement taking place to complete a SQL operation the longer it will run. Sometimes this is unavoidable, or with small lookup tables, tends to have diminishing or even negligible returns.

Joining a **ROUND_ROBIN** distributed table with any other table will result in data movement to complete the operation because there is no guarantee (or even likelihood) that the common data required to perform the join exists on the same distribution, therefore the optimizer must choose to each broadcast or shuffle the data.

Synapse Dedicated Sql Pools use a cost based query optimizer, where the cost of different methods to return the results is calcualted and the lowest cost plan is selected to run.

```sql
SELECT *
FROM dbo.OrderLines ol
JOIN dbo.Product p
    ON ol.ProductId = p.ProductId 
```
<table>
<tr><th style="border-width:0px"></th><th style="border-width:0px"></th></tr>
<tr><td style="border-width:0px">
dbo.OrderLines (DISTRIBUTION = ROUND_ROBIN)
<table style="border-collapse:collapse;border-spacing:0" class="tg"><thead><tr><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">OrderLineId</th><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:center;vertical-align:top;word-break:normal">ProductId</th><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">Sales</th><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">Distribution</th></tr></thead><tbody><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">101</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">2</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">10,532</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">1</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">102</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">3</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">450</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">2</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">103</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">1</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">542</td><td style=";border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">3</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">N</td></tr></tbody></table>


</td><td style="border-width:0px">
dbo.Product (DISTRIBUTION = ROUND_ROBIN)
<table style="border-collapse:collapse;border-spacing:0" class="tg"><thead><tr><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:center;vertical-align:top;word-break:normal">ProductId</th><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">ProductName</th><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">Distribution</th></tr></thead><tbody><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">1</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">WidgetA</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">1</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">2</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">WidgetB</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">2</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">3</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">WidgetC</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">3</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">N</td></tr></tbody></table>

</td></tr> </table>

Notice that in the dbo.OrderLines table ProductId 2 exists in distribution 1 whereas in the dbo.Product table, ProductId 2 exists in distribution 2, it cannot return the result of the join at the distribution level. To return the results when data is not colocated, it will do one or multiple of 2 operations:
1. A **Broadcast Move** operation could take place to create a temporary table replicating all dbo.Product data to each of the 60 distributions. This effectively will temporarily multiply your dbo.Product storage footprint by 60x to meet the needs of this query. The larger the dataset being broadcasted the most expensive this operation is.
1. Two **Shuffle Move** operations could take place to create temporary tables reorganizing all dbo.Product and dbo.OrderLines data to be HASH distributed on ProductId, thus allowing data to be joined locally at each of the 60 distributions.

For this particular query the optimizer will select to **Broadcast Move** or **Shuffle Move** both datasets depending on table sizes.

## Hash Distribution
The most efficient way to return the query results in this example would be to first alter the distribution of both dbo.OrderLines and dbo.Product tables to be **HASH** distributed on ProductId. Hash distributing a table passes the selected column (or multiple column) values through a hashing algorithm which assigns a deterministic distribution to each distinct value. Every row that has the same hash column value is guaranteed to be physically stored on the same distribution, even for the same value contatined if multiple tables. This would result in the following:

<table>
<tr><th style="border-width:0px"></th><th style="border-width:0px"></th></tr>
<tr><td style="border-width:0px">
dbo.OrderLines (DISTRIBUTION = HASH(ProductId))
<table style="border-collapse:collapse;border-spacing:0" class="tg"><thead><tr><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">OrderLineId</th><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:center;vertical-align:top;word-break:normal">ProductId</th><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">Sales</th><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">Distribution</th></tr></thead><tbody><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">101</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">2</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">10,532</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">2</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">102</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">3</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">450</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">3</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">103</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">1</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">542</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">1</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">N</td></tr></tbody></table>


</td><td style="border-width:0px">
dbo.Product (DISTRIBUTION = HASH(ProductId))
<table style="border-collapse:collapse;border-spacing:0" class="tg"><thead><tr><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:center;vertical-align:top;word-break:normal">ProductId</th><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">ProductName</th><th style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;font-weight:bold;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">Distribution</th></tr></thead><tbody><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">1</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">WidgetA</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">1</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">2</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">WidgetB</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">2</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">3</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">WidgetC</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">3</td></tr><tr><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">...</td><td style="border-color:inherit;border-style:solid;border-width:1px;font-family:inherit;font-size:inherit;font-style:italic;overflow:hidden;padding:10px 15px;text-align:left;vertical-align:top;word-break:normal">N</td></tr></tbody></table>

</td></tr> </table>

Notice how ProductId 2 in both tables is now located in distribution 2. The optimizer will recognize that both tables are distributed on the same column which is present in the SELECT statement join condition (ol.ProductId = p.ProductId). This will result in a 100% local distribution level join taking place and will be incredibly fast.

## Replicate Distribution
**REPLICATE** distribution stores one copy of the table on each compute node aligned set of distributions. I.e. in the below table of [Synapse Service Levels](https://learn.microsoft.com/en-us/azure/synapse-analytics/sql-data-warehouse/memory-concurrency-limits#service-levels) we can see that DW100c through DW500c all have only 1 compute node which manages 60 distributions, in this case data is technically not replicated, this would be no different than **ROUND_ROBIN**. However, once we get to DW1000c we now have 2 compute nodes, each managing 30 distributions, data is now replicated.

| SKU     | Compute Nodes | Distributions per Compute node | Memory per dedicated pool (GB) |
|---------|---------------|--------------------------------|--------------------------------|
| DW100c  | 1             | 60                             | 60                             |
| DW200c  | 1             | 60                             | 120                            |
| DW300c  | 1             | 60                             | 180                            |
| DW400c  | 1             | 60                             | 240                            |
| DW500c  | 1             | 60                             | 300                            |
| DW1000c | 2             | 30                             | 600                            |
| DW1500c | 3             | 20                             | 900                            |

**REPLICATE** distribution is typically appropriate for dimension tables as this ensures that each compute node has the full dataset in its underlying distributions which allows for potentially avoiding needing to move data from node to node to produce result sets involving joins with large fact tables.

> ⚠️ Unless you are expecting to be using a Synapse SKU of DW1000c or higher in the future, I wouldn't use **REPLICATE** distribution as even though there is only one copy of the data (i.e. with DW500c and below), there is a slight overhead to maintain the replicated table cache which supports the ability to replicate the data if you did have multiple compute nodes. 

# TPC-DS 10x Scale Example
Now that we have the core concepts, lets look at a closer to real world example with a CTAS (CREATE TABLE AS SELECT) statement. 
> See my [TPC-DS DataGen for Synapse GitHub repo]() for scripts used to create the TPC-DS datasets for Synapse Dedicated Pools.

| Table             |  Row Count  |
|-------------------|-------------|
| tpcds.inventory   | 133,110,000 |
| tpcds.store_sales | 28,800,501  |
| tpcds.item        | 102,000     |

```sql
CREATE TABLE dbo.inventory_summary
    WITH (
            CLUSTERED COLUMNSTORE INDEX
            , DISTRIBUTION = ROUND_ROBIN
            ) AS

SELECT inv_item_sk
    , inv_warehouse_sk
    , i_product_name
    , AVG(inv_quantity_on_hand) AS avg_on_hand_inventory
    , MAX([ss_sales_price]) AS max_sell_price
    , MIN([ss_sales_price]) AS min_sell_price
FROM tpcds.inventory /*DISTRIBUTION = ROUND_ROBIN*/
JOIN tpcds.item /*DISTRIBUTION = ROUND_ROBIN*/
    ON inv_item_sk = i_item_sk
JOIN [tpcds].[store_sales] /*DISTRIBUTION = ROUND_ROBIN*/
    ON inv_item_sk = ss_item_sk
GROUP BY i_product_name
    , i_item_sk
    , inv_warehouse_sk
```

While this SQL is very readable, the Synapse Optimizer tends to be very literal in terms of executing plans based on how your TSQL reads, I don't find that it is as _creative_ as regular SqlServer with finding alternate and more optimal plans. This is extrmely important with the MPP architecture because depending on how your SQL is written, you could be getting worse performance when migrating from SqlServer to Synapse Dedicated Pools and a simple reorganization of some SQL could produce much better utilization of the distributed compute and the table distributions.

Notice in the below query plan how the _Group by Aggregates_ transformation takes place **after** the 3 tables are shuffled and joined.

![QueryPlanPrior](/assets/img/posts/Synapse-Optimization-Series-Table-Distributions/PlanPriorPrior.png)

> Running this statement producing ~ 1M rows took ~ **1 hour 55 minutes** on DW100c (smallrc with no other jobs running)

Ideally, since we are performing aggregates that are not dependent on the joining tables, I'd expect the _Group by Aggregates_ step to take prior **before** the 3 tables are shuffled and joined as this would result in dramatically less data being moved.

In the below SQL I rewrote the aggregations to take place as sub-queries to try and force the optimizer to perform these aggregations before data is joined, again - the optimizer tends to be very literal. 

```sql
CREATE TABLE dbo.inventory_summary
    WITH (
            CLUSTERED COLUMNSTORE INDEX
            , DISTRIBUTION = ROUND_ROBIN
            ) AS

SELECT inv.inv_item_sk
    , inv.inv_warehouse_sk
    , i_product_name
    , inv.avg_on_hand_inventory
    , ss.max_sell_price
    , ss.min_sell_price
FROM (
    SELECT inv_item_sk
        , inv_warehouse_sk
        , AVG(inv_quantity_on_hand) AS avg_on_hand_inventory
    FROM tpcds.inventory /*DISTRIBUTION = ROUND_ROBIN*/
    GROUP BY inv_item_sk
        , inv_warehouse_sk
    ) inv
JOIN tpcds.item /*DISTRIBUTION = ROUND_ROBIN*/
    ON inv.inv_item_sk = i_item_sk
JOIN (
    SELECT ss_item_sk
        , MAX([ss_sales_price]) AS max_sell_price
        , MIN([ss_sales_price]) AS min_sell_price
    FROM tpcds.store_sales /*DISTRIBUTION = ROUND_ROBIN*/
    GROUP BY ss_item_sk
    ) ss
    ON i_item_sk = ss.ss_item_sk
```
Notice that there are now multiple _Group by Aggregates_ steps taking place but they all occur **before** tables are joined and 1/2 are taking place **before** any data is shuffled... thus vastly cutting down the total size of data moved and joined to return results.

![QueryPlanPrior](/assets/img/posts/Synapse-Optimization-Series-Table-Distributions/PlanPrior2.png)

>Running this statement producing ~ 1M rows took **1 minute** on DW100c, a **155x performance improvement**

The optimizer calculated that 81% of the statement cost is related to reorganizing the post aggregation rows of the tpcds.inventory table.

Since the tables are joining on the item_sk column we can infer that the optimizer is planning to shuffle these tables on this column. We can confirm this via looking at the D-SQL plan by putting _EXPLAIN_ at the start of the query and running it, this unfortunately outputs XML which is visually difficult to interpret.

The key portion of the very paired down XML plan below is the **SHUFFLE_MOVE** _dsql_operation_ and the _shuffle_columns_ element, this highlights that the underlying data will be shuffled on the __item_sk_ columns:
```xml
    <dsql_operation operation_type="SHUFFLE_MOVE">
      <operation_cost cost="22.032" accumulative_cost="22.032" average_rowsize="54" output_rows="102000" GroupNumber="20" />...
      <shuffle_columns>i_item_sk;</shuffle_columns>
    <dsql_operation operation_type="SHUFFLE_MOVE">
      <operation_cost cost="8.1419184" accumulative_cost="30.1739184" average_rowsize="22" output_rows="92521.8" GroupNumber="53" />...
      <shuffle_columns>ss_item_sk;</shuffle_columns>
    </dsql_operation>
    <dsql_operation operation_type="SHUFFLE_MOVE">
      <operation_cost cost="81.6" accumulative_cost="111.7739184" average_rowsize="20" output_rows="1020000" GroupNumber="39" />...
      <shuffle_columns>inv_item_sk;</shuffle_columns>
    </dsql_operation>
```

If we were to change the distribution of all tables to be **HASH** distributed on the item_sk in each table before running our statement we will continue to improve our results. We can use the below Sql to make these changes, the proc to perform this change is at the end of the post and in my [Synapse Utilities GitHub Repo]()
```sql
EXEC dbo.AlterTableDistribution 'tpcds', 'item', 'HASH(i_item_sk)'
EXEC dbo.AlterTableDistribution 'tpcds', 'inventory', 'HASH(inv_item_sk)'
EXEC dbo.AlterTableDistribution 'tpcds', 'store_sales', 'HASH(ss_item_sk)'
```

```sql
CREATE TABLE dbo.inventory_summary
    WITH (
            CLUSTERED COLUMNSTORE INDEX
            , DISTRIBUTION = ROUND_ROBIN
            ) AS

SELECT inv.inv_item_sk
    , inv.inv_warehouse_sk
    , i_product_name
    , inv.avg_on_hand_inventory
    , ss.max_sell_price
    , ss.min_sell_price
FROM (
    SELECT inv_item_sk
        , inv_warehouse_sk
        , AVG(inv_quantity_on_hand) AS avg_on_hand_inventory
    FROM tpcds.inventory /*DISTRIBUTION = HASH(inv_item_sk)*/
    GROUP BY inv_item_sk
        , inv_warehouse_sk
    ) inv
JOIN tpcds.item /*DISTRIBUTION = HASH(i_item_sk)*/
    ON inv.inv_item_sk = i_item_sk
JOIN (
    SELECT ss_item_sk
        , MAX([ss_sales_price]) AS max_sell_price
        , MIN([ss_sales_price]) AS min_sell_price
    FROM tpcds.store_sales /*DISTRIBUTION = HASH(i_item_sk)*/
    GROUP BY ss_item_sk
    ) ss
    ON i_item_sk = ss.ss_item_sk
```
Notice that the resulting query plan below doesn't have any broadcast or shuffle move operations.

![QueryPlanAfter](/assets/img/posts/Synapse-Optimization-Series-Table-Distributions/PlanAfter.png)

>Running this statement took ~ **12 seconds** on DW100c, a 5x improvement from the prior change

Good improvement but we aren't done. We could distribute the target table (dbo.inventory_summary) on the same item_sk to completely avoid data leaving each individual distribution. While the prior query plan elimiates data movement to produce the result set, it must return the results to the compute node(s) so that the data can be **ROUND_ROBIN** distributed. The below will result in 0 data movement, all operations take place soley on each of the 60 distributions, all in parallel.

```sql
CREATE TABLE dbo.inventory_summary
    WITH (
            CLUSTERED COLUMNSTORE INDEX
            , DISTRIBUTION = HASH (inv_item_sk)
            ) AS

SELECT inv.inv_item_sk
    , inv.inv_warehouse_sk
    , i_product_name
    , inv.avg_on_hand_inventory
    , ss.max_sell_price
    , ss.min_sell_price
FROM (
    SELECT inv_item_sk
        , inv_warehouse_sk
        , AVG(inv_quantity_on_hand) AS avg_on_hand_inventory
    FROM tpcds.inventory /*DISTRIBUTION = HASH(inv_item_sk)*/
    GROUP BY inv_item_sk
        , inv_warehouse_sk
    ) inv
JOIN tpcds.item /*DISTRIBUTION = HASH(i_item_sk)*/
    ON inv.inv_item_sk = i_item_sk
JOIN (
    SELECT ss_item_sk
        , MAX([ss_sales_price]) AS max_sell_price
        , MIN([ss_sales_price]) AS min_sell_price
    FROM tpcds.store_sales /*DISTRIBUTION = HASH(i_item_sk)*/
    GROUP BY ss_item_sk
    ) ss
    ON i_item_sk = ss.ss_item_sk
```
_Estimated query plans do now show or calculate data movement for interting into tables (i.e. CTAS) so the plan will look identical to the prior._
>Running this statement took ~ **8 seconds** on DW100c, a 1.5x improvement from the prior change

>  This query now runs **862x faster** than where we started!

# Selecting the right distribution
Picking the ideal distribution can be difficult, especially the more complex the query is, you will have to pick and choose to eliminate the most costly data movement and consider what makes sense for your most common queries involving tables.

Here's some guidance for picking the right distribution column:

1. Look at the join conditions for common columns 
1. Prioritize tables that have the biggest cost impact to query plans
1. When running CTAS, INSERT, or even UPDATE statements, consider the distribution of the target table you are updating, inserting into, or creating. If you can align both your source and target tables on the same distribution column 

# Quickly changing distributions
I created the below stored procedure to simplify the process of altering the distribution of any table. It compresses ~ 9 lines of TSQL to 1 and will maintain the re-implement the same table index.

Happy tuning!

```sql
/*
EXEC dbo.AlterTableDistribution 'dbo', 'table1', 'HASH(column1)'
*/
CREATE PROC dbo.AlterTableDistribution @schemaName VARCHAR(128)
    , @tableName VARCHAR(128)
    , @newDistribution VARCHAR(150)
AS
BEGIN
    DECLARE @fullyQualifiedTableName VARCHAR(400) = '[' + @schemaName + '].[' + @tableName + ']'
    DECLARE @index VARCHAR(200) = (
            SELECT CASE i.type
                    WHEN 0
                        THEN 'CLUSTERED COLUMNSTORE INDEX'
                    WHEN 1
                        THEN CONCAT (
                                'CLUSTERED INDEX ('
                                , STRING_AGG(CONVERT(VARCHAR(MAX), c.name), ', ') WITHIN GROUP (
                                        ORDER BY ic.key_ordinal ASC
                                        )
                                    , ')'
                                )
                    WHEN 5
                        THEN 'CLUSTERED COLUMNSTORE INDEX'
                    END AS TableIndex
            FROM sys.tables t
            LEFT JOIN sys.indexes i
                ON t.object_id = i.object_id
                    AND i.type IN (0, 1, 5)
            LEFT JOIN sys.index_columns ic
                ON i.index_id = ic.index_id
                    AND i.object_id = ic.object_id
            LEFT JOIN sys.columns c
                ON ic.column_id = c.column_id
                    AND ic.object_id = c.object_id
            WHERE t.object_id = object_id(@fullyQualifiedTableName)
            GROUP BY i.type
            )
    DECLARE @sql NVARCHAR(1000) = '
CREATE TABLE [' + @schemaName + '].[' + @tableName + '_new]
WITH (
            ' + @index + '
            , DISTRIBUTION = ' + @newDistribution + '
            )
AS SELECT * FROM [' + @schemaName + '].[' + @tableName + ']

RENAME OBJECT [' + @schemaName + '].[' + @tableName + '] to [' + @tableName + '_old]
RENAME OBJECT [' + @schemaName + '].[' + @tableName + '_new] to [' + @tableName + ']
DROP TABLE [' + @schemaName + '].[' + @tableName + '_old]'

    PRINT (@sql)

    EXEC sp_executesql @sql
END
```