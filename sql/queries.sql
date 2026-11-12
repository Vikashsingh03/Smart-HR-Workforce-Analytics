-- Smart HR Workforce Analytics — SQL analytical questions Q1 to Q7
-- From the capstone proposal, Section 10.
-- PLANNED queries, written against the proposal's PostgreSQL design
-- (dim_employee, fact_employment, fact_satisfaction, fact_attrition).
-- They have NOT been run against a loaded database yet — the dataset
-- is not loaded and the system is not built yet, so run and cross-check
-- each one with pandas before relying on its result.
--
-- Tenure band: 0-2, 3-5, 6-10, 10+ years, based on YearsAtCompany.
-- Income band: <3000, 3000-6000, 6000-10000, >10000 (monthly income).

-- Q1: What is the attrition rate by department?
SELECT department,
       COUNT(*) AS headcount,
       ROUND(AVG(attrition) * 100, 1) AS attrition_pct
FROM dim_employee
JOIN fact_attrition USING (employee_number)
GROUP BY department
ORDER BY attrition_pct DESC;

-- Q2: Does overtime go along with attrition? (everyone, then by department)
SELECT over_time,
       COUNT(*) AS headcount,
       ROUND(AVG(attrition) * 100, 1) AS attrition_pct
FROM dim_employee
JOIN fact_employment USING (employee_number)
JOIN fact_attrition USING (employee_number)
GROUP BY over_time
ORDER BY attrition_pct DESC;

SELECT department, over_time,
       COUNT(*) AS headcount,
       ROUND(AVG(attrition) * 100, 1) AS attrition_pct
FROM dim_employee
JOIN fact_employment USING (employee_number)
JOIN fact_attrition USING (employee_number)
GROUP BY department, over_time
ORDER BY department, attrition_pct DESC;

-- Q3: Which job roles lose people fastest?
SELECT job_role,
       COUNT(*) AS headcount,
       ROUND(AVG(attrition) * 100, 1) AS attrition_pct
FROM dim_employee
JOIN fact_attrition USING (employee_number)
GROUP BY job_role
ORDER BY attrition_pct DESC;

-- Q4: How do satisfaction and work-life balance relate to leaving?
-- Average satisfaction scores for people who left vs people who stayed,
-- split by satisfaction band (Low 1-2, Medium 3, High 4).
SELECT attrition,
       ROUND(AVG(job_satisfaction), 2) AS avg_job_satisfaction,
       ROUND(AVG(environment_satisfaction), 2) AS avg_env_satisfaction,
       ROUND(AVG(relationship_satisfaction), 2) AS avg_rel_satisfaction,
       ROUND(AVG(work_life_balance), 2) AS avg_work_life_balance,
       COUNT(*) AS headcount
FROM fact_satisfaction
JOIN fact_attrition USING (employee_number)
GROUP BY attrition;

-- Q5: Is early tenure the riskiest period?
SELECT CASE
         WHEN years_at_company <= 2 THEN '0-2'
         WHEN years_at_company <= 5 THEN '3-5'
         WHEN years_at_company <= 10 THEN '6-10'
         ELSE '10+'
       END AS tenure_band,
       COUNT(*) AS headcount,
       ROUND(AVG(attrition) * 100, 1) AS attrition_pct
FROM dim_employee
JOIN fact_employment USING (employee_number)
JOIN fact_attrition USING (employee_number)
GROUP BY tenure_band
ORDER BY tenure_band;

-- Q6: Does income level matter, apart from role?
SELECT CASE
         WHEN monthly_income < 3000 THEN '<3000'
         WHEN monthly_income < 6000 THEN '3000-6000'
         WHEN monthly_income < 10000 THEN '6000-10000'
         ELSE '>10000'
       END AS income_band,
       COUNT(*) AS headcount,
       ROUND(AVG(attrition) * 100, 1) AS attrition_pct
FROM fact_employment
JOIN fact_attrition USING (employee_number)
GROUP BY income_band
ORDER BY income_band;

SELECT department,
       CASE
         WHEN monthly_income < 3000 THEN '<3000'
         WHEN monthly_income < 6000 THEN '3000-6000'
         WHEN monthly_income < 10000 THEN '6000-10000'
         ELSE '>10000'
       END AS income_band,
       COUNT(*) AS headcount,
       ROUND(AVG(attrition) * 100, 1) AS attrition_pct
FROM dim_employee
JOIN fact_employment USING (employee_number)
JOIN fact_attrition USING (employee_number)
GROUP BY department, income_band
ORDER BY department, income_band;

-- Q7: Where should HR act first?
-- Departments and roles with both a high attrition rate and headcount >= 50.
SELECT department, job_role,
       COUNT(*) AS headcount,
       ROUND(AVG(attrition) * 100, 1) AS attrition_pct
FROM dim_employee
JOIN fact_attrition USING (employee_number)
GROUP BY department, job_role
HAVING COUNT(*) >= 50
ORDER BY attrition_pct DESC;
