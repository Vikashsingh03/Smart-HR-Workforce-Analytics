# Smart HR Workforce Analytics

From scattered HR records to clear retention answers — with SQL analytics and
practical GenAI.

**Status: working demo.** The pipeline, API, dashboard and GenAI layer are
built and verified end to end on .NET 8 + Angular 18. This is the .NET
implementation of the approved HCL Hackathon capstone proposal
("Smart HR Workforce Analytics"). The proposal planned Python + Node + React;
this build uses the training stack (ASP.NET Core + Angular) instead — the
pipeline, the database design and the seven analytical questions are
unchanged.

## The problem

HR teams keep attendance, leave, salary and satisfaction data in separate
files, so they cannot see which departments, roles or work patterns are
linked to people leaving. A resignation often arrives as a surprise, and one
company-wide attrition percentage does not say where the problem is.

This project loads one clean HR dataset, answers seven checkable SQL
questions about it, and shows the answers on a dashboard — so an HR manager
can see a number, see where it came from, and act before the next resignation.

## Dataset

- **IBM HR Analytics Employee Attrition and Performance** — 1,470 employee
  records, 35 columns. Attrition: 237 Yes (16.1%), 1,233 No.
- Source: https://www.kaggle.com/datasets/pavansubhasht/ibm-hr-analytics-attrition-dataset
- The dataset is fictional, made by IBM data scientists for teaching HR
  analytics. No real employee personal data is used.
- The raw CSV is in `data/` (SHA-256 verified). It is sample data, not
  company data.

## How it works

```
Kaggle CSV (IBM HR Analytics, 1,470 rows)
        |
        v
Ingestion (C# console app) — checksum noted, cleaning, quarantine
        |
        v
SQLite (default) or PostgreSQL — dim_employee, fact_employment,
fact_satisfaction, fact_attrition, load_log, quarantine
        |
        v
ASP.NET Core Web API — 7 analytical questions + employees + GenAI
        |
        +--> Angular dashboard — charts from the API only, no hand-typed numbers
        |
        +--> GenAI explanation layer (read-only)
```

**GenAI guardrail:** GenAI explains database results. It never makes up a
number, and it never writes to the database. The natural-language-to-SQL
endpoint only accepts a single SELECT over the four allowed tables; anything
else is rejected.

## Quick start (Windows)

Prerequisites: [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
and [Node.js 18+](https://nodejs.org/) (for the dashboard only).

Extract this ZIP to a folder, for example `C:\Users\HP\SmartHR`, then open a
terminal in that folder and run:

```powershell
# 1. Load the data (once; re-running is safe — it skips if already loaded)
dotnet run --project src/SmartHR.Ingestion

# 2. Start the API (http://localhost:5000, Swagger at /swagger)
dotnet run --project src/SmartHR.Api
```

In a second terminal, in the same folder:

```powershell
# 3. Start the dashboard (http://localhost:4200)
cd src/SmartHR.Web
npm install
npm start
```

Open http://localhost:4200. The database file `smarthr.db` is already included
pre-loaded, so step 1 will report "Already loaded, skipping" — that is
expected. Delete `smarthr.db` and re-run step 1 to watch a fresh load.

## The seven questions (verified results)

| # | Question | Answer (from the data) |
|---|----------|------------------------|
| Q1 | Attrition rate by department | Sales 20.6%, Human Resources 19.0%, R&D 13.8% |
| Q2 | Does overtime go along with attrition? | Overtime Yes 30.5% vs No 10.4% |
| Q3 | Which job roles lose people fastest? | Sales Representative 39.8%, Lab Technician 23.9% |
| Q4 | Satisfaction vs leaving | People who left averaged 2.47 job satisfaction vs 2.78 for those who stayed |
| Q5 | Is early tenure the riskiest period? | Yes — 0–2 years 29.8%, 10+ years 8.1% |
| Q6 | Does income level matter? | Under 3000/month 28.6% vs over 10000/month 8.9% |
| Q7 | Where should HR act first? | Sales Representatives (39.8%, 83 people), then Lab Technicians (23.9%, 259 people) |

Overall: 237 of 1,470 left (16.1%). Average monthly income 6,503.

## API endpoints

Base URL: `http://localhost:5000/api`

| Method | Endpoint | What it returns |
|--------|----------|-----------------|
| GET | `/health` | `{ status, rows, provider }` |
| GET | `/analytics/summary` | Totals, attrition rate, average income |
| GET | `/analytics/attrition-by-department` | Q1 |
| GET | `/analytics/overtime?byDepartment=false` | Q2 (set `byDepartment=true` for the split) |
| GET | `/analytics/attrition-by-role` | Q3 |
| GET | `/analytics/satisfaction` | Q4 |
| GET | `/analytics/tenure` | Q5 |
| GET | `/analytics/income?byDepartment=false` | Q6 |
| GET | `/analytics/action-first` | Q7 |
| GET | `/employees?search=&department=&page=1&pageSize=20` | Paged employee list |
| POST | `/ai/explain` | Plain-English explanation + one HR action for given facts |
| POST | `/ai/ask` | Plain English → SQL (SELECT only) + result rows |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Ingestion & cleaning | C# console app (.NET 8) |
| API | ASP.NET Core 8 Web API, EF Core 8 |
| Database | SQLite by default (zero install); PostgreSQL supported |
| Dashboard | Angular 18 (standalone), Chart.js 4 |
| GenAI | Google Gemini API (optional — see below) |

## Database: SQLite (default) or PostgreSQL

SQLite is the default so the demo runs with zero installation. The schema is
identical to the proposal's PostgreSQL design, and the SQL in `sql/queries.sql`
is PostgreSQL dialect.

To use PostgreSQL instead (the database named in the proposal):

1. Install PostgreSQL from https://www.postgresql.org/download/windows/
   and create a database named `smarthr`.
2. In `src/SmartHR.Api/appsettings.json` **and**
   `src/SmartHR.Ingestion/appsettings.json`, change
   `"Database": { "Provider": "Sqlite" }` to `"Provider": "Postgres"` and put
   your connection details in `ConnectionStrings.Postgres`.
3. Delete `smarthr.db`, then run the ingestion (step 1 above) to load the
   data into PostgreSQL.

Note: the PostgreSQL path is implemented and compiles, but it was not run
against a live PostgreSQL server during this build (no server was available
in the build environment). The SQLite path is fully verified end to end.

## GenAI (optional)

The AI features work without any key, in a limited mode:

- **Without a key:** `/ai/explain` returns a rule-based explanation built
  only from the numbers you send it (labelled "Rule-based summary"), and
  `/ai/ask` answers the seven known question types from built-in SQL.
- **With a Gemini key:** set the environment variable `GEMINI_API_KEY`
  (get a free key at https://aistudio.google.com/apikey) before starting the
  API, or put it in `Gemini:ApiKey` in `appsettings.json`. Then `/ai/explain`
  uses Gemini, and `/ai/ask` can turn new questions into SELECT queries
  (still validated: SELECT only, allowed tables only, 50 rows max).

Never commit a real API key into the repository.

## Project structure

```
SmartHR.sln
src/
  SmartHR.Core/        Entities, DbContext, CSV loader, analytics (Q1–Q7), AI services
  SmartHR.Ingestion/   Console app: load the CSV into the database
  SmartHR.Api/         Web API: controllers, appsettings.json, Swagger
  SmartHR.Web/         Angular 18 dashboard (Dashboard, Employees, AI Assistant)
data/                  WA_Fn-UseC_-HR-Employee-Attrition.csv (verified sample data)
sql/                   queries.sql — Q1–Q7 in PostgreSQL dialect
DEMO-GUIDE.md          5-minute demo script + viva questions (Hinglish)
```

## Cleaning rules (as implemented)

- Attrition Yes → 1, No → 0. OverTime Yes → 1, No → 0.
- Trimmed and case-fixed Department, JobRole, MaritalStatus, BusinessTravel.
- Dropped EmployeeCount (always 1), StandardHours (always 80), Over18 (always Y).
- Out-of-range rows go to a `quarantine` table with a reason, never deleted
  quietly. (The real data is clean: 0 quarantined.)
- Derived: TenureBand (0–2, 3–5, 6–10, 10+), IncomeBand (<3000, 3000–6000,
  6000–10000, >10000), SatisfactionScore (mean of the three satisfactions).
- Re-running the ingestion with the same file is a no-op (SHA-256 checksum);
  `--force` reloads.

## Troubleshooting

- **API says "no such table"** — the database is empty. Run step 1
  (ingestion) from the project root folder, then restart the API.
- **Dashboard shows "Loading…" forever** — the API is not running. Start
  step 2 and check http://localhost:5000/api/health in the browser.
- **Port 5000 or 4200 already in use** — stop the other program using it, or
  change the port in `launchSettings.json` (API) / `npm start -- --port 4300`
  (dashboard, and update the API URL in `src/environments/environment.ts`).
- **npm install is slow** — first install downloads ~850 packages; later
  runs are fast.

## Author

Vikash Kumar Singh — B.Tech CSE, Ajay Kumar Garg Engineering College,
Ghaziabad.
