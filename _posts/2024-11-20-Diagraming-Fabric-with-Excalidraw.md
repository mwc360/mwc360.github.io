---
layout: post
title: "Announcing the Microsoft Fabric Shape Library for Excalidraw"
tags: [Fabric, Spark, Lakehouse]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-pixabay-235990.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-pixabay-235990.jpeg"
published: True
---

I'm _thrilled_ to announce that my **Microsoft Fabric Shape Library for Excalidraw** has been published!

Documenting and diagramming solution architectures is critical for both conceptualizing and building maintainable data solutions. Whether you are whiteboarding ideas for review with your customer or technical lead, or documenting an existing solution so that new or future team members can understand your spaghetti architecture, high-quality diagrams are a must.

Having spent time in both web and graphic design at various points in my career, I’ve developed a stumbling block: I have a hard time feeling good about a diagram unless it looks stellar. While I've successfully used a few diagramming tools in the past, I’ve never fallen in love with one—until now. Enter Excalidraw.

# What is Excalidraw and Why You Should Care
Excalidraw is a whiteboarding tool designed for easily creating diagrams with a hand-drawn feel. It’s open-source, available in free or paid versions, and offers a lightweight experience that feels a bit like Lucidchart—but is more lighteight.

## Why should you care
I could care less if you, the reader, end up using Excalidraw, but I think the underlying technology and concepts that make it unique are absolutely fascinating and worth a read.

Excalidraw is built using the [Rough.js](https://roughjs.com/) library. If you’re curious, it’s completely worth taking a look at the landing page. To summarize, shapes are expressed using x and y coordinates for corners and curve points. Lines are rendered with a configurable level of randomness that mimics a hand-drawn effect.

Here’s the part I really appreciate: since no human can draw the exact same circle—or any other shape—twice, every instance of a shape in Excalidraw looks purposefully unique. By leveraging Rough.js, Excalidraw replicates this uniqueness. As a result, every shape you draw or use from a library looks like it was hand-drawn.

### Isn't it Unprofessional?
Doesn’t a hand-drawn look seem unprofessional? I’ll admit, it’s a stylistic choice, and it’s not for everyone. However, you can adjust the sloppiness of your shapes to suit your needs. Personally, I love it.

The hand-drawn effect gives you creative freedom and removes the need for pixel-perfect diagrams. After all, who has time for that? If shapes naturally vary and every straight line has a predictably unique hand-drawn sloppiness, there’s no reason to spend hours snapping shapes to a grid to ensure every edge aligns perfectly. Instead, you can simply drag things into approximate positions, and the hand-drawn effect makes it look natural—and even expected.

### Why Excalidraw is a Developer’s Dream
Here’s what really sets Excalidraw apart: it’s a developer’s dream for diagramming.

First, it has a VS Code extension that offers 95% of the same features as the cloud-hosted version. It also supports saving drawings in the native `.excalidraw` file format. This means you can add Excalidraw drawings directly into your code repository, right alongside your massively important data engineering source code, to make it self-documenting.

Second, Excalidraw makes diagrams accessible everywhere. “What if not everyone on my team uses VS Code?” you might ask. “How can I make these diagrams visible wherever the repository is viewed?” The answer is mind-blowing: you can export your drawings as `PNG` or `SVG` files and optionally include the scene data.

When you export with scene data, the file includes all the shape coordinates and is saved with a `.excalidraw.png` or `.excalidraw.svg` extension. This technically makes it a standard image viewable in any modern code editor. At the same time, it remains fully editable as an Excalidraw drawing when opened in VS Code with the Excalidraw extension installed.

Have you ever saved a diagram as an image for a presentation, only to lose the source Visio file later? With Excalidraw, you don’t have to worry about that. If you include scene data when exporting your drawing, the file will always remain editable—as long as it isn’t flattened or compressed.

One last feature that blew my mind: _the auto creation of diagrams from data_. Copy and paste the below data into Excalidraw:
| Query  | Runtime (sec.) |
|--------|----------------|
| Query1 | 2              |
| Query2 | 23             |
| Query3 | 2              |
| Query4 | 5              |
| Query5 | 23             |
| Query6 | 41             |
| Query7 | 15             |

And it will give you either a bar or line chart option to automatically render the data as a chart:

![bar chart](/assets/img/posts/Excalidraw/bar-chart.png){: .excalidraw-img }
![line chart](/assets/img/posts/Excalidraw/line-chart.png){: .excalidraw-img }

So far I've just talked about features of the free version of Excalidraw that I use in VS Code. It also offers a [paid version](https://plus.excalidraw.com/excalidraw-plus-vs-excalidraw) that gives you all the nice features you'd expect like cloud hosted drawings, collaborative editing, etc.

# The _Microsoft Fabric Architecture Icons_ for Excalidraw
Ok, enough background, the Microsoft Fabric Architecture Icons!

![Fabric Icons](/assets/img/posts/Excalidraw/shape-library.png)

These are not stamped as _Microsoft Official_ so give me a break if colors and graphics are not spot on. Again, with the hand-drawn effect, they aren't intended to be. The library can be installed or tested via [this link](https://excalidraw.com/?addLibrary=https%3A%2F%2Flibraries.excalidraw.com%2Flibraries%2Fmwc360%2Fmicrosoft-fabric-architecture-icons.excalidrawlib) (no account needed!) or via browsing for libraries in the UI if you are already using Excalidraw.

Here's a sample diagram:
![alt text](/assets/img/posts/Excalidraw/diagram.png){: .excalidraw-img }

Excalidraw isn’t just a tool; it’s a game-changer for diagramming and documenting solutions. If you haven’t tried it yet, now’s the time. With my **Microsoft Fabric Shape Library**, you’ll have everything you need to start creating visually stunning, hand-drawn diagrams of your lakehouses built in Fabric. Enjoy!