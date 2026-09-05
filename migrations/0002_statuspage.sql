CREATE TABLE "service" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"name" TEXT NOT NULL,
	"description" TEXT,
	"status" TEXT NOT NULL DEFAULT 'operational'
		CHECK ("status" IN ('operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance')),
	"updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "status_event" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"serviceId" INTEGER NOT NULL REFERENCES "service" ("id") ON DELETE CASCADE,
	"status" TEXT NOT NULL,
	"note" TEXT,
	"createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX "status_event_serviceId_idx" ON "status_event" ("serviceId", "createdAt" DESC);

-- Sample data so the public page has something to show
INSERT INTO "service" ("name", "description", "status") VALUES
	('API', 'Public REST API', 'operational'),
	('Dashboard', 'Customer-facing web dashboard', 'operational'),
	('Webhooks', 'Outbound event delivery', 'operational');
