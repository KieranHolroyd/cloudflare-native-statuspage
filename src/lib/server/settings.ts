import type { SiteSettings } from '$lib/types';

export const DEFAULT_SITE: SiteSettings = {
	title: 'statuspage',
	description: 'Live service status and incident history',
	icon: null,
	imageId: null
};

const KEYS = ['siteTitle', 'siteDescription', 'siteIcon', 'siteImageId'] as const;

export async function getSiteSettings(db: D1Database): Promise<SiteSettings> {
	const { results } = await db
		.prepare(`SELECT key, value FROM setting WHERE key IN (${KEYS.map(() => '?').join(',')})`)
		.bind(...KEYS)
		.all<{ key: string; value: string }>();
	const map = new Map(results.map((r) => [r.key, r.value]));
	return {
		title: map.get('siteTitle') || DEFAULT_SITE.title,
		description: map.get('siteDescription') ?? DEFAULT_SITE.description,
		icon: map.get('siteIcon') || null,
		imageId: map.has('siteImageId') ? Number(map.get('siteImageId')) : null
	};
}

/**
 * Auth secret for better-auth. Prefers the BETTER_AUTH_SECRET env secret; when
 * absent (e.g. one-click deploys), a random secret is generated once and kept
 * in the settings table — same trust boundary as the session table it signs.
 */
export async function getOrCreateAuthSecret(db: D1Database): Promise<string> {
	const row = await db
		.prepare(`SELECT value FROM setting WHERE key = 'authSecret'`)
		.first<{ value: string }>();
	if (row) return row.value;
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	// concurrent first requests converge on whichever insert wins
	await db
		.prepare(`INSERT INTO setting (key, value) VALUES ('authSecret', ?) ON CONFLICT(key) DO NOTHING`)
		.bind(secret)
		.run();
	const winner = await db
		.prepare(`SELECT value FROM setting WHERE key = 'authSecret'`)
		.first<{ value: string }>();
	return winner?.value ?? secret;
}

/** Upsert a setting, or delete it when value is null (falls back to default). */
export async function setSetting(db: D1Database, key: string, value: string | null) {
	if (value === null) {
		await db.prepare('DELETE FROM setting WHERE key = ?').bind(key).run();
	} else {
		await db
			.prepare(
				`INSERT INTO setting (key, value) VALUES (?, ?)
				 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
			)
			.bind(key, value)
			.run();
	}
}
