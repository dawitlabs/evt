import { db } from '$lib/server/db/index';
import { events, eventsKeys } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { decryptJson } from '$lib/server/crypto';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const rows = await db
		.select({
			eventId: events.id,
			role: eventsKeys.role,
			ciphertext: events.ciphertext,
			nonce: events.nonce,
			createdAt: events.createdAt
		})
		.from(eventsKeys)
		.innerJoin(events, eq(eventsKeys.eventId, events.id))
		.where(eq(eventsKeys.userId, locals.user!.id));

	return {
		events: rows.map((row) => {
			const details = decryptJson<{ title: string }>(row);
			return { eventId: row.eventId, title: details.title, role: row.role, createdAt: row.createdAt };
		})
	};
};
