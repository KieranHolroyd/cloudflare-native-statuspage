-- Tiered uptime aggregation: raw (7 days) -> hourly (30 days) -> daily (1 year)
-- -> weekly (forever). Sum-based columns so tiers merge exactly (averages of
-- averages drift; sums don't).

CREATE TABLE "uptime_hourly" (
	"serviceId" INTEGER NOT NULL REFERENCES "service" ("id") ON DELETE CASCADE,
	"hour" TEXT NOT NULL, -- 'YYYY-MM-DDTHH:00' UTC
	"checks" INTEGER NOT NULL,
	"failures" INTEGER NOT NULL,
	"latencySamples" INTEGER NOT NULL,
	"sumLatencyMs" INTEGER NOT NULL,
	"maxLatencyMs" INTEGER,
	PRIMARY KEY ("serviceId", "hour")
);

CREATE TABLE "uptime_weekly" (
	"serviceId" INTEGER NOT NULL REFERENCES "service" ("id") ON DELETE CASCADE,
	"week" TEXT NOT NULL, -- Monday of the week, 'YYYY-MM-DD'
	"checks" INTEGER NOT NULL,
	"failures" INTEGER NOT NULL,
	"latencySamples" INTEGER NOT NULL,
	"sumLatencyMs" INTEGER NOT NULL,
	"maxLatencyMs" INTEGER,
	PRIMARY KEY ("serviceId", "week")
);

-- rebuild uptime_daily with sum-based columns
-- (latencySamples approximated as successful checks for pre-existing rows)
CREATE TABLE "uptime_daily_new" (
	"serviceId" INTEGER NOT NULL REFERENCES "service" ("id") ON DELETE CASCADE,
	"day" TEXT NOT NULL,
	"checks" INTEGER NOT NULL,
	"failures" INTEGER NOT NULL,
	"latencySamples" INTEGER NOT NULL,
	"sumLatencyMs" INTEGER NOT NULL,
	"maxLatencyMs" INTEGER,
	PRIMARY KEY ("serviceId", "day")
);

INSERT INTO "uptime_daily_new"
SELECT "serviceId", "day", "checks", "failures",
       "checks" - "failures",
       ("checks" - "failures") * COALESCE("avgLatencyMs", 0),
       "maxLatencyMs"
FROM "uptime_daily";

DROP TABLE "uptime_daily";
ALTER TABLE "uptime_daily_new" RENAME TO "uptime_daily";
