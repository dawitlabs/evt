import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { users, pendingInvites } from '$lib/server/db/schema';
import { eq, ilike } from 'drizzle-orm';
import { normalizeTelegramUsername } from '$lib/server/events/username';
import { sendTelegramMessage } from '$lib/server/telegram/bot';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body: unknown = await request.json();
	const { publicKey, encryptedPrivateKey, salt, nonce } = (body ?? {}) as Record<string, unknown>;

	if (
		typeof publicKey !== 'string' ||
		typeof encryptedPrivateKey !== 'string' ||
		typeof salt !== 'string' ||
		typeof nonce !== 'string'
	) {
		return json({ error: 'Missing fields' }, { status: 400 });
	}

	await db
		.update(users)
		.set({
			publicKey,
			encryptedPrivateKey,
			privateKeySalt: salt,
			privateKeyNonce: nonce
		})
		.where(eq(users.id, locals.user.id));

	if (locals.user.username) {
		const normalized = normalizeTelegramUsername(locals.user.username);
		const matches = await db
			.select({ eventId: pendingInvites.eventId, invitedBy: pendingInvites.invitedBy })
			.from(pendingInvites)
			.where(ilike(pendingInvites.telegramUsername, normalized));

		await Promise.all(
			matches.map(async (invite) => {
				const [inviter] = await db
					.select({ telegramId: users.telegramId })
					.from(users)
					.where(eq(users.id, invite.invitedBy))
					.limit(1);

				if (inviter) {
					await sendTelegramMessage(
						inviter.telegramId,
						`Someone you invited just signed up — you can grant them access: ${url.origin}/events/${invite.eventId}`
					);
				}
			})
		);
	}

	return json({ success: true });
};
