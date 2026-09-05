const MAX_IMAGE_BYTES = 256 * 1024;
const ALLOWED_TYPES = new Set([
	'image/png',
	'image/jpeg',
	'image/webp',
	'image/gif',
	'image/svg+xml'
]);

/** Store an uploaded image in D1. Returns the new image id, or an error string. */
export async function saveImage(db: D1Database, file: File): Promise<number | string> {
	if (!ALLOWED_TYPES.has(file.type)) {
		return 'Unsupported image type — use PNG, JPEG, WebP, GIF or SVG';
	}
	if (file.size > MAX_IMAGE_BYTES) {
		return `Image too large — max ${MAX_IMAGE_BYTES / 1024} KB`;
	}
	const data = await file.arrayBuffer();
	const row = await db
		.prepare('INSERT INTO image (data, contentType) VALUES (?, ?) RETURNING id')
		.bind(data, file.type)
		.first<{ id: number }>();
	return row ? row.id : 'Failed to store image';
}

export async function deleteImage(db: D1Database, id: number | null) {
	if (id === null) return;
	await db.prepare('DELETE FROM image WHERE id = ?').bind(id).run();
}

export async function getImage(
	db: D1Database,
	id: number
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
	const row = await db
		.prepare('SELECT data, contentType FROM image WHERE id = ?')
		.bind(id)
		.first<{ data: ArrayBuffer | number[]; contentType: string }>();
	if (!row) return null;
	// D1 may deserialize blobs as number arrays depending on the client path
	const data =
		row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data).buffer;
	return { data, contentType: row.contentType };
}
