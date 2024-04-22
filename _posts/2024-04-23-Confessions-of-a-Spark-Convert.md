---
layout: post
title: "Confessions of a Spark Convert"
tags: [Fabric, Databricks, Delta Lake, Spark]
categories: Architecture
feature-img: "assets/img/feature-img/pexels-cottonbro-7319068.jpeg"
thumbnail: "assets/img/feature-img/pexels-cottonbro-7319068.jpeg"
published: false
---
I've had a draft blog post labeled _Are Azure Synapse Dedicated Pools Dead_ that I've periodically added thoughts to for the last year but haven't pulled the trigger on publishing. 

Many people have blogged on that topic, some quick to say Dedicated Pools are dead, others saying effectively the same but with more tact. I'm in the latter camp, partly because I was not a super early adopter of Spark, secondarily because Dedicated Pools were the defacto Data Warehouse of choice in the Microsoft data stack not more than a year ago. Microsoft being publically all in on lakehouse architecture for production workloads is effectively only a year old and many business have only recently (within the last 3 years) made large investments on the Synapse Dedicated platform. Therefore, we must move forward, but not without acknowledging that the industry at large has only recently made the widespread shift towards lake-centric architectures. 

That said, I assume many folks were or are in the same camp as I was and with large data architecture shifts we should attempt to reconcile the progression of technology rather than blindly accept it. In that spirit, I have historically been a huge proponet of Synapse Dedicated SQL Pools and am a Spark convert, these are my confessions.

# Why I didn't Adopt Spark Earlier
There were a few stumbling blocks I had when it came to adopting Spark and lake centric architectures. 
1. **Performance:** In the light benchmarking I did, Spark wasn't giving me anything new in the performance department. However, the big variable I didn't consider in my benchmarking was my own expertise in Synapse Dedicated. When it comes to tuning queries to run blazing fast on the Synapse MPP service, I'll propose that I can do it better than most. I've presented in depth and blogged on this topic, Synapse Dedicated has a lot of knobs (distributions, indexing, CCI, statistics, well written SQL, etc.) that can produce query results nearly as fast and _sometimes_ even faster than spark.
1. **Efficient Spark Execution at Scale:** as I wrote about in this [blog post](https://milescole.dev/optimization/2024/02/19/Unlocking-Parallel-Processing-Power.html), optimizing for efficient use of compute and parallelism is a challenging concept. Starting out using Spark, I'd now say I got things wrong more than I got right. WhileAs we have more serverless Spark compute options available, the knowledge needed to efficiently execute spark at scale will dramatically decrease as the way we think about executing jobs starts to look much more like the RDBMS days where you just run things vs. thinking about cluster configurations.
1. **Delta Lake Features:** In Delta Lake versions before 3.0.0 there are a number of things that make development and data management a bit awkward:
   - Table Clustering: Ordering data for low latency reads and writes was clumsy. Z-ORDER indexes were a fantastic concept and major innovation but left me unsatistied with the developer expierence because tables could not be ordered on write. After write opterations you have to run OPTIMIZE with Z-ORDER which rebuilds the entire table and is not an incremental operation. 
   - Identity Columns: This was simply not possible in the same way as most RDBMS systems support. Sure you could do some manually derived row numbering, but for creating monotonically increasing surrogate keys, the process was clumsy.

# Why I'm a Spark Convert and You Should Be Too
Spark + Delta Lake is superior to every data platform technology that I've used. Whether you have small data or large data, focus on data warehousing or machine learning, prefer SQL dialects or programming languages like Python, Spark and Delta Lake are the winning combination. If you have data and have any grasp of its potential value, Spark and Delta Lake is for you.

Here's what caused me to become a Spark and Delta convert:  
## 1. Programmability

## 2. Scalability

## 3. Simplicity (Tuning Effort / redundancy elimintation)

## 4. Extensibility

## 5. Community Investment


# What If I'm Using Synapse Dedicated (or similar) Today?
The plug is not being pulled on Synapse Dedicated in the near-term however there is not going to be further feature development, only product support and patching to ensure the same Azure SLOs are met.

## Should you replatform to a Spark + Delta Lake (Lakehouse) Architecture? 
Honestly, there's no better time like the present to invest in getting more value out of your data. Properly implementated Lakehouse architectures are cheaper, faster, more scalable, have low vendor lock, and the barrier to entry is lower today than it ever has been. Microsoft, Databricks, and other leaders in the market have been investing heavily in eliminating all points of friction to acomplish having an architecture with separated compute and storage while maintaining all of the feature rich capabilities that data warehousing technologies have left us.

The industry is moving on from compute-storage coupled architectures, are you?