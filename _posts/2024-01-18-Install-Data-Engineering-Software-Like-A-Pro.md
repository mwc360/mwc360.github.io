---
layout: post
title: "Install Data Software Like a Pro"
tags: [Tools]
categories: Automation
feature-img: "assets/img/feature-img/pexels-pixabay-65882.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-pixabay-65882.jpeg"
published: true
---

> **TL;DR** For developers, Chocolatey is an essential tool to address the challenges of installing and managing software.

For anyone in a software engineering type job, including data engineering, managing software installations and updates across multiple environments can be a daunting task. Now consider, for those who work in consulting, each active client you work with might require a different combination of software and tooling.

Now imagine that your laptop unexpectedly needs to be replaced, how can you get back up and running as quickly as possible? **Chocolately is your answer**.
# Chocolatey
## What is Chocolately?
Chocolately is a Windows Package Manager with extrmely simple command line syntax for installing just about any package or installation on the internet. It's the the _one ring to rule them all_ of software management, just install Chocolately once and you can then quickly install just about anything you need.


### But How Does This Save Me Time??
Consider some of the standard tooling used by an Azure data engineer and how long it would take to get everything installed manually ([_as the Chocolately docs elequently describe_](https://docs.chocolatey.org/en-us/why#what-is-chocolatey)):

>1. Search for most recent version
>1. Pick (hopefully) the right download
>1. Wait for it to download
>1. Unblock it
>1. Install it manually (next, next, next anyone?)
>1. Hope it didn't install any malware
>1. Now do it again for EVERY piece of software on your system.

<div style="width:100%;height:0;padding-bottom:100%;position:relative;"><iframe src="https://giphy.com/embed/um2kBnfo55iW4ZH1Fa" width="100%" height="100%" style="position:absolute" frameBorder="0" class="giphy-embed" allowFullScreen></iframe></div><p><a href="https://giphy.com/gifs/bombaysoftwares-waiting-mr-bean-still-um2kBnfo55iW4ZH1Fa"></a></p>

Software I frequently use:
- Visual Studio Community Edition 2022
- VS Code
- Power BI
- Azure Data Studio
- SSMS
- GIT
- PowerShell Core
  - Bicep extension for Powershell
  - Terraform extension for Powershell
- .NET Framework 4.8
- Azure CLI

This might take me a couple hours to get everything installed properly and I'd probably forget a few things in the process (i.e. .NET Framework) leading me later to question why an app may be erroring out or a database project may not load.

Using Chocolatey, you simply run the below via _Command Prompt_ or _PowerShell_, that's it!
```shell
choco install <package-name> -y
```
<div style="width:100%;height:0;padding-bottom:55%;position:relative;"><iframe src="https://giphy.com/embed/rcqxcl5DGhM9q" width="100%" height="100%" style="position:absolute" frameBorder="0" class="giphy-embed" allowFullScreen></iframe></div><p><a href="https://giphy.com/gifs/rcqxcl5DGhM9q"></a></p>

For all of the software I frequently use I would run the below to initially set up a Windows laptop:

```shell
choco install visualstudio2022community -y
choco install vscode -y
choco install powerbi -y
choco install azure-data-studio -y
choco install sql-server-management-studio -y
choco install git.install -y
choco install powershell-core -y
choco install bicep -y
choco install terraform -y
choco install dotnetfx -y
choco install azure-cli -y
```
> `-y` or `--yes` is an command option used to programatically confirm all prompts as part of the download process. Otherwise, you will be prompted in the command line to approve all prompts [A], step through and approve individual prompts [Y], or reject the prompt [N].

Once a package is installed via Chocolately you can easily update packages that may become out of date via the below maintenance commands:

| Command                         |  Description                           |
|---------------------------------|----------------------------------------|
| `choco list`                    | List packages installed via Chocolatey |
| `choco outdated`                | List upgradable packages               |
| `choco upgrade all -y`          | Upgrade all packages                   |
| `choco upgrade <packageName> -y`| Upgrade a single package               |

Yes, that's right, upgrading all of your Chocolately managed software that is outdated is as easy as running the single line of code below:
```shell
choco upgrade all -y
```


## Install Chococlatey
Chocolatey is installed via a PowerShell script referenced in  
[this link](https://chocolatey.org/install#individual).

To simplify the process you can use the PowerShell commands run via _Administrator_ to download the remote script and then execute it.

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```
## Benefits of Chocolatey
1. **Simplified Software Deployment:** Chocolatey allows developers to deploy software quickly and consistently across various environments, reducing manual efforts and the potential for human error.

1. **Automation and Scripting:** Software management tasks can be scripted out and integrated with other PowerShell tasks (i.e. configuring a Azure DevOps Self-hosted agent with required software and settings for use in CICD pipelines).

1. **Version Control and Package Repository:** Chocolatey's ability to control software versions and maintain a private package repository is invaluable for ensuring consistency and security in cloud environments. If you need to install a specific version of software, Chocolately maintains all historic version, so if lets say you needed to install the 9/30/23 version of Power BI Desktop you could simply run:
`choco install powerbi --version=2.121.903.0`
    >⚠️ **Important note:** Each software page on Chocolately has a **Version History** tab where you can see the prior releases and find the choco reference to install that specific version.

1. **Community and Commercial Support:** Chocolatey's extensive community support and its commercial offerings (Chocolatey for Business) provide a vast knowledge base and support for additional enterprise grade capabilities.

1. **Security and Compliance:** Installing software via a package manager tends to be more secure than directly finding installers from the web. Package managers like Chocolatey use a rigorous moderation and review process to verify packages before they are publically accessible.

# Conclusion
For anyone in a developer type of job, the management of software across local, virtual, and cloud environments can be challenging to maintain. Chocolatey is a powerful tool to address these challenges, offering streamlined software deployment, robust automation, and secure package management. By leveraging Chocolatey, developers can make the management and installation of software significantly more agile, secure, and standarized.