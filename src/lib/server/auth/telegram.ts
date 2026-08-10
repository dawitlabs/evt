import crypto from 'crypto';
import { db } from '$lib/server/db/index';
import { users, sessions, eventsKeys, pendingInvites } from '$lib/server/db/schema';
import { eq, ilike } from 'drizzle-orm';
import { normalizeTelegramUsername } from '$lib/server/events/username';
import { sendTelegramMessage } from '$lib/server/telegram/bot';

interface TelegramIdentity {
	telegramId: string;
	username?: string | null;
	firstName?: string | null;
	photoUrl?: string | null;
}

async function resolvePendingInvites(userId: string, telegramId: string, username: string, origin: string) {
	const normalized = normalizeTelegramUsername(username);
	const matches = await db.select().from(pendingInvites).where(ilike(pendingInvites.telegramUsername, normalized));
	if (matches.length === 0) return;

	await Promise.all(
		matches.map(async (invite) => {
			await db
				.insert(eventsKeys)
				.values({ eventId: invite.eventId, userId, role: invite.role, invitedBy: invite.invitedBy })
				.onConflictDoNothing({ target: [eventsKeys.eventId, eventsKeys.userId] });
			await db.delete(pendingInvites).where(eq(pendingInvites.id, invite.id));
			await sendTelegramMessage(telegramId, `You've been added to an event: ${origin}/events/${invite.eventId}`);
		})
	);
}

export async function upsertTelegramUser(identity: TelegramIdentity, origin: string) {
	const [existing] = await db
		.select()
		.from(users)
		.where(eq(users.telegramId, identity.telegramId))
		.limit(1);

	if (existing) return existing;

	const [created] = await db
		.insert(users)
		.values({
			telegramId: identity.telegramId,
			username: identity.username ?? null,
			firstName: identity.firstName ?? null,
			photoUrl: identity.photoUrl ?? null
		})
		.returning();

	if (identity.username) {
		await resolvePendingInvites(created.id, identity.telegramId, identity.username, origin);
	}

	return created;
}

export async function createSession(userId: string) {
	const token = crypto.randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

	await db.insert(sessions).values({ token, userId, expiresAt });

	return { token, expiresAt };
}
