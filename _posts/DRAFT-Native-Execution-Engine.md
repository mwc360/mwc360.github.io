---
layout: post
title: "Exploring the Native Execution Engine"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-pixabay-262438.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-pixabay-262438.jpeg"
published: True
---

The Native Execution Engine in Fabric just went GA at Build 2025. If you've heard anyone talk about it in the last almost year since it's been public preview, you've probably caught buzzwords like vectorization, C++, and other technical jargon that sounds impressive. And sure—who doesn't love the promise of better performance? But what does all of that actually mean? And more importantly, why should you care?

If you're someone who's sold on "faster is better" and don't feel the need to dive into the inner workings, great—just turn it on and enjoy your jobs running 2–5x faster at no additional cost. But if you're like me and want to understand how it works, just because you’re curious (or maybe a little nerdy), then read on 🤘...

# What's Wrong with Spark?
This sounds like a setup, **nothing is wrong with Spark**. Ok, fine, we are talking about Spark in today's age of hyper-tuning, where  everyone suffers from performance addiction and every other day we data engineers are tempted by the compelling lures of the latest new animal themed open-source engine.

Fundamentally there are three core inefficiencies in Spark which the new kids on the block don't suffer from:
1. **JVM Overhead**:
    The JVM (Java Virtual Machine) tends to get a lot of bad press but it was created for a good reason. Pre-JVM,developers would spend an unreasonable amount of time porting their applications to run on various operation systems and managing system internals like memory. The JVM introduced a "write-once-run-anywhere" (W.O.R.A.) paradign that allowed developes to write their applications within a single framework (the Java Virtual Machine) which automatically managed internals like memory, while allowing their app to be portable as the JVM was designed to run on any OS. One dev framework, run anywhere, sounds great! The downside of all of this is that code doesn't natively compile into machine code. This means that code needs to be compiled and executed across multiple languages to eventually get to hardware executables. To prove the impact, an engineer at Google did a study of the time to perform basic programming operations across various different languages. The unsurprising result is that languages that compile directly to machine code, i.e. C++ are much faster than others like Scala and Java. Now, I if I had to guess why the JVM was chosen for Spark, it would be that it offered the fastest time to market to deliver the capabilities of spark (managed internals like memory) while also making the framework extremely portable (Linux, Mac, Windows, etc.)
1. **Row-based Execution**:

1. **Scalar Processing (SISD)**:

With these inefficiencies, some people have been quick to jump on the "Spark is dead" bandwagon, to which I say: "over my dead body". No, but seriously, Spark could've be a dying engine if it weren't for all of the goodness that it offers. Considering all of the things that it does extremely well, it was enough for people to start thinking about how to fix the inefficiencies rather than starting over. And given that these inefficiencies are common enough across various engines, why not create modular internals just like how car manufacturers often share common engine parts to benefit from economies of scale. Thus we get the idea of the composable data stack, where entire data processing systems can be composed of various open-source componentry. The Native Execution Engine, composed of Velox and Apache Gluten, natively plugs right into Spark in Fabric to address the 3 core inefficienceis and breathes new life into what could've been a sad story for Spark. 

-> ADD
- highlight value of mature CBO, breadth of capabilities, etc.

# The Native Execution Engine
## Vectorized vs. Scalar Execution

## Row vs. Columnar Layout

## Integration with Apache Spark

## Cost Model

## Open-Source Foundations

## Roadmap and Limitations
### Limitations




