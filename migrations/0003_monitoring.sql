-- Uptime monitoring + incidents
ALTER TABLE "service" ADD COLUMN "monitorUrl" TEXT;
-- 1 when the current status was set by the automated checker (so it may auto-recover)
ALTER TABLE "service" ADD COLUMN "autoStatus" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "uptime_check" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"serviceId" INTEGER NOT NULL REFERENCES "service" ("id") ON DELETE CASCADE,
	"ok" INTEGER NOT NULL,
	"statusCode" INTEGER,
	"latencyMs" INTEGER,
	"checkedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "uptime_check_service_time_idx" ON "uptime_check" ("serviceId", "checkedAt" DESC);

CREATE TABLE "incident" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"title" TEXT NOT NULL,
	"severity" TEXT NOT NULL DEFAULT 'minor'
		CHECK ("severity" IN ('minor', 'major', 'critical')),
	"status" TEXT NOT NULL DEFAULT 'investigating'
		CHECK ("status" IN ('investigating', 'identified', 'monitoring', 'resolved')),
	"serviceId" INTEGER REFERENCES "service" ("id") ON DELETE SET NULL,
	"createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	"resolvedAt" TEXT
);
CREATE INDEX "incident_status_idx" ON "incident" ("status", "createdAt" DESC);

CREATE TABLE "incident_update" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"incidentId" INTEGER NOT NULL REFERENCES "incident" ("id") ON DELETE CASCADE,
	"status" TEXT NOT NULL,
	"message" TEXT NOT NULL,
	"createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX "incident_update_incident_idx" ON "incident_update" ("incidentId", "createdAt" DESC);
