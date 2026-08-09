import crypto from 'crypto';
import { db } from '$lib/server/db/index';
import { users, sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

interface TelegramIdentity {
	telegramId: string;
	username?: string | null;
	firstName?: string | null;
	photoUrl?: string | null;
}

export async function upsertTelegramUser(identity: TelegramIdentity) {
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

	return created;
}

export async function createSession(userId: string) {
	const token = crypto.randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

	await db.insert(sessions).values({ token, userId, expiresAt });

	return { token, expiresAt };
}
