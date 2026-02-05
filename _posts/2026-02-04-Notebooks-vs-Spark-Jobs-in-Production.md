---
layout: post
title: "Notebooks, Spark Jobs, and the Hidden Cost of Convenience"
tags: [Fabric, Spark, Lakehouse, Delta Lake]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-25626522.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-25626522.jpeg"
published: True
---

I'm guilty. I've peddled the [#NotebookEverything]() tagline more than a few times.

To be fair, notebooks _are_ an amazing entry point to coding, documentation, and exploration. But this post is dedicated to convincing you that notebooks are not, in fact, _everything_, and that many production Spark workloads would be better executed as a non-interactive Spark Job.

I'm certainly not the first to say such a controversial thing. Daniel Beach's infamously entertaining [The Rise of the Notebook Engineer](https://dataengineeringcentral.substack.com/p/the-rise-of-the-notebook-engineer) blog post made waves (and [enemies](https://www.reddit.com/r/dataengineering/comments/1elgyf8/the_rise_of_the_notebook_engineer/)) for a reason. Ironically, I've spent my entire Spark career being exactly that: a notebook engineer. Sure, I've done a lot of software engineering type of stuff that doesn't take place in a Notebook like creating APIs, CICD automation, building WebApps (both front-end and back-end) before Vibe coding would do nearly everything for you, but for all of my Spark development career I've only deployed stuff via Notebooks. [I came from the business side of things](https://milescole.dev/data-engineering/2024/10/24/Spark-for-the-SQL-Developer.html) where later I learned Spark in consulting where **everyone only used Notebooks** for Spark jobs, production included.

So if you only use notebooks today, no judgement, you're in good company. In this post I focus on some very real considerations and lessons learned while arguing three core points:
1. Reliability must come before convenience
1. Notebooks make testing and modularity harder
1. Spark Job Definitions encourage better engineering habits

> While I'll use Microsoft Fabric's Spark Job Definitions as a concrete example, the argument here is not Fabric specific. The same tradeoffs exist in Databricks Jobs, `spark-submit` on EMR or HDInsight, AWS Glue, or any platform where notebooks and scheduled Spark jobs coexist. This is really about choosing between an interactive editor and a packaged execution model.

# 1. Reliability Must Come Before Convenience
Beyond performance, cost, and clever optimizations, a good data engineer should optimize for reliability as a first principle.

Why? I'll propose it algebraically:
$$
f(\text{stakeholderSatisfaction}) = \text{dataTimeliness} \times \text{TCO} \times \text{securityExpectations} \times (\text{reliability})^{10}
$$
You can build the fastest pipeline with the lowest TCO and perfect security posture, and none of it matters if the data only arrives correctly 95% of the time.

What is good performance if data doesn't reliably get from A to Z? Will your CFO care about your cost savings if a regression adds extra zeros to sales figures?

One bad incident can undo months of tuning, cost optimization, and feature work. That's why I consider reliability a first principle. Everything else is downstream from it.

If reliability is the goal, then the levers we control as data engineers start to matter a lot. In practice, three things show up again and again as predictors of whether a pipeline stays healthy over time:
- **Testing** → determines how often we prevent incidents in the first place
- **Modularity** → determines how fast we recover when a portion of your complex code base breaks
- **Governance** → determines who can introduce change into production

Surely there are others, however few would disagree that these are high predictors of being able to achieve high reliability.

# 2. Notebooks Make Testing and Modularity Harder
## Notebooks and Testing

Notebooks _can_ be tested. But if this were a conference talk and I asked, "Who runs unit tests against their notebook code before every release?", I'd expect a lot of uncomfortable silence.

In my years of consulting before Microsoft, I never once saw a real test suite for notebook-based pipelines — not from customers, and not from teams I worked on. There might be CI validating that a SQL project builds or that a Python wheel compiles, but never a meaningful assertion that the pipeline produced the expected result or a utility does what it is supposed to.

```python
assert my_elt_func(df) == exepected_result
```

Why is this? In the data engineering space, there's a handful of core reasons:
- **Economic realities**: Very few organizations want to pay for work that doesn't immediately translate into more data, more dashboards, or tighter SLAs. Testing is preventative, and preventative work with intangible benefits is notoriously hard to justify in budgets.
- **Technical constraints**: Writing unit tests in a data context is genuinely harder than in typical application code. You're often asserting over distributed behavior, schemas, and transformations rather than simple return values.
- **Skillset gaps**: Notebooks are highly encouraged in consulting scenarios because both the inputs, progress, and outputs are much more transparent to those who did not build the solution but will own it going forwards.
- **Development mechanics**: Notebooks don't naturally fit into a testable development workflow. They blur together setup, logic, and execution. They can mix languages. They encourage inline code rather than reusable functions. And while they are technically just files in source control, they are awkward to import and test like normal code.

The only scalable pattern I've seen work is to treat the notebook as nothing more than an entry point. All of the actual ELT logic lives in a Python wheel or JAR with proper unit tests, and the notebook simply imports classes and executes methods or functions defined outside of the notebook. At that point, the notebook is no longer the system. It's just a user interface for calling _run_ with a specific configuration context.

But what about modularity?

## Notebooks and Modularity
Yes, you can modularize notebook code. You can reference `.py` files. You can attach modules through Environments. You can even inline-install packages at runtime. But all of those techniques tend to bind your logic to a specific notebook or execution context.

Code that lives in a notebook (including Fabric's Notebook and Environment resources) is harder or even impossible to efficiently reuse outside that scope without copy-paste distributing your source code. It is also harder to version cleanly, harder to promote across environments, and harder to reason about as a product rather than as an artifact of an editor.

Packaging your logic as a wheel or JAR forces separation between what the code does and how it is executed. That separation is what enables testing, reuse, and controlled deployment. It is the same pattern application engineers have relied on for decades, and it works just as well for data engineering when we choose to use it.

If your transformation logic, shared utilities, or dataframe operators are worth reusing outside of a single data pipeline context, it probably shouldn't live inside a notebook. Minimally, aim to package your code as a Python wheel or JAR, and then use the Notebook as an entry point to calling your ELT package.

# 3. Spark Job Definitions Encourage Better Engineering Habits

This section hits closest to home for me.

I run an internal Spark workload at Microsoft. For a long time, I ran it via notebooks, even after I had already refactored all logic into Python packages. The notebook was just the entry point.

But notebooks made it too easy to be lazy:

> _I'm not going to schedule this job because I'll just open the Notebook when needed, modify the one or two lines of code for testing scenario x/y/z and run. So easy!_

Because it was so easy to modify, I avoided formalizing various behaviors. There was no stable interface. No clear contract. No forced decision about what should be configurable and what should not.

When I moved those jobs to Spark Job Definitions with proper command-line arguments, something surprising happened: the friction forced me to think.

I had to decide:
- what was input and what was the expected behavior
- what could change safely and what should not
- how parameterization and control flow should work
- where validation should live and what is tested

In other words, I had to think about things that directly shape data pipeline reliability.

There's an uncomfortable truth hiding here:
> If the barrier to running production code is near zero, then the barrier to breaking production is near zero too. Notebooks are easy to create, and they are just as easy to mutate. There is no inherent guardrail beyond human discipline.

Spark Job Definitions, by contrast, require packaging, interfaces, and intent. They are less convenient, and that inconvenience is arguably not a flaw, it's nature of complex data engineering that requires better habits. Going back to our premise around what drives reliability, your job not having a built-in IDE adds a layer of healthy friction to govern how easy it is to make a change, a change that could be untested and regretted.

## What About Interactivity?

Spark Job Definitions are not interactive, and that is usually framed as a downside, but I'll push back by asking _"does it really make sense for a production job to ship with a built-in IDE"?_ IDE's are meant to make developing code easier and a Notebook is functionallity an executable script with a built-in IDE. Sure we could lock the production notebook to be read-only in our production workspace, but that doesn't change the fact that it's still a notebook that comes with the necessary overhead IDEs require to do things like nicely visualize cell outputs, snapshots, and such. While an SJD wouldn't be meaningfully faster compared to when run with a Notebook with 20 cells, the UI cost is certainly not zero. 

Consider a website built via Square Spark vs. one deployed via conventional methods (building web app locally, and then publishing the compiled package to a hosting service): which website would you trust to run a billion dollar business? I would certainly not trust the Square Space implementation because the barrier to making a breaking change is too low.

But interactivity does not disappear; it simply moves earlier in the process. You still explore and debug locally. You still test in notebooks if that helps. You still validate behavior before release.

By the time you execute an SJD, you are supposed to already know what it will do and have executes tests that prove it works as expected. An SJD is nothing more than a Spark job API contract, it expects certain inputs, and in return it will run your code. Bad code == bad result, good code == good result.

**⚠️ WARNING - _controversial claim_**: notebooks shine when you need to explore, explain, visualize, or teach. They are phenomenal for data science and experimentation, but they are arguably not ideal for most production use cases. Production data engineering and data science workloads are typically extremely binary:
- Did I get the data from A to Z?
- Did it arrive on time?
- Did the dataset get scored?
- Did it arrive in the right shape?
- Did it break anything downstream?

There's nothing about most production workloads that _requires_ the use of notebooks, it's a convenience thing: _I can ship the thing I used to interactively develop my solution while benefitting from ease of further code changes, and it comes with the ability to interweave documentation with code._

While notebooks optimize for convenience, Spark Job Definitions optimize for intent. If reliability is your first principle, intent should always come before convenience.

> So the real question isn't whether you can run production jobs from notebooks. **It's whether doing so makes you a more disciplined engineer and produces more reliable outcomes for your stakeholders.**

Notebooks make it easy to ship any code. Spark Job Definitions make it hard to ship the wrong code. That's why I'm reconsidering how I deploy most production pipelines.


-----

See my blog for [how to create your first Spark Job Definition](https://milescole.dev/data-engineering/2026/02/04/Creating-your-first-Spark-Job-Definition.html). The internet is strangely thin on this topic, probably because too many of us still [#NotebookEverything]() 😄, but it's really not that hard once you understand the core concepts.
