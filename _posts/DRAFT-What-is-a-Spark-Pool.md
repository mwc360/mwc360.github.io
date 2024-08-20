---
layout: post
title: "From Databricks to Fabric: A Deep Dive into Spark Compute Differences"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-17483907.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-17483907.jpeg"
published: false
---

Every software platform has its own terminology, and when terms overlap but don't mean the same thing, it can be quite confusing. For example, coming from my years as a developer in Databricks land, I initially assumed that Fabric Spark Pools were just like Pools in Databricks. However, as I discovered, this assumption was completely wrong—and understanding this distinction is key to designing the right architecture.

In this post, I'll cover the key differences between Spark compute in each platform in hopes that those coming from Databricks will get tripped up a bit less than I did.

> _TL/DR:_ Fabric Spark Pools <> Databricks Pools
<br>Fabric Spark Pool = Hardware size and scale template
<br>Fabric Environment = Personalization of hardware template from the Spark Pool + software

# Spark Pools in Fabric vs. Databricks
It’s easy to assume that Fabric Spark Pools are similar to Databricks Pools, which would be a reasonable guess based on the name. However, this is not the case, and understanding the difference is vital. While Databricks Pools focus on speeding up cluster startup by keeping a managed cache of VMs, Fabric Spark Pools serve a completely different purpose.

## Databricks Pools: Managed VM Cache
In Databricks, Pools (formerly Instance Pools) are designed to reduce cluster startup latency by maintaining a warm pool of VMs. This allows for quick provisioning of clusters by repurposing the same VMs across different clusters. Essentially, the focus here is on efficiency in starting clusters and reusing resources.

## Fabric Spark Pools: Compute Templates
In contrast, Fabric Spark Pools act as compute size and scale templates. They are more like hardware templates that define the resources (like the number and size of nodes) available for running Spark jobs. This means you can attach multiple notebooks or job definitions to the same Spark Pool without hitting concurrency constraints, aside from what your chosen Fabric SKU specifies.

The following can be configured:
1. **Spark pool name** (of course)
1. **Node family**: right now the only option is memory optimized, in the future I expect that there will be other options such as compute optimized.
1. **Node size**: T-shirt size of node from Small, Medium, Large, XL, and XXL.
1. **Autoscale**: Flag to determine whether the cluster will scale executors up and down dependent on compute needs.
1. **Node count**: Count of nodes (w/ min/max if autoscale is enabled). A few important points:
    - The count of nodes is inclusive of the Driver. If you want to run a job on a cluster with 4 workers (nodes) you need to set the node count to 5 (4 workers + 1 driver).
    - Setting the node count to 1 makes it a single node cluster where 1 core on the node acts as the driver, and the rest of the cores act as individual workers.
1. **Dynamic Allocation**: allows the number of executors allocated to a Spark application to be dynamically adjusted based on the workload. When enabled, Spark can automatically add or remove executors during the runtime of a Spark job based on the stage of the job and the resource requirements at any given time.

![alt text](image.png)

You'll notice that a Spark Pool does not allow you to set the Runtime version, libraries, spark configs, etc. This is where Environments come into play. 

## Fabric Environments: Personalized Compute
Environments in Fabric allow you to further customize the hardware template provided by a Spark Pool and configure software settings like libraries, Spark configurations, and even the Fabric Runtime version. This separation between compute and environment allows for a more modular approach to managing Spark clusters.

This separation means that as a workspace admin, you can define a few compute sizes that fit your users' needs, and users can then apply different environment configurations as needed, such as installing specific libraries, setting cluster configurations, and/or choosing a specific Fabric Runtime.

## Databricks Clusters: Personalized Compute
Lastly, we have Cluster in Databricks. Clusters can contain all hardware and software configuration settings OR you can use them in conjunction with Pools so that the nodes of the Cluster come from the managed pool of VMs. Using Cluters with Pools is typically useful for decreasing latency between jobs in production scenarios since the 2-4 minute cluster start up time can be reduced to ~ 40 seconds if you have warm nodes in your pool.

To enforce the use of specific compute sizes, similar to Spark Pools, Databricks provides Policies which can be used to enforce that new clusters are created per the defined specs or limits. The downside of Policies is that they only apply to new compute, pre-existing cluster configurations don't evaluate the Policy until they are edited.

# VM SKU Options
In Databricks, you have to select which Virtual Machine (VM) SKU to use for your driver and executors, while having this option is _nice for the those well versed in VM specs_, there's a very strategic reason why there's no VM SKU option beyond the Node Type when configuring Fabric Spark Pools: most developers are not experts in the specs and price/performance metrics of various different VM options. However, Microsoft is, and therefore keeps Fabric Spark running on VM SKUs by region that provide the best price/performance mix.  

In today's fast changing world of compute, I much prefer having this managed and maintained automatically for a few reasons:
1. **Keeping up with new chip performance improvements**: Every year there's a newer generation of Intel and AMD chips, this potentially leaves you with 2 times a year that you might need to test your workloads, request vCore Family specific quota increases, and update source code (or potentially manually update deployed clusters and job schedules) to ensure that the newest and fastest chip is being used. In Fabric, this isn't something you need to worry about and your can't fall into the scenario where you're just too busy with new business priorities to update the configuration of a bunch of stable jobs you haven't touched in ages. 
1. **Keeping up with SKUs that get deprecated or have limited capacity**: With next generation hardware being available, naturally, prior-generation hardware typically stops being deployed, and old hardware gets replaced. If you are running workloads on prior-generation hardware there's a good chance you'll run into capacity limits at some point, and as every year goes by, the chances of hardware retirement increase. Again, in Fabric you don't have to worry about this.

# Cost Differences
There are 3 primary differences between Fabric and Databricks that should be considered when budgeting or comparing each:

## 1. Billing Model
### Fabric Capacities
This one obvious and well known. Fabric operates on a Capacity model where you purchase an amount of potential compute to be used measured as Capacity Units (CUs), these CUs can be used across any Fabric Workload in the converged data platform (Spark, data warehousing, real-time streaming, reporting, machine learning, custom APIs, etc.). Overtime, more features have been and are continuing to be added to make the capacity model more flexible and provide controls for managing consumption. 

## Databricks
Databricks operates on a pure serverless model, you pay for the compute used plus a licensing multiplier. Depending on the feature used the multiplier will vary. As a general rule of thumb, anytime you deviate from open source capabilities and use Databricks propriatary tech (i.e. Photon and Delta Live Tables), the licensing multiplier is significantly higher. Licensing multipliers are important to consider in designing a solution as it may change how you actually organize and orchestrate your processes, see my post on [the TCO of Photon in Databricks](https://milescole.dev/data-engineering/2024/04/30/Is-Databricks-Photon-A-NoBrainer.html) for more details.

## 2. Billing Rates
People often want to know which is cheaper. The answer however, is extremely complicated because both operate on completely different billing models and each has it's situational nuances. 

### Cost per vCore Hour
To evaluate the cost of each, I prefer to look at an atomical job and compare the effective cost of that single job. After understanding this cost, I then extrapolate as part of an all-up platform cost. To do this we need to know the job duration, cluster size, and the vCore cost per hour including any licensing fees. The follow rates are from the West Central US Azure region, using my go-to VM SKU family in Databricks as the benchmark: Edsv5. Microsoft doesn't publish the VM SKU used in Fabric as it can vary by region and will change over time (which is reflected in the Fabric F SKU pricing), however the Edsv5 or Easv5 VM families match most core specs.

| Workload                                 | Total Cost per vCore Hour | Hardware Cost per vCore Hour (Edsv5) | Licensing Cost per vCore Hour (Edsv5) |
|------------------------------------------|---------------------------|--------------------------------------|---------------------------------------|
| Fabric Spark                             | $0.10                     | $0.09                                | $0.01                                 |
| Databricks Jobs Compute                  | $0.19                     | $0.09                                | $0.10                                 |
| Databricks Jobs Compute w/ Photon        | $0.34                     | $0.09                                | $0.25                                 |
| Databricks All-Purpose Compute           | $0.28                     | $0.09                                | $0.19                                 |
| Databricks All-Purpose Compute w/ Photon | $0.46                     | $0.09                                | $0.37                                 |

> ⚠️ These are point-in-time costs at the time this blog was written, subject to change, and for illustration only. Neither Microsoft Fabric nor Databricks advertise costs per vCore hour, this is an attempt to standardize billing models for comparison purposes at the lowest compute grain, 1 vCore.

### Interactive vs. Scheduled Rates
As illustrated above, your vCore cost per hour is dependent on various factors, some of which I didn't consider for sake of not boiling the ocean (DLT, interactive serverless compute, automated serverless compute, serverless SQL, etc.). However, a major billing difference between the platforms comes down to how the code is being executed.

In Databricks, if you are running a notebook interactively (All-Purpose Compute) for development or to share compute across jobs via a high-concurrency cluster, you pay more in licensing compared to if it was an automated scheduled job (Jobs Compute). Yes, even with the exact same cluster size and run duration, a Notebook executed interactively or jobs run in high-concurrency mode, costs ~47% more for non-Photon and ~35% more for Photon compared to the same job that was scheduled or submitted as a standlone non-interactive job.

In Fabric, there's no deliniating between an interactive and scheduled job, both emit the same CU consumption rate, $0.10 per vCore hour.

## 3. When Billing Meters Start
Another key difference between Fabric and Databricks Spark is when billing meters start to run.

### Fabric’s Approach to Billing Meters
In Fabric, if you're using a workspace that isn’t part of a managed vNet, you can access starter pools that allow code execution to begin within about 15 seconds. This dramatically boosts developer productivity. Microsoft achieves this low latency by keeping nodes in a warm state, with the Fabric Runtime and Spark already running.

If this alone isn't just the bees knees, consider that these start pools don't consume capacity units (CUs) when not in use, CUs are only consumed once your Spark Session starts. That's right, even when the starter pool nodes are being personalized with custom libraries, etc., CUs are not consumed/billed. The documentation has a great illustration for this:
![Starter Pool Billing](https://learn.microsoft.com/en-us/fabric/data-engineering/media/spark-compute/starter-pool-billing-states-high-level.png)

For custom pools, it's the same: you are only billed once your Spark Session begins:
![Starter Pool Billing](https://learn.microsoft.com/en-us/fabric/data-engineering/media/spark-compute/custom-pool-billing-states-high-level.png)

### Databricks’ Approach to Billing Meters
In Databricks, you start paying for VMs as soon as they are provisioned, which is reasonable given that the VM is active. Additionally, once the Spark context is initiated (which typically takes 40+ seconds), Databricks charges licensing fees (DBUs). If you have a pool of VMs sitting idle, you are billed for them every second they remain in the pool, regardless of whether they are actively being used.

# Closing Thoughts
Understanding the differences in how compute works between Fabric and Databricks is essential for making informed decisions about your architecture. Fabric’s approach of separating compute templates (Spark Pools) from software customization (Environments) offers a flexible and modular system that can adapt to various needs and with the opportunity for greatly improved developer productivity via access to low latency starter pools.

