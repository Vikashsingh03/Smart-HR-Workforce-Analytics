# System architecture — Smart HR Workforce Analytics

Planned end-to-end flow from the capstone proposal (Section 11). This is the design, not a built system yet.

```
Kaggle CSV (IBM HR Analytics, 1,470 rows)
        |
        v
Python ingestion (pandas) — checksum noted, raw file stored unchanged
        |
        +--> Small demo HR API (Node/Express) — attendance + leave, JSON, paged
        |
        v
Cleaning (pandas)
  - Attrition Yes -> 1, No -> 0 (original text kept)
  - Trim / fix case for Department, JobRole, MaritalStatus, BusinessTravel, OverTime
  - Drop EmployeeCount (always 1) and StandardHours (always 80)
  - Flag out-of-range rows to a quarantine table, never delete quietly
  - Derived fields: tenure band (0-2, 3-5, 6-10, 10+ years),
    income band (<3,000 / 3,000-6,000 / 6,000-10,000 / >10,000),
    overtime flag, satisfaction score (mean of job, environment, relationship)
        |
        v
PostgreSQL
  dim_employee | fact_employment | fact_satisfaction | fact_attrition | load_log
        |
        v
SQL analytics — Q1 to Q7 (see sql/queries.sql)
        |
        +--> React dashboard — charts from the API only, no hand-typed numbers
        |
        +--> GenAI explanation layer (read-only)
               G1: explain a SQL result in plain words + one suggested HR action
               G2: answer policy questions, quoting the source passage
               G3: plain English -> SELECT only; INSERT/UPDATE/DELETE/DROP/ALTER rejected,
                   runs under a read-only database role

Guardrail: GenAI explains database results. It never makes up a number,
and it never writes to PostgreSQL. There is no arrow from GenAI to the database.
```

## Week-wise roadmap (planned, after proposal approval)

- **Week 1 — Foundations:** dataset download + checksum, PostgreSQL schema, ingestion script, load log. Milestone: 1,470 rows loaded, re-run produces 0 duplicates.
- **Week 2 — Clean and analyse:** cleaning + quarantine, derived fields, SQL Q1–Q7 tested, results cross-checked with pandas.
- **Week 3 — Dashboard and GenAI:** React dashboard, GenAI explanation + policy Q&A + natural-language-to-SQL with read-only guard.
- **Week 4 — Test and present:** tests from proposal Section 15, 5-minute demo, final presentation.
