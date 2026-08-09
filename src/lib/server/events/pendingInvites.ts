import { db } from '$lib/server/db/index';
import { users, pendingInvites } from '$lib/server/db/schema';
import { eq, ilike } from 'drizzle-orm';

export interface ResolvablePendingInvite {
	id: string;
	telegramUsername: string;
	role: string;
	createdAt: Date;
	resolvable: boolean;
	resolvablePublicKey: string | null;
}

export async function listResolvablePendingInvites(eventId: string): Promise<ResolvablePendingInvite[]> {
	const pending = await db.select().from(pendingInvites).where(eq(pendingInvites.eventId, eventId));

	return Promise.all(
		pending.map(async (invite) => {
			const [user] = await db
				.select({ publicKey: users.publicKey })
				.from(users)
				.where(ilike(users.username, invite.telegramUsername))
				.limit(1);

			return {
				id: invite.id,
				telegramUsername: invite.telegramUsername,
				role: invite.role,
				createdAt: invite.createdAt,
				resolvable: Boolean(user?.publicKey),
				resolvablePublicKey: user?.publicKey ?? null
			};
		})
	);
}
