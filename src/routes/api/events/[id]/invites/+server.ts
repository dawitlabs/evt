import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { users, eventsKeys, pendingInvites } from '$lib/server/db/schema';
import { ilike } from 'drizzle-orm';
import { getEventMembership, isManager } from '$lib/server/events/authz';
import { normalizeTelegramUsername } from '$lib/server/events/username';
import { sendTelegramMessage } from '$lib/server/telegram/bot';
import type { RequestHandler } from './$types';

function isUniqueViolation(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false;
	const code = (error as { code?: unknown; cause?: { code?: unknown } }).code
		?? (error as { cause?: { code?: unknown } }).cause?.code;
	return code === '23505';
}

export const POST: RequestHandler = async ({ params, request, locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const eventId = params.id!;
	const membership = await getEventMembership(eventId, locals.user.id);
	if (!membership || !isManager(membership.role)) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body: unknown = await request.json();
	const { telegramUsername, role } = (body ?? {}) as Record<string, unknown>;

	if (typeof telegramUsername !== 'string' || (role !== 'coorganizer' && role !== 'attendee')) {
		return json({ error: 'Missing fields' }, { status: 400 });
	}

	const normalized = normalizeTelegramUsername(telegramUsername);

	const [target] = await db
		.select({ id: users.id, telegramId: users.telegramId })
		.from(users)
		.where(ilike(users.username, normalized))
		.limit(1);

	try {
		if (target) {
			await db.insert(eventsKeys).values({
				eventId,
				userId: target.id,
				role,
				invitedBy: locals.user.id
			});

			await sendTelegramMessage(target.telegramId, `You've been added to an event: ${url.origin}/events/${eventId}`);

			return json({ status: 'added' });
		}

		await db.insert(pendingInvites).values({
			eventId,
			telegramUsername: normalized,
			role,
			invitedBy: locals.user.id
		});

		return json({ status: 'pending' });
	} catch (error) {
		if (isUniqueViolation(error)) {
			return json({ error: target ? 'Already a member' : 'Already invited' }, { status: 409 });
		}
		throw error;
	}
};
