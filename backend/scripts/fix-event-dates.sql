-- One-off data fix: an event was saved with a wrong start year (2206 instead of 2026).
-- Run against the production database (Neon SQL Editor, branch "production", database "neondb").

-- Step 1 (read-only): list suspicious events (outside 2000-2100 or ending before they start).
SELECT "Id", "Name", "StartDate", "EndDate", "CompanyId"
FROM "Events"
WHERE EXTRACT(YEAR FROM "StartDate") NOT BETWEEN 2000 AND 2100
   OR EXTRACT(YEAR FROM "EndDate")   NOT BETWEEN 2000 AND 2100
   OR "EndDate" < "StartDate";

-- Step 2: fix ONLY the start date of the event found in step 1 (Id 2, "Social Gathering": start 2206-09-01, end 2026-10-10).
UPDATE "Events"
SET "StartDate" = "StartDate" - INTERVAL '180 years'
WHERE "Id" = 2 AND EXTRACT(YEAR FROM "StartDate") = 2206
RETURNING "Id", "Name", "StartDate", "EndDate";
