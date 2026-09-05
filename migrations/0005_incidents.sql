-- Expanded incident management: multi-service impact, maintenance windows, postmortems.
-- The incident table is rebuilt because its CHECK constraints need new values.
--
-- NOTE the order here: incident_update is backed up and dropped BEFORE the old
-- incident table. Dropping a parent table performs an implicit DELETE that
-- fires ON DELETE CASCADE into children, which would silently erase all
-- incident timelines.
PRAGMA defer_foreign_keys = true;

CREATE TABLE "_incident_backup" AS
SELECT "id", "title", "severity", "status", "serviceId", "createdAt", "resolvedAt" FROM "incident";
CREATE TABLE "_incident_update_backup" AS
SELECT "id", "incidentId", "status", "message", "createdAt" FROM "incident_update";

DROP TABLE "incident_update";
DROP TABLE "incident";

CREATE TABLE "incident" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"type" TEXT NOT NULL DEFAULT 'incident' CHECK ("type" IN ('incident', 'maintenance')),
	"title" TEXT NOT NULL,
	"severity" TEXT NOT NULL DEFAULT 'minor'
		CHECK ("severity" IN ('minor', 'major', 'critical', 'maintenance')),
	"status" TEXT NOT NULL DEFAULT 'investigating'
		CHECK ("status" IN ('investigating', 'identified', 'monitoring', 'resolved', 'scheduled', 'in_progress', 'completed')),
	"createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	"resolvedAt" TEXT,
	"scheduledStart" TEXT,
	"scheduledEnd" TEXT,
	"postmortem" TEXT
);

INSERT INTO "incident" ("id", "type", "title", "severity", "status", "createdAt", "resolvedAt")
SELECT "id", 'incident', "title", "severity", "status", "createdAt", "resolvedAt"
FROM "_incident_backup";

CREATE TABLE "incident_update" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"incidentId" INTEGER NOT NULL REFERENCES "incident" ("id") ON DELETE CASCADE,
	"status" TEXT NOT NULL,
	"message" TEXT NOT NULL,
	"createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO "incident_update" ("id", "incidentId", "status", "message", "createdAt")
SELECT "id", "incidentId", "status", "message", "createdAt" FROM "_incident_update_backup";

CREATE TABLE "incident_service" (
	"incidentId" INTEGER NOT NULL REFERENCES "incident" ("id") ON DELETE CASCADE,
	"serviceId" INTEGER NOT NULL REFERENCES "service" ("id") ON DELETE CASCADE,
	"impact" TEXT NOT NULL DEFAULT 'degraded'
		CHECK ("impact" IN ('degraded', 'partial_outage', 'major_outage', 'maintenance')),
	PRIMARY KEY ("incidentId", "serviceId")
);

-- carry over the old single affected-service link
INSERT INTO "incident_service" ("incidentId", "serviceId", "impact")
SELECT "id", "serviceId", 'degraded' FROM "_incident_backup" WHERE "serviceId" IS NOT NULL;

DROP TABLE "_incident_backup";
DROP TABLE "_incident_update_backup";

CREATE INDEX "incident_status_idx" ON "incident" ("status", "createdAt" DESC);
CREATE INDEX "incident_update_incident_idx" ON "incident_update" ("incidentId", "createdAt" DESC);
CREATE INDEX "incident_service_incident_idx" ON "incident_service" ("incidentId");
