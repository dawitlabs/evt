import { db } from '$lib/server/db/index';
import { pendingInvites } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export interface PendingInvite {
	id: string;
	telegramUsername: string;
	role: string;
	createdAt: Date;
}

export async function listPendingInvites(eventId: string): Promise<PendingInvite[]> {
	return db
		.select({
			id: pendingInvites.id,
			telegramUsername: pendingInvites.telegramUsername,
			role: pendingInvites.role,
			createdAt: pendingInvites.createdAt
		})
		.from(pendingInvites)
		.where(eq(pendingInvites.eventId, eventId));
}
