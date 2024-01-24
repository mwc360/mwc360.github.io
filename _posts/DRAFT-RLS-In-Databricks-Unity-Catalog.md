---
layout: post
title: "RLS in Databricks Unity Catalog"
tags: [Azure Databricks, Lakehouse, Security]
categories: Security
feature-img: "assets/img/feature-img/pexels-scott-webb-cameras.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-scott-webb-cameras.jpeg"
published: false
---
Unity Catalog introduces many new concepts in Databricks, particularly around security and governance. One significantly improved security feature that Unity Catalog enables is **Row Level Security** (_hereby referred to as RLS_).


# Implementing RLS
Before Unity Catalog the pattern for RLS involved creating views that would filter Delta tables based on the _IS_MEMBER()_ function. A key limitation with this implementation is that it required to only expose access to the views that dynamically filter the results via checks against role membership. If the user had access to the underlying Delta tables, they would be able to bypass the security controls. 

>**TL;DR:** before Unity Catalog you could not directly impose security controls on actual Delta tables. 


## RLS in Unity Catalog
Unity Catalog 



Key Points:
1. 
1. 


## Filter Rows based on Groups

```sql
CREATE OR REPLACE FUNCTION region_filter_dynamic(country_param STRING) 
RETURN 
  is_account_group_member('bu_admin') or -- admin can access all regions
  is_account_group_member(CONCAT('regional_admin_', country_param)); --regional admin can also access if the region matches the regional admin group.
  
ALTER FUNCTION region_filter_dynamic OWNER TO `account users`; -- grant access to all user to the function for the demo
```


# Limitations
At the time of writing this post:
- Applying Row Filtering or Column Masking on Delta tables will prevent them from being access via Single User Clusters. This means that 