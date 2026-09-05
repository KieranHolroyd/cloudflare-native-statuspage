export interface Invitation {
	token: string;
	note: string | null;
	createdBy: string;
	createdAt: string;
	expiresAt: string;
	usedAt: string | null;
	usedBy: string | null;
}

export interface UserSummary {
	id: string;
	name: string;
	email: string;
	createdAt: string;
}

export async function countUsers(db: D1Database): Promise<number> {
	const row = await db.prepare('SELECT COUNT(*) AS c FROM "user"').first<{ c: number }>();
	return row?.c ?? 0;
}

export async function listUsers(db: D1Database): Promise<UserSummary[]> {
	const { results } = await db
		.prepare('SELECT id, name, email, createdAt FROM "user" ORDER BY createdAt')
		.all<UserSummary>();
	return results;
}

export async function isSignupsOpen(db: D1Database): Promise<boolean> {
	const row = await db
		.prepare(`SELECT value FROM setting WHERE key = 'signupsEnabled'`)
		.first<{ value: string }>();
	return row?.value === '1';
}

export async function setSignupsOpen(db: D1Database, open: boolean): Promise<void> {
	await db
		.prepare(
			`INSERT INTO setting (key, value) VALUES ('signupsEnabled', ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value`
		)
		.bind(open ? '1' : '0')
		.run();
}

const INVITE_VALID_DAYS = 7;

export async function createInvitation(
	db: D1Database,
	note: string | null,
	createdBy: string
): Promise<string> {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	await db
		.prepare(
			`INSERT INTO invitation (token, note, createdBy, expiresAt)
			 VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+${INVITE_VALID_DAYS} days'))`
		)
		.bind(token, note, createdBy)
		.run();
	return token;
}

export async function listInvitations(db: D1Database): Promise<Invitation[]> {
	const { results } = await db
		.prepare(
			'SELECT token, note, createdBy, createdAt, expiresAt, usedAt, usedBy FROM invitation ORDER BY createdAt DESC LIMIT 50'
		)
		.all<Invitation>();
	return results;
}

export async function revokeInvitation(db: D1Database, token: string): Promise<void> {
	await db.prepare('DELETE FROM invitation WHERE token = ?').bind(token).run();
}

/** Returns the invitation if it exists, is unused, and hasn't expired. */
export async function validateInvitation(
	db: D1Database,
	token: string
): Promise<Invitation | null> {
	const row = await db
		.prepare(
			`SELECT token, note, createdBy, createdAt, expiresAt, usedAt, usedBy FROM invitation
			 WHERE token = ? AND usedAt IS NULL AND expiresAt > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
		)
		.bind(token)
		.first<Invitation>();
	return row ?? null;
}

export async function markInvitationUsed(
	db: D1Database,
	token: string,
	usedBy: string
): Promise<void> {
	await db
		.prepare(
			`UPDATE invitation SET usedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), usedBy = ? WHERE token = ?`
		)
		.bind(usedBy, token)
		.run();
}
