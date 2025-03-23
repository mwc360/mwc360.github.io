---
layout: post
title: "Elevate Your Code: Creating Python Libraries Using Microsoft Fabric (Part 2 of 2: Packaging, Distribution, and Consumption)"
tags: [Fabric, Spark, Lakehouse]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-koprivakart-5914531.jpeg"
thumbnail: "assets/img/feature-img/pexels-koprivakart-5914531.jpeg"
published: false
---

This is part 2 of my prior [post](https://milescole.dev/data-engineering/2024/07/18/Developing-Python-Libraries-Using-Microsoft-Fabric.html) that continues where I left off; I've shown how you can use Resource folders in either the Notebook or Environment in Microsoft Fabric to do some pretty agile development of python modules/libaries. Now, how exactly can you package up your code to distribute and leverage across multiple Workspaces or Environment items?

# Building / Packaging
While you can certainly run all of this code locally on your machine, everything that I'll show in this section will be 100% from the Fabric Notebook UI. Sure, doing some of this stuff locally can be more productive and agile, but there's a certain convenience and magic to having the _capability_ to do everything in your browser.

Packaging a Python library results in having a single compressed file, a _"wheel"_ file, with the `.WHL` extension. For anyone new to Python, this is really just a compressed file (which you can actually unzip to view the contents via replacing the extension with `.ZIP`) that contains all of the Python modules, reference files, and virtual references to the dependencies that your library has. Since all I had in the prior blog was the single Python `utils` module, I will need to add a couple other things to support making this a packagable library.

1. **setup.py**: this Python file contains the metadata about your library and any special instructions for the packaging process. Create it in the root of your library directory. 
    ```python
    from setuptools import setup, find_packages

    # Read the contents of your README file
    with open("README.md", "r", encoding="utf-8") as fh:
        long_description = fh.read()

    # Read the contents of the requirements.txt file
    with open('requirements.txt') as f:
        requirements = f.read().splitlines()

    setup(
        name="example_lakehouse_utils",
        version="0.1.2",
        author="Miles Cole",
        description="Example Python Library",
        long_description=long_description,
        long_description_content_type="text/markdown",
        url="",
        project_urls={},
        classifiers=[
            "Development Status :: Development",
            "Programming Language :: Python :: 3",
            "Operating System :: OS Independent",
            "Topic :: Benchmarking",
            "License :: OSI Approved :: MIT License",
        ],
        python_requires=">=3.10",
        install_requires=requirements
    )
    ```
    > In the above setup code, the `name`, `version`, and `python_requires` fields are key to generating the name of the resulting WHL file: `example_lakehouse_utils-0.1.2-py3-none-any.whl`. The parts of the WHL file name have the below basic pieces of information.
    > ```python
    >   f"{name}-{version}-{python_version}-{os_specific}-{architecture_specific}"
    > ```

    > Anytime you are making code changes you should evaluate if this is a _major_ (**0**.1.2), _minor_ (0.**1**.2), or _revision_ (0.1.**2**) to your existing code and then update the version metadata accordingly.

1. **requirements.txt**: this simple text file contains a list of libraries that need to be installed for your library to function. Since my module is so simple, it doesn't have any external dependencies, here's an example of what one would look like:
    ```txt
    sqlglot==25.23.0
    JayDeBeApi==1.2.3
    ```

    > Even if you don't have any library dependencies, I would still recommend creating an empty `requirements.txt` file. This way you don't need to change the `setup.py` script and as soon as you have a change in the future which requires some other library as a dependency, you are good to go without needing to refactor the build process and file structure.
1. **README.md**: only technically required in that you should always have a README file that describes what your library does, please have mercy on that poor engineer that may take over your job in the future. 

After creating the basic structure, it could look something like the below:
```python
example_lakehoues_utils/
├── README.md # documentation
├── requirements.txt # dependencies
├── setup.py # build instructions
└── utils.py # source code
```

Now that the basic structure is complete, let's build the library. I prefer to add all of the remaining code blocks into the same Notebook used for developing and testing the Python modules. This way I can make and test a quick change, generate a new build of the library, and then finish by publishing the new version to an artifact repo.

1. Install build libraries

    ```python
    %pip install setuptools wheel
    ```

2. Change directory to library root

    Before running the build of your library, you  will need to change the current directory to the root folder of your library. This example library is called `example_lakehouse_utils`.

    _If you've built your libray in the Notebook Resources you'll use the below: `/synfs/nb_resource/builtin/<root_folder_name>`_
    ```python
    import os
    os.chdir('/synfs/nb_resource/builtin/example_lakehouse_utils') 
    ```
    _Otherwise, if using an Environment Resources, you'll use the below: `/synfs/env/<root_folder_name>`_
    ```python
    import os
    os.chdir('/synfs/env/example_lakehouse_utils') 
    ```

3. Build library

    Now you can run the below:
    ```python
    # Clean the build directory
    !python setup.py clean --all
    # Build distribution of wheel file
    !python setup.py bdist_wheel
    ```

    This results in the WHL file being generated in a newly created `./dist/` (distribution) directory. From here we could PIP install the WHL file right from the distribution folder before publishing it to an artifact repository.

    ```python
    %pip install '/synfs/nb_resource/builtin/example_lakehouse_utils/dist/example_lakehouse_utils-0.1.2-py3-none-any.whl`
    ```

# Distributing
Are we done yet?? Not unless you enjoy manually uploading your newly minted library to various Environment items and worrying about keeping things in sync as you have new versions to publish.

Rather than manually distribute your packaged source code, the standard practice in software development is to host libraries in central repositories. When applications are run or are compiled, build instructions contain pointers to these central stores so that the trusted and specific required version of the library can be downloaded, installed, and imported as needed. This has key benefits:
- **Trust**: importing a library from some drive that many employees have access to is akin to popping a flash drive you found into your PC. It presents _tons_ of risk given that shared access to modify or replace the file could leave the library corrupted or even present a potential opportunity for randsomware injection or data exfiltration. Artifact repositories, such as PyPi or Azure DevOps Artifact Feeds provide tight access controls so that publishers are verified and therefore existing or new versions of the library can be trusted to have come from the publisher.
- **Versioning**: Since downstream applications may not be ready to migrate to the newest version of a library, especially if there are possible breaking changes, library versions by default are immutable. This means that once a version is published, it can't be changed or republished with code changes. You therefore have the guarantee that nothing will change unless you explicility decide to upgrade to a newer version. Additionally, all old versions of the library are automatically maintained. This allows downstream consumers to continue using the exact version that they already have proven compatibility with, and only when ready, upgrade to user later versions.
- **Single source of truth**: rather than have a few or even many places to download dependent code packages, why not just have one? The same principals that apply to open-source-software also apply to enterprises, source code is best to be distributed via a single artifact repository. This means one single place for binary producers to publish source code and one single place for consumers to ultimately download the packages from. Having a single source of truth creates additional trust, decreases publishing overhead, and eliminates potential governance issues.

While we _could_ publish this library to PyPi for public distribution, most organizations do not open-source their code given that it is often organizationally specific in nature, therefore I'll be showing how you can publish libraries to a private repository. In this case I'll be using Azure DevOps Artifacts as the hosting service, but this same process generally applies to any other service, you need to provide authentication and use a specific API to publish your library.

## Setting up an Azure DevOps Artifact Feed

## Publishing the library
First PIP install `twine` and `wheel`:
```python
!pip install twine wheel
```

Now you'll run some code to perform the publish operation. I'm referencing my ADO PAT token stored in Azure Key Vault to avoid storing any credentials in my Notebook.

```python
import subprocess
import sys

# Input Params
ado_org_name = 'milescole'
ado_project_name = 'library_dev_demo'
ado_artifact_feed_name = 'feed1'
key_vault_name = 'mcakv'
key_valut_pat_secret_name = 'ado-pat'
whl_path = "/synfs/nb_resource/builtin/example_lakehouse_utils/dist/example_lakehouse_utils-0.1.3-py3-none-any.whl"

repo_url = f"https://pkgs.dev.azure.com/{ado_org_name}/{ado_project_name}/_packaging/{ado_feed_name}/pypi/upload/"
artifact_pat = notebookutils.credentials.getSecret(f"https://{key_vault_name}.vault.azure.net/", key_valut_pat_secret_name)

# Publish Library
result = subprocess.run([
    sys.executable, "-m", "twine", "upload", "--verbose",
    "--repository-url", repo_url,
    "-u", "__pat__", "-p", artifact_pat,
    whl_path
], capture_output=True, text=True)

stdout = result.stdout or ""
stderr = result.stderr or ""
combined_output = stdout + stderr
print(combined_output)
```

If we check Azure DevOps we'll find that the latest version of the library is now showing up in the Artifact feed. From here we would give consumers of the library the _Feed Reader_ persmissions so that the library can be downloaded from this central repo.

![Artifact Feed perms](/assets/img/posts/Packaging-Libraries/feed-perms.png)

# Using a Private Artifact Repository in Fabric
Alright, so we have our library out there in our fancy Artifact feed, how do we actually use it in Microsoft Fabric to simplify consumption of Python libraries?

While Environment items in Fabric don't yet support private artifact repositories, today we can acomplish this in a Fabric Notebook via inline PIP installation of our library. All we need to do before running PIP is to add a reference to our private repository in a PIP config file.

```python
import os

# Input Params
ado_org_name = 'milescole'
ado_project_name = 'library_dev_demo'
ado_artifact_feed_name = 'feed1'
key_vault_name = 'mcakv'
key_valut_pat_secret_name = 'ado-pat'

# Set Vars
artifact_pat = notebookutils.credentials.getSecret(f"https://{key_vault_name}.vault.azure.net/", key_vault_pat_secret_name)
repo_url = f"https://feed1:{artifact_pat}@pkgs.dev.azure.com/{ado_org_name}/{ado_project_name}/_packaging/{ado_artifact_feed_name}/pypi/simple/"
pip_conf_path = os.path.expanduser("~/.config/pip/pip.conf")

# Ensure config directory exists
os.mkdirs(os.path.dirname(pip_conf_path), exist_ok=True)

# Write config file.
with open(pip_conf_path, "w") as f:
    f.write(f"[global]\nindex-url = {repo_url}\n")
```

Now all that is left is a simple `PIP` and the artifact feed in our config file will be leveraged as the source instead of PyPi.
```python
%pip install example-lakehouse-utils==0.1.2
```
> Use `extra-index-url` instead of `index-url` when writing the config file if you want to continue to support PyPi as a direct source, otherwise everything must be downloaded from the ADO Artifact Feed. _Note: you can add PyPi as a source in your ADO Artifact Feed. This results in PyPi libraries referenced being downloaded into your private Feed._

# Was it worth it?
Ok, maybe you're thinking this was all unnessesarily complex. Why do this when you could simply use the `%run` magic command to inject modules you have in some Notebook? Well, honestly there are tons of reasons why this approach is generally much better for mature data engineering:
1. **Cross-workspace, cross-tenant, or event 100% public distribution of code assets**: The more mature a data engineer is, the more one thinks about and designs for _scalability_, _flexibility_, and _modularity_. Afterall, solving for these two basically eliminates future work and data engineers are human nonetheless, why code things 10 more times in the future, with slight variation each time if you could instead just code something in a flexible and modular way to be reused in other code domains? Using an artifact store allows you to simply pick your scope of distribution and from there everything easily scales while maintaining trust and governance.
1. **Minimized latency of code asset reuse**: `%run` is linearly more expensive the more cells of code are injected from another Notebook. If you have complex ELT methods or even tons of utility functions, using `%run` is often an extremely inefficient way to bring this code into the context of your current session.
1. **ALM capabilities**: once Fabric adds Git support for Resource folders in Notebooks and Environments, you will be able to integrate running test cases, packaging, and distributing your library as part of your deployment process. Until then, you can manually perform these steps in your library development Notebook. 
