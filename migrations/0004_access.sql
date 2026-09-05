-- Sign-up policy + invitations
CREATE TABLE "setting" (
	"key" TEXT PRIMARY KEY,
	"value" TEXT NOT NULL
);
-- closed by default: after the first (onboarding) account, new users need an
-- invitation unless open sign-up is enabled in the dashboard
INSERT INTO "setting" ("key", "value") VALUES ('signupsEnabled', '0');

CREATE TABLE "invitation" (
	"token" TEXT PRIMARY KEY,
	"note" TEXT,
	"createdBy" TEXT NOT NULL,
	"createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	"expiresAt" TEXT NOT NULL,
	"usedAt" TEXT,
	"usedBy" TEXT
);
