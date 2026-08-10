import { json } from '@sveltejs/kit';
import crypto from 'crypto';
import { db } from '$lib/server/db/index';
import { events, eventsKeys } from '$lib/server/db/schema';
import { encryptJson } from '$lib/server/crypto';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body: unknown = await request.json();
	const { title, description, date, location, capacity } = (body ?? {}) as Record<string, unknown>;

	if (typeof title !== 'string' || !title.trim()) {
		return json({ error: 'Title is required' }, { status: 400 });
	}

	if (
		(description !== undefined && typeof description !== 'string') ||
		(date !== undefined && typeof date !== 'string') ||
		(location !== undefined && typeof location !== 'string')
	) {
		return json({ error: 'Invalid fields' }, { status: 400 });
	}

	if (capacity !== undefined && typeof capacity !== 'number') {
		return json({ error: 'Invalid capacity' }, { status: 400 });
	}

	const { ciphertext, nonce } = encryptJson({
		title: title.trim(),
		description: description ?? '',
		date: date ?? '',
		location: location ?? ''
	});

	const eventId = crypto.randomUUID();

	await db.batch([
		db.insert(events).values({ id: eventId, creatorId: locals.user.id, ciphertext, nonce, capacity: capacity ?? null }),
		db.insert(eventsKeys).values({
			eventId,
			userId: locals.user.id,
			role: 'owner'
		})
	]);

	return json({ id: eventId });
};
