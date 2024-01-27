---
layout: post
title: "RLS in Databricks Unity Catalog and Power BI"
tags: [Azure Databricks, Lakehouse, Security, Power BI]
categories: Security
feature-img: "assets/img/feature-img/pexels-manuel-geissinger-325229.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-manuel-geissinger-325229.jpeg"
published: true
---
Unity Catalog introduces many new concepts in Databricks, particularly around security and governance. One significantly improved security feature that Unity Catalog enables is **Row Level Security** (_hereby referred to as RLS_).

Before we cover the new method, let's do a recap of how RLS worked before Unity Catalog.

# Pre-Unity Catalog RLS (Dynamic View Row Filtering)
Before Unity Catalog the pattern for RLS involved creating dynamic views that would filter Delta tables based on the _IS_MEMBER()_ function. A key limitation with this implementation is that it required to only expose access to the views that dynamically filter the results via checks against role membership. 
>If the user had access to the underlying Delta tables, they would be able to bypass the security controls. 

The _IS_MEMBER()_ function returns a boolean true/false depending on whether or not the user running the query is a member of the Databricks Group refereced in the function.

## Implementing Dynamic View Row Filtering

For this example use case, Supplier Managers should only see Invocing data related to the _Supplied Category_ that they support, only Admins and Executives should be able to see all data.

To acomplish this, we start by creating or referencing an existing field in our supplier dimenson that corresponds to _Supplier Category_ and then ensure there is a relationship to our invoices fact. To help make the intent of the Databricks Groups more clear I've added a _SupplierManager_ pre-fix to the group name.


![Query 1](/assets/img/posts/RLS-In-Databricks-Unity-Catalog/dimension.png)


After identifying the field, we can then create Databricks Groups that correspond to the possible values so that we can add users into those groups.


![Add Group](/assets/img/posts/RLS-In-Databricks-Unity-Catalog/addGroup.png)

We then create a view on top of our fact table where the user is a member of the Supplier Category group. 

```sql
CREATE OR REPLACE VIEW gold.v_rls_fact_invoice
AS 
SELECT
    i.*
FROM gold.fact_invoice i
JOIN gold.dim_supplier s 
    ON i.Supplier_SK = s.Supplier_SK
WHERE IS_ACCOUNT_GROUP_MEMBER(CONCAT('SupplierManager(',s.CategoryName,')'))

```
Now, assuming that I add myself to the _SupplierManager(Packaging)_ Databricks Group, when I query the fact_invoice view, I only see records that relating to Supplier_SK 34 which is the one supplier within 'Packaging' category.

![Filtered Fact](/assets/img/posts/RLS-In-Databricks-Unity-Catalog/filteredFact.png)

Now, to allow all Admins and Executives to see all data, we can add an Executives Databricks Group, the Admins group is a default Databricks group so we can leverage that. After adding the groups, we update our view defintion to include Admins and Executives in the WHERE clause:
```sql
CREATE OR REPLACE VIEW gold.v_rls_fact_invoice
AS 
SELECT
    i.*
FROM gold.fact_invoice i
JOIN gold.dim_supplier s 
    ON i.Supplier_SK = s.Supplier_SK
WHERE IS_ACCOUNT_GROUP_MEMBER(CONCAT('SupplierManager(',s.CategoryName,')'))
    OR IS_ACCOUNT_GROUP_MEMBER('admins') 
    OR IS_ACCOUNT_GROUP_MEMBER('Executives')
```
Since I am in the admin group, I now see data related to all supplier categories when I query the fact_invoices view.

![Unfiltered Fact](/assets/img/posts/RLS-In-Databricks-Unity-Catalog/unfilteredFact.png)

### User and Group Related Functions
| Function                        | Description                                                                                              | Unity Catalog Only  |
|---------------------------------|----------------------------------------------------------------------------------------------------------|---------------------|
| `is_member()`                   | Returns `true` if the user is a direct or indirect member of the specified group. at the workspace level | No                  |
| `is_account_group_member()`     | Returns `true` if the user is a direct or indirect member of the specified group. at the account level   | Yes                 |
| `session_user()`                | Returns the email address or id of the user executing the statement. Recommended for DBR 14.1 and above. | No                  |
| `current_user()`                | Returns the email address or id of the user executing the statement. Alias for `user()`.                 | No                  |
| `user()`                        | Returns the email address or id of the user executing the statement.                                     | No                  |

>**is_account_group_member() vs. is_member():** if you have Unity Catalog enabled, you should use `is_account_group_member()` instead of `is_member()`. This supports scenarios where you may want to check for membership in groups that have not been added to your workspace since you may not want those users to have workspace access. For example, for our Executives group, they might technically need to access the data in the event of using Direct Query for reporting, however we don't want to add the Account Group into our workspace as they shouldn't get access to the workspace itself.

## Unifying RLS Between Databricks and Power BI
If we imported this data into Power BI with a user that had full access, we would have the challenge where users would be able to bypass our RLS policy. To simplify mirroring an RLS policy in Power BI, we could change our approach in Databricks to use and _Access Control List_ (hereby referred to as ACL). This way we can import the same ACL table into the Power BI Semantic Model (Dataset) and apply an RLS policy that uses the ACL table to dynamically filter the supplier dimension, this would then filter the invoice table via the table relationship.

To implement the same access control as above via an ACL table, we could create a table that has a key that we will use to join to our dimension, and an array of users that should be able to access our _Supplier Category_.

```sql
CREATE TABLE IF NOT EXISTS supplier_manager_acl (
  group_id STRING,
  users ARRAY<STRING>
);

INSERT OVERWRITE supplier_manager_acl (group_id, users) VALUES
  ('SupplierManager(Packaging)', Array("mcole@hitachisolutions.com", "jonsmith@domain.com")),
  ('SupplierManager(Clothing)',  Array("billybob@domain.com"));
```

We would then update our view definition to filter on this table:
```sql
CREATE OR REPLACE VIEW gold.v_rls_fact_invoice
AS 
SELECT
    i.*
FROM gold.fact_invoice i
JOIN gold.dim_supplier s 
    ON i.Supplier_SK = s.Supplier_SK
JOIN default.supplier_manager_acl acl
    ON CONCAT('SupplierManager(',s.CategoryName,')') = acl.group_id
WHERE ARRAY_CONTAINS(users, SESSION_USER())
    OR IS_ACCOUNT_GROUP_MEMBER('admins') 
    OR IS_ACCOUNT_GROUP_MEMBER('Executives')
```

In Power BI we could create and apply the same RLS policy for Supplier Managers by importing our _supplier_manager_acl_ table and then applying Power Query transformations to expand the user array (parse the User array as JSON and expand the list into new rows).

We would have the below table relationships:

![Power BI Relationships](/assets/img/posts/RLS-In-Databricks-Unity-Catalog/pbiRelationships.png)

We then add a RLS role with the leveraging the `USERPRINCIPALNAME()` function which should give us the same result as `SESSION_USER()` in Databricks.

![Power BI RLS Expression](/assets/img/posts/RLS-In-Databricks-Unity-Catalog/pbiRLS.png)

We now have the exact same RLS policy applied in Power BI and now when we add new users to the ACL table in Databricks, access control is consistenly applied in our Lakehouse and Power BI Semantic Model to dynamically limit the rows presented based on the user.

# Unity Catalog RLS (UDF Row Filtering)
Following the centralized and all encompassing permissioning model introduced via Unity Catalog, we now have the ability to add RLS directly on top of Delta tables which then cascades to all downstream virtual objects (i.e. views).

Functionally this is much better than the Dynamic Views which were the only option before Unity Catalog
- RLS only needs to be defined once per physical Delta table, virtual objects like views automatically have the filtering applied
- We no longer need to block access to underlying Delta tables just to prevent users from circumventing Dynamic View row filtering.
- User Defined Functions (UDFs) can be reused across many tables to create modular row filtering logic. As logic may slightly change, you may only need to update one UDF rather than a host of tables that reference it.

>⚠️ **IMPORTANT:** UDF Row Filtering (and column masks) are in **_public preview_** at the time of writing this post. While this is a fantastic new direction, there are serious limitations which would prevent this from being used in a production capacity. See the [feature limitations](https://learn.microsoft.com/en-us/azure/databricks/data-governance/unity-catalog/row-and-column-filters#limitations) for specifics. Until this is GA, I recommend using the Dynamic Row Filtering previously discussed.


## Implementing UDF Row Filtering
In this blog I'm only covering the basic semantic differences with UDF Row Filtering, Databricks provides a fantastic importable demo notebooks to learn and test the functionality: https://www.databricks.com/resources/demos/tutorials/governance/table-acl-and-dynamic-views-with-uc

To implement UDF Row Filtering there are 2 basic steps:
1. Create a Function with an expression which returns a boolean result
1. Alter the table you want to control and map in the relevant columns to be evaluated in the function

>⚠️ _Undocumented Limitation:_ UDF Row Filtering doesn't seem to support joins within a subquery so we can't produce the exact filtering as with Dynamic Row Filtering. This limits the ability filter fact tables based on the attributes of a dimension table. The below does not filter the rows of the fact table:

```sql
CREATE OR REPLACE FUNCTION supplier_manager_row_filter (Supplier_SK INT)
  RETURN is_account_group_member('admins')
  OR is_account_group_member('Executives')
  OR EXISTS(
    SELECT 1 FROM supplier_manager_acl v
    JOIN gold.dim_supplier s /* This join prevents the rows from being filtered */
      ON CONCAT('SupplierManager(',s.CategoryName,')') = v.group_id
        AND s.Supplier_SK = Supplier_SK
    WHERE ARRAY_CONTAINS(v.users, SESSION_USER()));
```

Instead, we will create row filtering on our supplier dimension.
```sql
/* Create the UDF Row Filter */
CREATE OR REPLACE FUNCTION supplier_manager_row_filter (CategoryName STRING)
  RETURN is_account_group_member('admins')
  OR is_account_group_member('Executives')
  OR EXISTS(
    SELECT 1 FROM supplier_manager_acl v
    WHERE CONCAT('SupplierManager(',CategoryName,')') = v.group_id AND ARRAY_CONTAINS(v.users, SESSION_USER()));

/* Apply the UDF Row Filter */
ALTER TABLE gold.dim_supplier SET ROW FILTER supplier_manager_row_filter ON (CategoryName);
```

Now we can query the base Delta table, dim_supplier and our row filtering is applied:

![Filtered Dimension](/assets/img/posts/RLS-In-Databricks-Unity-Catalog/filteredDim.png)

# Closing Thoughts
Overall, UDF based row filtering will provide much greater scalability and agility to managing RLS in Databricks. I look forward using this more post-GA and hopefully seeing some of the big limitations removed. Until then, for most use cases, especially where you want to unify your approach to RLS between Databricks and Power BI, you will need to continue using Dynamic Views to provide dynamic row filtering.