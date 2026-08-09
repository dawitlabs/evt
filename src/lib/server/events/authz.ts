import { db } from '$lib/server/db/index';
import { eventsKeys } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

export async function getEventMembership(
	eventId: string,
	userId: string
): Promise<{ role: string } | null> {
	const [row] = await db
		.select({ role: eventsKeys.role })
		.from(eventsKeys)
		.where(and(eq(eventsKeys.eventId, eventId), eq(eventsKeys.userId, userId)))
		.limit(1);

	return row ?? null;
}

export function isManager(role: string): boolean {
	return role === 'owner' || role === 'coorganizer';
}
