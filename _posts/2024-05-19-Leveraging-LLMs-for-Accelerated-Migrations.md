---
layout: post
title: "Generative AI and Spark: Leveraging LLMs for Accelerated Migrations"
tags: [Fabric, Spark, Lakehouse, Databricks]
categories: Data-Engineering
feature-img: "assets/img/feature-img/pexels-googledeepmind-17485743.jpeg"
thumbnail: "assets/img/thumbnails/feature-img/pexels-googledeepmind-17485743.jpeg"
published: true
---

LLMs like ChatGPT and CoPilot are transforming every industry, so why not use them as a data engineer to free up time for more complex tasks? One thing every data engineer—and most humans—are revolted by is repetitive tasks. Thankfully, we don't live in the world of iRobot and all we need are tokens to pay the LLM masters to get our work done.

How about the scenario of a replatform from Synapse Dedicated (or any other non-Spark-based environment) to Spark? Typically, this would involve an army of developers with competency in both SQL dialects and plenty of time to work through refactoring or rewriting scripts. Sound fun? Let's get smarter about how we work and leverage AI to make us more productive and available for higher-value tasks.

# The Challenge
Imagine that we have 200 stored procedures that follow a typical pattern for building a dimension or a fact table and given that in our new Spark environment we are going to use a programatic approach to building our dimensions and facts, we just need to extract the core business logic from our source code. 

To do this we _could_ empower our developers with access to ChatGPT, but who wants to enter repetitive prompts into an LLM, that sounds as mind-numbing as doing the work itself. How about we think about it more programmatically way, let's use Python and LLM endpoints.

## Integrating LLM Endpoints into Python

I'm going to use the out-of-the-box endpoints that come with Databricks, however, we could accomplish this via several different LLM API services: Azure OpenAI Service, OpenAI, Hugging Face, etc.

Before executing any code, run the following in Fabric Spark as the Fabric Runtime currently comes with an older version of the _openai_ library that won't work with the example code I'll provide (Databricks Runtimes do not have the OpenAI library included):

```python
%pip install openai --upgrade
```

Now before any additional coding, let's consider rules for the LLM to follow, just like if we were to add acceptance criteria into a user story for our development efforts:

1. Remove any comments or commented out code (/* or --).
1. If there's a HASHBYTES expression with a column aliased as ROW_HASH, remove the column.
1. If the SELECT statement can be simplified, i.e after removing ROW_HASH there's only an asterisk for a subquery, only return the subquery.
1. Ensure that it is a complete select DQL statement.

Since we are dealing with an LLM and want to minimize the amount of response parsing in Python, we need to be really specific about how we want the response returned:
1. Return the code as raw text, not as markdown.
1. Do not escape special characters (i.e. asterisks).
1. **Don't be chatty**, I don't want any commentary... I just want the code. 

Now that we've effectively defined our acceptance criteria for the LLM, let's work it into the python script. We sent the endpoint two messages, one to inform how it should operate (our expectations or acceptance criteria), the second message (role = user) is what we are submitting to the endpoint - the code we want parsed.

```python
from openai import OpenAI
import os

TOKEN = '<api_token>'
BASE_URL = '<serving_endpoint>'
MODEL = 'databricks-meta-llama-3-70b-instruct'

client = OpenAI(
  api_key=TOKEN, 
  base_url=BASE_URL, 
)

chat_completion = client.chat.completions.create(
  messages=[
    {
      "role": "system",
      "content": """You are an expert at TSQL. Only return the first select statement from the provided code and follow the below rules: 
        1. Remove any comments or commented out code (/* or --).
        2. If there's a HASHBYTES expression with a column aliased as ROW_HASH, remove the column.
        3. If the SELECT statement can be simplified, i.e after removing ROW_HASH there's only an asterisk for a subquery, only return the subquery.
        4. Ensure that it is a complete select DQL statement.
        5. Return the code as raw text, not as markdown.
        6. Do not escape special characters (i.e. asterisks).
        7. Don't be chatty, I don't want any commentary... I just want the code. """,
    },
    {
      "role": "user",
      "content": """CREATE PROC [DW].[UPDATE_DIM_CUSTOMER] AS 
/*
this dimensions is provided to....
*/
IF OBJECT_ID('TEMPDB..#CUSTOMER_STG') IS NOT NULL
    DROP TABLE TEMPDB..#CUSTOMER_STG

CREATE TABLE TEMPDB..#CUSTOMER_STG WITH(DISTRIBUTION = HASH(CUSTOMER_KEY), HEAP) 
AS SELECT *,
CONVERT(VARBINARY(64), HASHBYTES('sha2_512', CONCAT (
[CUSTOMER_KEY], '|'
,[ORG_ID], '|'
,[COLUMN1], '|'
,[COLUMN2], '|'
,[COLUMN3], '|'
,[COLUMN4], '|'
,[COLUMN5], '|'
,[COLUMN6],'|'
)
)
) AS ROW_HASH  
FROM 
(   -- Custom Table Data
    SELECT 
          SRC.COLUMN_A "CUSTOMER_KEY"
         ,CONVERT(VARCHAR(4), SRC.COLUMN_B AS VARCHAR) "ORG_ID"
         ,SRC.COLUMN_C "COLUMN1"
         ,SRC.COLUMN_D "COLUMN2"
         ,SRC.COLUMN_E "COLUMN3"
         ,SRC.COLUMN_F "COLUMN4" /* added 1/1/23 */
         ,SRC.COLUMN_G "COLUMN5"
         ,SRC.COLUMN_H "COLUMN6"
    FROM SOURCE_DB.SOURCE_TABLE SRC 
) AS A

-- Insert new records 
INSERT [DW].DIM_CUSTOMER(
[CUSTOMER_KEY]	
,[ORG_ID]			
,[COLUMN1]								
,[COLUMN2]								
,[COLUMN3]								
,[COLUMN4]							
,[COLUMN5]				
,[COLUMN6]	
,[ROW_HASH], [ROW_CREATED_DATE],[IS_CURRENT])
SELECT	A.*
, GETDATE()
, 1
FROM #CUSTOMER_STG  A
LEFT JOIN [DW].DIM_CUSTOMER  B 
  ON A.CUSTOMER_KEY= B.CUSTOMER_KEY
WHERE B.CUSTOMER_KEY IS NULL

-- Update Existing Records 
UPDATE [DW].DIM_CUSTOMER
SET 
[CUSTOMER_KEY] = A.[CUSTOMER_KEY],
[ORG_ID] = A.[ORG_ID],
[COLUMN1]   = A.[COLUMN1],
[COLUMN2]   = A.[COLUMN2],
[COLUMN3]    = A.[COLUMN3],
[COLUMN4] = A.[COLUMN4],
[COLUMN5]=A.[COLUMN5],
[COLUMN6]		   = A.[COLUMN6],
[ROW_LAST_UPDATED_DATE] = CAST(GETDATE() AS DATETIME2(0)),
[ROW_HASH] = A.[ROW_HASH]
FROM #CUSTOMER_STG A
WHERE [DW].[DIM_CUSTOMER].CUSTOMER_KEY = A.CUSTOMER_KEY
AND [DW].[DIM_CUSTOMER].[ROW_HASH] <> A.[ROW_HASH]

DROP TABLE TEMPDB..#CUSTOMER_STG

GO

""",
    }
  ],
  model=MODEL,
  max_tokens=256
)

response_content = chat_completion.choices[0].message.content

print(response_content)
```

Although I was planning to use the new DBRX model, in the end, I used the `databricks-meta-llama-3-70b-instruct` model as it was better than DBRX for following a complex set of rules. With DBRX, it did fine with a couple of rules, but once I had all of them folded in, it seemed to consistently miss one or two of the rules I gave.

Here's the printed response:

```sql
SELECT 
          SRC.COLUMN_A "CUSTOMER_KEY"
        ,CONVERT(VARCHAR(4), SRC.COLUMN_B AS VARCHAR) "ORG_ID"
        ,SRC.COLUMN_C "COLUMN1"
        ,SRC.COLUMN_D "COLUMN2"
        ,SRC.COLUMN_E "COLUMN3"
        ,SRC.COLUMN_F "COLUMN4" 
        ,SRC.COLUMN_G "COLUMN5"
        ,SRC.COLUMN_H "COLUMN6"
FROM SOURCE_DB.SOURCE_TABLE SRC
```

Now we could use SQLGlot as I showcased in a prior [blog post](https://milescole.dev/data-engineering/2024/04/17/The-SQL-Decoder-Ring-for-Replatforming-to-Fabric-And-Databricks.html) and convert the TSQL to SparkSQL:

```sql
SELECT
  SRC.COLUMN_A AS `CUSTOMER_KEY`,
  CAST(SRC.COLUMN_B AS STRING) AS `ORG_ID`,
  SRC.COLUMN_C AS `COLUMN1`,
  SRC.COLUMN_D AS `COLUMN2`,
  SRC.COLUMN_E AS `COLUMN3`,
  SRC.COLUMN_F AS `COLUMN4`,
  SRC.COLUMN_G AS `COLUMN5`,
  SRC.COLUMN_H AS `COLUMN6`
FROM SOURCE_DB.SOURCE_TABLE AS SRC
```
> ⚠️ I'd recommend SQLGlot over using LLM APIs for transpiling between different SQL dialects. First, it is entirely a rules based approach whereas LLMs are more likely to make errors. Secondly, there's no need to pay for a LLM to do this work.

Now, if we wanted to do this in bulk for our 200 stored procedure files, we could do something like the below:

```python
from openai import OpenAI
import sqlglot as sg
import os

TOKEN = '<api_token>'
BASE_URL = '<serving_endpoint>'
MODEL = 'databricks-meta-llama-3-70b-instruct'

INPUT_DIR = '<input sql file directory>'
TARGET_DIR = '<director to save parsed and transpiled files>'

client = OpenAI(
  api_key=TOKEN, 
  base_url=BASE_URL, 
)

files = mssparkutils.fs.ls(INPUT_DIR)

for f in files:
    file_content = mssparkutils.fs.head(f.path, 1000000)

    chat_completion = client.chat.completions.create(
      messages=[
        {
          "role": "system",
          "content": """You are an expert at TSQL. Only return the first select statement from the provided code and follow the below rules: 
            1. Remove any comments or commented out code (/* or --).
            2. If there's a HASHBYTES expression with a column aliased as ROW_HASH, remove the column.
            3. If the SELECT statement can be simplified, i.e after removing ROW_HASH there's only an asterisk for a subquery, only return the subquery.
            4. Ensure that it is a complete select DQL statement.
            5. Return the code as raw text, not as markdown.
            6. Do not escape special characters (i.e. asterisks).
            7. Don't be chatty, I don't want any commentary... I just want the code. """,
        },
        {
          "role": "user",
          "content": file_content,
        }
      ],
      model=MODEL,
      max_tokens=256
    )

    response_content = chat_completion.choices[0].message.content

    transpiled_code = sg.transpile(response_content, read="tsql", write="spark", pretty=True)[0]

    file_name = f"{TARGET_DIR}/{f.name}"
    mssparkutils.fs.put(file_name, transpiled_code, overwrite=True)
```

The above script would execute in a couple of minutes at most for 200 input scripts... _in a real-world migration project where we have to parse and transpile code, this could translate to **hundreds of hours saved**_.


