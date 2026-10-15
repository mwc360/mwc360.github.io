---
layout: post
content_tracks: [fabric, databricks]
context_note: "August 2024 migration viewpoint comparing classic Azure Databricks clusters/pools with Fabric capacity-backed Spark. West Central US rates and Edsv5 assumptions are historical. Fabric CU consumption is not the capacity invoice or marginal job cost; this is not a current serverless pricing comparison."
title: "From Databricks to Fabric: A Deep Dive into Spark Cluster Differences"
tags: [Apache Spark, Configuration, Cost Optimization, Migration]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-alex-andrews-271121-1203808.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-alex-andrews-271121-1203808.jpeg"
published: true
---

Every software platform has its own terminology, and when terms overlap but don't mean the same thing, it can be quite confusing. For example, coming from my years as a developer in Databricks land, I initially assumed that Fabric Spark Pools were just like Pools in Databricks. However, as I discovered, this assumption was completely wrong—and understanding this distinction is key to designing the right architecture.

In this post, I'll cover the key differences between Spark clusters in each platform in hopes that those with a Databricks background won't get tripped up like I did.

> **TL/DR:** Fabric Spark Pools <> Databricks Pools
<br>Fabric Spark Pools = Virtual clusters with workspace default software
<br>Fabric Environments = Personalized virtual clusters with custom software

# Spark Pools in Fabric vs. Databricks
It’s easy to assume that Fabric Spark Pools are similar to Databricks Pools, this is a reasonable guess based on the name. However, this is not the case, and understanding the difference is vital. While Databricks Pools focus on speeding up cluster startup times by keeping a managed cache of VMs, Fabric Spark Pools serve a completely different purpose.

## Databricks Pools: _Managed VM Cache_
In Databricks, Pools (formerly Instance Pools) are designed to reduce cluster startup latency by maintaining a warm pool of VMs. This allows for quick provisioning of clusters by repurposing the same VMs across different clusters. Essentially, the focus here is on efficiency in starting clusters and reusing resources.

![Databricks Pool Config](/assets/img/posts/Databricks-v-Fabric-Spark-Pools/db-pool.png)

## Fabric Spark Pools: _Virtual Cluster Configurations_
In contrast, Fabric Spark Pools act as virtual cluster configurations that are defined at the workspace or capacity level. Since these are virtual clusters, unless using high-concurrency mode, each Notebook or SDJ that runs targeting a specific Spark Pool will create its own instance of that cluster configuration. This means that you can run many notebooks or job definitions referencing the same Spark Pool without hitting concurrency constraints, aside from what your chosen Fabric SKU specifies.

Within the Spark Pool category, there are two types of Spark Pools in Fabric today, _Custom Pools_ (which can be created at the Workspace or Capacity level) and _Starter Pools_. 
1. **[Starter Pools](https://learn.microsoft.com/en-us/fabric/data-engineering/configure-starter-pools)**: allow for consuming nodes from a pool of Microsoft managed VMs that have the Fabric Runtime and Spark already running. This allows for a cluster startup time of about 5 to 10 seconds. This dramatically boosts developer productivity. A few key limitations exist with Starter Pools today:
  - They are not available in workspaces that have a managed vNet enabled.
  - Autoscale and Dynamic Allocation cannot be disabled.
  - Starter Pools only use the Medium node size.
  - Additional Starter Pools cannot be created, there is one Starter Pool created by default for every Fabric Workspace.
1. **[Custom Pools](https://learn.microsoft.com/en-us/fabric/data-engineering/create-custom-spark-pools)**: cluster nodes are provisioned on-demand, and therefore the startup time is between 2-4 minutes on average.

The following settings exist for Spark Pools (some of which cannot be changed for Starter Pools):
1. **Spark pool name**
1. **Node family**: right now the only option is memory optimized, in the future I expect that there will be other options such as compute optimized.
1. **Node size**: T-shirt size of node from Small, Medium, Large, XL, and XXL.
1. **Autoscale**: Flag to determine whether the cluster will scale executors up and down dependent on compute needs.
1. **Node count**: Count of nodes (w/ min/max if autoscale is enabled). A few important points:
    - The count of nodes is inclusive of the Driver. If you want to run a job on a cluster with 4 workers (nodes) you need to set the node count to 5 (4 workers + 1 driver).
    - Setting the node count to 1 makes it a single node cluster where 1 core on the node acts as the driver, and the rest of the cores act as individual workers.
1. **Dynamic Allocation**: allows the number of executors allocated to a Spark application to be dynamically adjusted based on the workload. When enabled, Spark can automatically add or remove executors during the runtime of a Spark job based on the stage of the job and the resource requirements at any given time.

![Fabric Pool Config](/assets/img/posts/Databricks-v-Fabric-Spark-Pools/fabric-pool.png)

You'll notice that Spark Pools do not allow you to set the Runtime version, libraries, spark configs, etc. This is where Environments come into play. 

## Fabric Environments: _Personalized Virtual Cluster Configurations_
Environments in Fabric allow you to further customize how a cluster is created by configuring software settings like libraries, Spark configurations, the Fabric Runtime version, and even fine tuning the size and scale settings defined in Spark Pools. This separation between Spark Pools, which focus on hardware, and Environments, which focus on software, allows for a more modular approach to managing Spark clusters.

This separation means that as a workspace admin, you can define a few Spark Pools that fit your users' needs, and then users can apply different environment configurations as needed, such as installing specific libraries, setting cluster configurations, and/or choosing a specific Fabric Runtime.

![Fabric Environment Config](/assets/img/posts/Databricks-v-Fabric-Spark-Pools/fabric-environment.png)

## Databricks Clusters: _Personalized Clusters_
Lastly, we have Clusters in Databricks. Clusters can contain all hardware and software configuration settings OR you can use them in conjunction with Pools so that the nodes of the Cluster come from the managed pool of VMs. Using Cluters with Pools is typically useful for decreasing latency between jobs in production scenarios since the 2-4 minute cluster start up time can be reduced to ~ 40 seconds if you have warm nodes in your pool.

To enforce the use of specific compute sizes, similar to Spark Pools, Databricks provides Policies which can be used to enforce that new clusters are created per the defined specs or limits.

![Databricks Cluster Config](/assets/img/posts/Databricks-v-Fabric-Spark-Pools/db-cluster.png)

# VM SKU Options
In Databricks, you select which Virtual Machine (VM) SKU to use for your driver and executors, while having this option is _nice for those well versed in VM specs_, there's a very strategic reason why there's no VM SKU option beyond the Node Type when configuring Fabric Spark Pools: most developers are not experts in the specs and price/performance metrics of various different VM options. However, Microsoft is, and therefore keeps Fabric Spark running on VM SKUs by region that provide the best price/performance mix.  

In today's fast changing world of compute, I much prefer having this managed and maintained automatically for a few reasons:
1. **Keeping up with new chip performance improvements**: Every year there's a newer generation of Intel and AMD chips, this potentially leaves you with 2 times a year that you might need to test your workloads, request vCore Family specific quota increases, and update source code (or potentially manually update deployed clusters and job schedules) to ensure that the newest and fastest chip is being used. In Fabric, this isn't something you need to worry about and your can't fall into the scenario where you're just too busy with new business priorities to update the configuration of a bunch of stable jobs you haven't touched in ages. 
1. **Keeping up with SKUs that get deprecated, retired, or have limited capacity**: With next generation hardware being available, naturally, prior-generation hardware typically stops being deployed, and old hardware gets replaced. If you are running workloads on prior-generation hardware there's a good chance you'll run into capacity limits at some point, and as every year goes by, the chances of hardware retirement increases. Again, in Fabric you don't have to worry about this.

# Cost Differences
There are 4 primary differences between Fabric and Databricks that should be considered when budgeting or comparing each:

## 1. Billing Model
### Fabric Capacities
This one is obvious and well known, likely because it is admittedly counterintuitive for data engineers coming from Azure services that have true pay-per-consumption models. Building on its Power BI platform heritage, Fabric uses a Capacity model. In this model, you purchase a certain amount of compute power, measured in Capacity Units (CUs). These CUs can be utilized across any Fabric workload within the converged data platform, including Spark, data warehousing, real-time streaming, reporting, machine learning, custom APIs, and more. Fabric SKUs purchased via the Azure portal operate in pay-as-you-go mode, meaning that you can create a capacity, run a workload, and then pause your capacity.

## Databricks
The classic Databricks compute compared here bills Azure infrastructure plus DBUs for the applicable workload and runtime. You don't need to pause a Fabric-style capacity, but provisioned or idle resources can still cost money. The historical rates below differ by compute type and Photon selection; proprietary functionality alone does not establish the total cost or price/performance of a job.

## 2. Billing Rates
People often want to know which is cheaper. The answer however, is extremely complicated because both operate on completely different billing models and each has it's situational nuances.  For current rates see each respective pricing calculator.

## 3. Billing Reservations
Fabric currently offers one year reservations on Fabric SKUs that provides a 40% discount on pay-as-you-go pricing. Note, just like other reservation models, purchasing a reservation only makes sense if intending to keep the capacity enabled 24/7. That said, Fabric capacities have a feature called _smoothing_ where capacity demand is spread forward across a rolling 24 hours window to reduce job contention and scheduling concerns. 

With Databricks you can separately purchase one or three year virtual machine reservations (~41% and ~62% respective savings), however this really only makes sense if you have VMs running 24/7 as the Azure VM reservation model is designed for truly consistent hardware needs. For Databricks licensings fees known as DBUs (Databricks Units), you can prepurchase DBUs with volume discounting that is valid for a one or three years. If prepurchasing DBUs, just like Fabric Capacities, it is a use it or lose it model, so plan accordingly.

Databricks also gives you the ability to leverage spot instances which decrease the VM cost by around 80% when a spot instance is available. Workloads with mission critical SLAs may be better with on-demand compute (non-spot) so that you can't have periodic added latency due to worker node eviction.

# Closing Thoughts
Understanding the differences in how Spark clusters works between Fabric and Databricks is essential for making informed decisions about your architecture. Fabric’s approach of separating hardware configuration (Spark Pools) from software customization (Environments) offers a flexible and modular system that can adapt to various needs and with the opportunity for greatly improved developer productivity via access to low latency starter pools.
