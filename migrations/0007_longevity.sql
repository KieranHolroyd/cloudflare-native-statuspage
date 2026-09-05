-- Long-term data management: raw uptime checks roll up into daily aggregates
-- (kept forever, ~365 small rows/service/year) while raw rows are pruned after
-- a week by the daily housekeeping cron. Plus service ordering and an index
-- for the public event feed.

CREATE TABLE "uptime_daily" (
	"serviceId" INTEGER NOT NULL REFERENCES "service" ("id") ON DELETE CASCADE,
	"day" TEXT NOT NULL,
	"checks" INTEGER NOT NULL,
	"failures" INTEGER NOT NULL,
	"avgLatencyMs" INTEGER,
	"maxLatencyMs" INTEGER,
	PRIMARY KEY ("serviceId", "day")
);

ALTER TABLE "service" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "status_event_created_idx" ON "status_event" ("createdAt" DESC);

-- backfill aggregates from existing raw checks (completed days only)
INSERT INTO "uptime_daily" ("serviceId", "day", "checks", "failures", "avgLatencyMs", "maxLatencyMs")
SELECT "serviceId", date("checkedAt"), COUNT(*), COUNT(*) - SUM("ok"),
       CAST(ROUND(AVG("latencyMs")) AS INTEGER), MAX("latencyMs")
FROM "uptime_check"
WHERE date("checkedAt") < date('now')
GROUP BY "serviceId", date("checkedAt");

DELETE FROM "uptime_check" WHERE "checkedAt" < datetime('now', '-7 days');
