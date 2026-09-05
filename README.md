# cloudflare-native-statuspage

A full status page that runs entirely on a single Cloudflare Worker.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/KieranHolroyd/cloudflare-native-statuspage)

One click provisions everything in your own Cloudflare account — the D1 database, the Durable Object, and both cron triggers are created automatically from [wrangler.jsonc](wrangler.jsonc). During setup, set the **deploy command** to:

```sh
npx wrangler d1 migrations apply statuspage-db --remote && npx wrangler deploy
```

so database migrations run on every deploy (the build command is `npm run build`). No secrets to configure: the auth signing secret self-provisions on first request (set a `BETTER_AUTH_SECRET` Worker secret later if you prefer your own). Then open your new site — the first visit walks you through creating the admin account.

- **Frontend + SSR**: SvelteKit (Svelte 5) via `@sveltejs/adapter-cloudflare`
- **Database**: Cloudflare D1 (sqlite)
- **Auth**: [better-auth](https://better-auth.com) with email + password, backed by D1 through `kysely-d1`
- **Realtime**: a Durable Object WebSocket channel (`/ws`) pushes updates to every open status page
- **Monitoring**: a cron trigger (every minute) health-checks each service and records latency

## Features

- Public status page: overall banner, per-service status, incident timelines, past incidents, recent-updates feed
- **Live updates** — pages refresh instantly over WebSocket when anything changes (auto-reconnect, polling fallback)
- **Uptime checks** — cron pings each service's monitor URL; two consecutive failures auto-set `major_outage` (with a public note), and a passing check auto-recovers it. Manual status changes are never overridden.
- **Latency charts** — 24h latency graph (15-min buckets, failure markers) per monitored service
- **90-day uptime bars** with daily percentages and 24h/90d uptime numbers
- **Incidents** — severity, multiple affected services each with an impact level, public timeline updates (investigating → identified → monitoring → resolved), and postmortems. Opening an incident can set the affected services' statuses; resolving restores them.
- **Scheduled maintenance** — plan a window with affected services; the cron starts and completes it automatically, flipping services to "Under maintenance" and back (never masking a real outage)
- **Public incident pages** — every incident/maintenance has a permalink (`/incident/[id]`) with timeline, duration, and postmortem, plus a month-grouped `/history` page
- **Custom branding** — editable site title and description; a brand logo (uploaded image, also used as the favicon) or a Lucide icon; per-service images or icons. Uploads are stored in D1 (max 256 KB, PNG/JPEG/WebP/GIF/SVG) and served from `/img/[id]` with immutable caching — no extra storage service needed.
- **First-run onboarding** — with no accounts, every page redirects to `/onboarding` to create the admin account
- **Invitation-only access** — after onboarding, sign-up is closed by default; admins create expiring single-use invite links (`/invite/<token>`) from the dashboard, or flip open sign-up back on
- **RSS feed** (`/feed.xml`) of incidents & maintenance — the zero-maintenance alternative to email subscriptions
- **JSON status API** (`/api/status`, CORS-open, 60s cache) for badges, monitors, and integrations
- Paginated incident history, per-service sort order, editable service names/descriptions, styled error pages, security headers
- Authenticated dashboard for all of the above, plus a "Run uptime checks now" button and a team/members view

## Built to run unattended

This is intended as "finished software": deploy once, use for years.

- **Bounded data, forever.** A daily housekeeping cron (03:13 UTC) rolls raw uptime checks into `uptime_daily` aggregates (~365 tiny rows/service/year, kept forever — they power the 90-day bars and all-time uptime %), then prunes: raw checks after 7 days, public status events after 1 year, expired auth sessions/verifications, invitations 30 days past use/expiry, and unreferenced images. Incidents and their timelines are permanent — they grow by human action, not by the clock.
- **Subrequest-safe checks.** Health checks run in chunks of 5, so a long service list can't exhaust a Worker invocation's subrequest budget. (On the free plan's ~50-subrequest limit, keep monitored services under ~15; the paid plan's 1000 is a non-issue.)
- **No external dependencies at runtime.** No email provider, no object storage, no third-party APIs — D1, a Durable Object, and cron triggers only. Nothing to renew, rotate, or migrate.

## Architecture notes

The SvelteKit adapter only emits a `fetch` handler, so [src/worker.ts](src/worker.ts) is the real Worker entry: it routes `/ws` to the [StatusChannel](src/lib/server/status-channel.ts) Durable Object, adds the `scheduled` cron handler ([checks.ts](src/lib/server/checks.ts)), and delegates everything else to the generated SvelteKit worker.

⚠️ The adapter writes its output to the `main` of whatever wrangler config it reads — that's why there are two configs: [wrangler.adapter.jsonc](wrangler.adapter.jsonc) (used only by the adapter in vite.config.ts, and for `vite dev` binding emulation) and [wrangler.jsonc](wrangler.jsonc) (the real one, used by `wrangler dev`/`deploy`). Keep the D1 binding identical in both.

Other pieces:

- [migrations/](migrations/) — D1 migrations: better-auth tables, statuspage tables + seed, monitoring/incident tables
- [src/hooks.server.ts](src/hooks.server.ts) — mounts better-auth at `/api/auth/*`, resolves the session into `locals`
- [src/lib/server/statuspage.ts](src/lib/server/statuspage.ts) — D1 queries (services, incidents, latency/uptime aggregates)
- [src/lib/realtime-client.ts](src/lib/realtime-client.ts) — browser WebSocket subscription with reconnect + polling fallback
- [src/lib/components/](src/lib/components/) — dependency-free SVG latency chart and uptime bars

## Local development

```sh
npm install
npm run db:migrate        # apply migrations to the local D1 (stored in .wrangler/state)
npm run preview           # build + wrangler dev — full experience (WebSocket, DO, D1)
# or
npm run dev               # vite dev with HMR — D1 emulated; no /ws route (client falls back to polling)
```

To exercise the cron handler locally, run `npx wrangler dev --test-scheduled` (after `npm run build`) and hit:

```sh
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*"
```

The dev auth secret lives in `.dev.vars` (gitignored). On first run you'll be taken to `/onboarding` to create the admin account. Then set a **monitor URL** per service in the dashboard — checks, charts, and auto-status need it.

### How sign-up gating works

[hooks.server.ts](src/hooks.server.ts) decides per-request whether better-auth's sign-up endpoint is enabled: always for the first account; afterwards only if the dashboard's "Open sign-up" toggle is on (stored in the `setting` table) or the request carries a valid `invite_token` cookie, which `/invite/[token]` sets after validating the link. A successful invited sign-up marks the invitation used (single-use); links expire after 7 days and can be revoked from the dashboard.

## Deploying manually

```sh
npx wrangler d1 create statuspage-db   # once — the config references it by name, no id to paste
npm run deploy                         # build + remote migrations + deploy
```

[wrangler.jsonc](wrangler.jsonc) intentionally contains no `database_id` — wrangler resolves the database by name in whichever account deploys it, so the same config works for every fork. Cron triggers and the Durable Object are created on first deploy. `BETTER_AUTH_SECRET` is optional (`npx wrangler secret put BETTER_AUTH_SECRET`); without it a random secret is generated and stored in the database on first request.

Visit the deployed site once to run onboarding and claim the admin account — until then the site shows only the setup page, and sign-up stays invitation-only afterwards unless you open it.
