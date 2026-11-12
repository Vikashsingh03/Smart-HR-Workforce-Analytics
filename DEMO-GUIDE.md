# Demo Guide — Smart HR Workforce Analytics (5-minute demo + viva)

Hinglish guide. Numbers are the REAL verified results — rat lo, yehi puche jayenge.

## 5-minute demo script

**Minute 0–1 — Problem aur data**
"HR ka data alag-alag files me bikhra hota hai, isliye pata nahi chalta log
kyun chhod rahe hain. Maine IBM HR Analytics dataset liya — 1,470 employees,
jinme se 237 chhod ke gaye, matlab 16.1% attrition."

**Minute 1–2 — Pipeline (ingestion chalake dikhao)**
Terminal me `dotnet run --project src/SmartHR.Ingestion` chalao:
"Ye CSV load karta hai, clean karta hai, aur database me daalta hai —
1,470 rows loaded, 0 quarantined."
Dobara chalao: "Already loaded, skipping — checksum se pehchan liya, duplicate
nahi banega." Phir database ki 5 tables dikhao: dim_employee, fact_employment,
fact_satisfaction, fact_attrition, load_log.

**Minute 2–3 — Dashboard (sabse important)**
"Dashboard pe 4 KPI cards hain, phir 6 charts. Teen baatein yaad rakhna:
Sales me attrition sabse zyada hai — 20.6%. Overtime karne wale 30.5%
chhodte hain, bina overtime wale sirf 10.4%. Aur pehle 2 saal sabse risky
hain — 29.8%."
Har chart ke neeche ek line me takeaway likha hai — wahi bolo.

**Minute 3–4 — Q7 aur Employees page**
"Action-first table batata hai HR ko pehle kahan action lena chahiye —
Sales Representative, 39.8% attrition, 83 log. Employees page pe kisi bhi
employee ko search kar sakte ho, department filter bhi hai."

**Minute 4–5 — AI Assistant (wow factor)**
"Plain English me puchho — 'What is the attrition rate by department?' —
ye SQL banata hai, chalata hai, aur result dikhata hai. Aur guardrail ye hai:
ye sirf SELECT chala sakta hai. DELETE likh ke dikhao — block ho jayega.
GenAI number khud nahi banata, sirf database ke result ko simple words me
samjhata hai."

## Viva questions — likely + answers

**Q: Python/Node ki jagah .NET kyun use kiya?**
"Proposal me pipeline fix tha — ingestion, transformation, storage, SQL
analytics, GenAI — stack fix nahi tha. Meri training .NET Full Stack ki hai,
isliye maine wahi stack use kiya. Pipeline aur sawaal bilkul wahi hain jo
proposal me the."

**Q: SQLite kyun, PostgreSQL kyun nahi?**
"Demo ke liye SQLite zero-install hai — kisi bhi laptop pe turant chalta hai.
Schema bilkul wahi hai jo proposal me PostgreSQL ke liye likha tha, aur
switch ek line ka hai — appsettings.json me Provider badlo. SQL file bhi
PostgreSQL dialect me hi hai."

**Q: Duplicate load kaise roka?**
"CSV ka SHA-256 checksum load_log table me save hota hai. Dobara chalane pe
checksum match karta hai to loader skip kar deta hai — 0 duplicates.
`--force` se dobara load kar sakte ho."

**Q: Gande data (bad rows) ka kya hota hai?**
"Quarantine table me jate hain, reason ke saath — chupchaap delete nahi hote.
Is dataset me 0 quarantined hain, kyunki data clean hai."

**Q: GenAI galat number to nahi banayega?**
"Nahi. Explain feature ko sirf wahi numbers milte hain jo database se aaye
— wo unhi ko simple words me samjhata hai. Aur NL-to-SQL sirf ek SELECT
chalata hai, allowed tables pe hi, 50 rows max. INSERT/UPDATE/DELETE/DROP
likhoge to block ho jayega."

**Q: Overtime 30.5% vs 10.4% — matlab overtime hi wajah hai?**
"Ye correlation hai, proof nahi. Overtime karne walon me attrition zyada hai,
lekin wajah salary, role ya manager bhi ho sakte hain. Isliye Q6 me income
ko role se alag karke bhi check kiya hai."

**Q: EF Core kya hai, DbContext kya karta hai?**
"EF Core .NET ka ORM hai — C# classes ko database tables se map karta hai.
DbContext database ka session hota hai: usi se queries chalti hain aur data
save hota hai. Is project me ek hi DbContext dono providers (SQLite aur
PostgreSQL) ke saath kaam karta hai."

**Q: Aage kya improve karoge?**
"Teen cheezein: production me PostgreSQL, login ke liye JWT auth, aur
ingestion ko schedule karna (roz naya data). Phir attrition prediction ke
liye ek ML model — kaunsa employee ja sakta hai, risk score ke saath."

## Agar demo me kuch gadbad ho

- **API start nahi ho rahi:** port 5000 pehle se use ho raha hoga — purana
  terminal band karo, ya `dotnet run` dobara chalao.
- **Dashboard "Loading…" pe atka:** API nahi chal rahi. Browser me
  http://localhost:5000/api/health kholo — `{"status":"ok","rows":1470}`
  aana chahiye.
- **Ingestion "no such table" bole:** pehle ingestion chalao, phir API.
  Order: Ingestion → API → Dashboard.
- **Backup demo:** API band bhi ho to Swagger UI
  (http://localhost:5000/swagger) se endpoints dikha sakte ho, aur
  `sql/queries.sql` khol ke 7 sawaal padh sakte ho.

## Yaad rakhne wale numbers (ek jhalak)

- Total 1,470 | Left 237 | Rate 16.1% | Avg income 6,503
- Sales 20.6% | HR 19.0% | R&D 13.8%
- Overtime Yes 30.5% | No 10.4%
- 0–2 saal 29.8% | 10+ saal 8.1%
- Income <3000: 28.6% | >10000: 8.9%
- Sales Representative 39.8% (83 log) — action pehle yahin
