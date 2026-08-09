import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { db } from '$lib/server/db/index';
import { sessions, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const handleAuth: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('session');
	event.locals.user = null;

	if (token) {
		const [row] = await db
			.select({
				id: users.id,
				telegramId: users.telegramId,
				username: users.username,
				firstName: users.firstName,
				photoUrl: users.photoUrl,
				publicKey: users.publicKey,
				expiresAt: sessions.expiresAt
			})
			.from(sessions)
			.innerJoin(users, eq(sessions.userId, users.id))
			.where(eq(sessions.token, token))
			.limit(1);

		if (row && row.expiresAt > new Date()) {
			const { expiresAt: _expiresAt, ...user } = row;
			event.locals.user = user;
		} else {
			event.cookies.delete('session', { path: '/' });
		}
	}

	return resolve(event);
};

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

export const handle: Handle = sequence(handleAuth, handleParaglide);
