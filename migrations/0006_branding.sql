-- Site branding + per-service visuals (uploaded images stored in D1, or lucide icon names)
CREATE TABLE "image" (
	"id" INTEGER PRIMARY KEY AUTOINCREMENT,
	"data" BLOB NOT NULL,
	"contentType" TEXT NOT NULL,
	"createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

ALTER TABLE "service" ADD COLUMN "icon" TEXT;
ALTER TABLE "service" ADD COLUMN "imageId" INTEGER REFERENCES "image" ("id") ON DELETE SET NULL;
