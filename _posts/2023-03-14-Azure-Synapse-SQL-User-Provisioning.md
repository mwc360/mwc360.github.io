---
layout: post
title: "Azure Synapse / SQL User Provisioning the Right Way"
tags: [Azure Synapse, Dedicated SQL Pools, Security, Automation, RBAC]
categories: Automation
feature-img: "assets/img/feature-img/pexels-scott-webb-cameras.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-scott-webb-cameras.jpeg"
---

Data engineers and architects will often spend many hundreds of hours building a complex and fully automated solution for delivering data analysis capabilities to end users but will often forget or overlook the step of provisioning user access to said capabilities. 
Database logins, users, and role memberships are traditionally created manually in each environment for several reasons, in this article I'll challenge this status quo and propose that user provisioning may be better suited to be managed via Azure Active Directory security groups. This works with Azure Synapse (Dedicated and Serverless), SQL Database, SQL Managed Instance, other Microsoft SQL variants, and all surrounding cloud services (i.e. data lake, Synapse Workspace, etc.).

## Why is user provisioning typically done manually?

1. **Access isn't consistent across all environments** - Users commonly don't get access to all environments, i.e. an end user may get access to UAT/Test and Production but NOT the development instance. 
1. **Creating Database AD Integrated Users via a ServicePrincipal requires additional Azure config data teams typically don't have access to** - Since Azure AD integrated users are now much more commonplace over SQL Authentication users (due to security, maintenance, etc.) and only an Azure AD user can create other AD users (unless the Server Managed Identity is given special AD permissions*), the current state that deployment tasks only supports SQL Authentication for deploying changes presents a challenge.
1. **User provisioning is an afterthought** - it's true, it's a box that must be checked and no one gets excited about provisioning users. Let's be honest, everyone hates doing this, so keep reading as there's a way out.

>_To enable an AD Service Principal access to create external (AD) users, you must give the Server Managed Identity **Directory Reader** permissions to Azure Active Directory._

## Why can't SQL Authentication users create AD integrated users?
Short answer: they can, with some extra verbose syntax. 
There are actually two methods of creating an AD integrated user, the commonly known method does require the creating user to be an AD user or application.

When using the below syntax, the creating AD user which is signed into Active Directory allows for the retrieval of the users client ID which is then stored as an SID (security ID), a SQL Auth user running this command will fail as there is no existing integration with Active Directory for it to retrieve the client ID of the referenced user. 

```sql
CREATE USER [userName@domain.com] FROM EXTERNAL PROVIDER
```

The trick to creating an AD user from a SQL Auth user is to do some pre-work to get the client ID and convert that into the SID (security ID) of the user you want to create and then use the below syntax:
```sql
CREATE USER [userName@domain.com] WITH SID = 0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX, TYPE = E
```
Type E = Individual users and applications

Type X = Security Groups

Now, how do you derive a SID from a user or group's client ID? This can easily be derived via the below PowerShell function. 
```powershell
function ConvertTo-Sid {
    param (
        [string]$objectId
    )
    [guid]$guid = [System.Guid]::Parse($objectId)
    foreach ($byte in $guid.ToByteArray()) {
        $byteGuid += [System.String]::Format("{0:X2}", $byte)
    }
    return "0x" + $byteGuid
}

ConvertTo-Sid 591e0c96-532e-4264-8046-f7d14fc5f2bf
# returns: 0x960C1E592E5364428046F7D14FC5F2BF
```
I don't believe it's possible to parse a SID from a client ID via SQL, please leave a comment if you've figured this out.

# User Security Framework
The main concept here is that access to AD security groups is much more agile and easy to maintain than individual contained database users. 

Your contained database user essentially represents the group of people that will be members of one or multiple database roles. Add a user to the security group and that user instantly has access to the Azure database via whatever role you gave the security group access to.

This has some significant benefits:

1. **Empowered Data Teams** - You can allow a business user, data engineering team, or DBA who would normally be approving access to own and manage membership of the security group. This effectively gives them ownership to manage access to a role within the database without the need to have ALTER or CREATE access on the USER or ROLE object.
1. **Access becomes standardized** - This framework forces you to consider what a collection of people (i.e. department, position, geographic location, etc.) need access to rather than sorting out access as individual user requests come in.
1. **Providing access is agile** - i.e. you could temporarily add someone to a development security group to allow them to view a PoC fact or dimension that has yet to be released to an upper environment and then remove them from the security group without having to create a single USER or update ROLE MEMBERSHIP.
1. **Risk is minimized** - Someone needs access during a freeze window which would normally block any code changes including USER/ROLE MEMBERSHIP changes? Add the user as a member of the production security group, no production database code is touched.
1. **Access is flexible** - A user can be given access to any combination of environments (i.e. Dev and Test but NOT Production) and the deployment of database objects to support is still fully automated and consistent across all environments.

## Defining Your User Groups
Define the different groupings of access and a standard naming convention that will be used for both security groups and SQL user names. Below are some examples, I suggest naming your roles to be clear about who and what scope of access is provided (i.e. EDW_SqlUsers_Operations_Reader = Operations users who have read access to run SELECT statements)
1. Define your user groups and naming convention
   - EDW_SqlUsers_Operations_Contributor
   - EDW_SqlUsers_Operations_Reader
   - EDW_SqlUsers_Finance_Reader
   - EDW_SqlUsers_Admin
1. Create AAD Security Groups and assign ownership/membership
   - EDW_SqlUsers_Operations_Contributor_DEV
   - EDW_SqlUsers_Operations_Contributor_TEST
   - EDW_SqlUsers_Operations_Contributor_PROD

## Operationalizing Your Database User Security Framework
Depending on the time you want to invest upfront to make life easy for your future self there are a few different ways you could implement this.

1. Hardcode something like the below in a DACPAC post-deployment script. - **_This is a good starting point but isn't very dynamic_**.
   ```sql
   EXECUTE sp_executeSql N'CREATE USER [EDW_SqlUsers_Operations_Contributor_DEV] WITH SID = 0x960C1E592E5364428046F7D14FC5F2BF, TYPE = X'
   ```
   _This would need to be a post-deploy script since the USER object in SqlPackage/SSDT doesn't support the SID syntax_

1. Generate the SID as part of your release pipeline and dynamically pass the SID into your DACPAC deploy via a SQLCMD variable - **_Getting better, still not very dynamic_**.
   ```sql
   EXECUTE sp_executeSql N'CREATE USER [EDW_SqlUsers_Operations_Contributor_DEV] WITH SID = $(sid), TYPE = X'
   ```
1. Store users and groups to be provisioned per environment in a JSON config file in GIT and then use PowerShell in your release pipeline to loop through, generate SIDs, and provision access - **_PERFECT_**.
```json
{
    "roleAssignments": [
        {
            "name": "EDW_SqlUsers_Operations_Contributor_DEV",
            "objectId": "591e0c96-532e-4264-8046-f7d14fc5f2bf",
            "type": "Group",
            "databaseRoleAssignments": [
                {
                    "server": "server1",
                    "database": "database1",
                    "roles": [
                        {
                            "roleName": "EDW_SqlUsers_Operations_Contributor"
                        }
                    ]
                }
            ]
        }
    ]
}
```
Yes, the PowerShell to idempotently create users and assign role membership based on a JSON config file is not a small effort, however, once you script it out (maybe with the help of ChatGPT) your future self will thank you as no one wants to spend time provisioning database users. 

In all the Azure data platforms I've built I've been able to 100% avoid executing TSQL to create all types of users and assign role membership... it's completely worth it, come join me.