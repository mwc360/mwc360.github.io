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
>**Synapse Dedicated Sql Pools <> SqlServer**

Dedicated Sql Pools (formerly Azuer Sql Data Warehouse) are a massively parallel processing (MPP) implementation of Microsoft SQL built exclusively for analytical workloads (i.e. data warehouseing). Under the hood, Dedicated Sql Pools have many separate CPUs that are able to operate on their own _distribution_ of data in parallel. This is what makes Synapse Dedicated Sql Pools so fast and optimized for data warehousing workloads, potentially large operations are broken into many different parallel jobs, orchestrated by a central control node.

!["SynapseArchitecture"](/assets/img/posts/Synapse-Optimization-Series-Table-Distributions/SynapseArchitecture.png)
_Synapse Dedicated Sql Pool Architecture_

The biggest architectural differentiator compared to SqlServer is also not so coincidentally the biggest driver of performance compared to SqlServer: **Table Distributions**.

# Table Distributions
The distribution of a table defines how it is phyically stored across the 60 distributions (think 60 Sql Databases) that make up Synapse Dedicated Sql Pools. The massive distribution of data across 60 phyical storage layers in which compute can operate on independently allows for a potential parallelism of 60. While every job levelerages parallel processing, the efficiency in doing so heavily relies on the method in which data is distributed.

By default, tables created without a defined _DISTRIBUTION_ (i.e. below) are created w/ **ROUND_ROBIN** distribution. This means that data is written randomly and evenly distributed across the 60 storage layers. This has the advantage of fast writes, an absence of data skew, and having no need to understand the underlying data and related query patterns.

```sql
CREATE TABLE dbo.table1
WITH (
    HEAP
    /*, DISTRIBUTION = ROUND_ROBIN */
    )
AS SELECT 1
```
The key disadvantage of **ROUND_ROBIN** distribution is that join operations involving the table will required data shuffling or broadcasting, a.k.a, data movement. The more data movement taking place to complete a SQL operation the longer it will run. Sometimes this is unavoidable, or with small lookup tables, tends to have diminishing returns.

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

Notice that in the dbo.OrderLines table ProductId 2 exists in distribution 1 whereas in the dbo.Product table, ProductId 2 exists in distribution 2, it cannot return the result of the join at the distribution level. To return the results when data is not colocated, it will do one or multiple of 3 operations:
1. A **Broadcast Move** operation could take place to create a temporary table replicating all dbo.Product data to each of the 60 distributions. This effectively will temporarily multiply your dbo.Product storage footprint by 60x to meet the needs of this query. The larger the dataset being broadcasted the most expensive this operation is.
1. Two **Shuffle Move** operations could take place to create temporary tables reorganizing all dbo.Product and dbo.OrderLines data to be HASH distributed on ProductId, thus allowing data to be joined locally at each of the 60 distributions.
1. A compute node join could take place in which all data to produce the results are returned to each compute node (1 until you get to DW1000c).

For this particular query the optimizer will select to **Broadcast Move** or **Shuffle Move** both datasets depending on dataset sizes.

## Hash Distribution
The most efficient way to return the query results would be to first alter the distribution of both dbo.OrderLines and dbo.Product tables to be **HASH** distributed on ProductId. Hash distributing a table passes the selected column (or multiple column) values through a hashing algorithm which assigns a deterministic distribution to each distinct value. This would result in the following:

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

## TPC-DS 10x Scale Example
Now that we have the core concepts, lets look at a closer to real world example with a CTAS (CREATE TABLE AS SELECT) statement.

| Table           |  Row Count  |
|-----------------|-------------|
| tpcds.item      | 102,000     |
| tpcds.inventory | 133,110,000 |

```sql
CREATE TABLE dbo.test1
    WITH (
            HEAP
            , DISTRIBUTION = ROUND_ROBIN
            ) AS
SELECT *
FROM tpcds.inventory /*DISTRIBUTION = ROUND_ROBIN*/
JOIN tpcds.item /*DISTRIBUTION = ROUND_ROBIN*/
    ON inv_item_sk = i_item_sk
```
_Note that HEAP is being used instead of CCI to remove the time impact of creating the clustered columnstore index on this 133M row dataset_

The estimated query plan looks like the following and has an estimated cost of 35K:

![QueryPlanPrior]({{"/assets/img/posts/Synapse-Optimization-Series-Table-Distributions/PlanPrior.png" | relative_url}})

The optimizer as calculated that 97% of the statement cost is related to reorganizing the 113 million rows of data in the tpcds.inventory table.

Since the tables are joining on the item_sk column we can infer that the optimizer is planning to shuffle these tables on this column. We can confirm this via looking at the D-SQL plan by putting _EXPLAIN_ at the start of the query and running it, this unfortunately outputs XML which is visually difficult to interpret.

The key portion of the very paired down XML plan below is the **SHUFFLE_MOVE** _dsql_operation_ and the _shuffle_columns_ element:
```xml
    <dsql_operation operation_type="SHUFFLE_MOVE">
      <operation_cost cost="242.352" accumulative_cost="242.352" average_rowsize="594" output_rows="102000" GroupNumber="4" />
      <shuffle_columns>i_item_sk;</shuffle_columns>
    <dsql_operation operation_type="SHUFFLE_MOVE">
      <operation_cost cost="8519.04" accumulative_cost="8761.392" average_rowsize="16" output_rows="133110000" GroupNumber="3" />
      <shuffle_columns>inv_item_sk;</shuffle_columns>
    </dsql_operation>
```
>Running this statement producing 113M rows took **15 minutes** on DWU100c

If we were to change the distribution of both tables to be **HASH** distributed on the item_sk in each table we will get dramatically better results. Notice that the resulting query plan doesn't have any broadcast or shuffle move operations.

```sql
CREATE TABLE dbo.test1
    WITH (
            HEAP
            , DISTRIBUTION = ROUND_ROBIN
            ) AS
SELECT *
FROM tpcds.inventory /*DISTRIBUTION = HASH(inv_item_sk)*/
JOIN tpcds.item /*DISTRIBUTION = HASH(i_item_sk)*/
    ON inv_item_sk = i_item_sk
```
![QueryPlanAfter]({{"/assets/img/posts/Synapse-Optimization-Series-Table-Distributions/PlanAfter1.png" | relative_url}})
>Running this statement took **10 minutes** on DWU100c

Good improvement but we aren't done. We could distribute the target table (dbo.test1) on the same item_sk to completely avoid data leaving each individual distribution. While the prior query plan elimiates data movement to produce the result set, it must return the results to the compute node(s) so that the data can be **ROUND_ROBIN** distributed. The below will result in 0 data movement, all operations take place soley on each of the 60 distributions, all in parallel.

```sql
CREATE TABLE dbo.test1
    WITH (
            HEAP
            , DISTRIBUTION = HASH(inv_item_sk)
            ) AS
SELECT *
FROM tpcds.inventory /*DISTRIBUTION = HASH(inv_item_sk)*/
JOIN tpcds.item /*DISTRIBUTION = HASH(i_item_sk)*/
    ON inv_item_sk = i_item_sk
```
>Running this statement took ~ **3 minutes** on DWU100c

## Selecting the right distribution
Picking the ideal distribution can be difficult, especially the more complex the query is, you will have to pick and choose to eliminate the most costly data movement and consider what makes sense for your most common queries involving tables.

Here's some guidance for picking the right distribution column:

1. Look at the join conditions for common columns 
1. Prioritize tables that have the biggest cost impact to query plans
1. When running CTAS, INSERT, or even UPDATE statements, consider the distribution of the target table you are updating, inserting into, or creating. If you can align both your source and target tables on the same distribution column 