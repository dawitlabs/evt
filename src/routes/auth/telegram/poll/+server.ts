import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { telegramLoginTokens } from '$lib/server/db/schema';
import { upsertTelegramUser, createSession } from '$lib/server/auth/telegram';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const token = url.searchParams.get('token');
	if (!token) throw error(400, 'missing token');

	const [row] = await db
		.select()
		.from(telegramLoginTokens)
		.where(eq(telegramLoginTokens.token, token))
		.limit(1);

	if (!row || row.expiresAt < new Date()) return json({ status: 'expired' });
	if (row.status === 'pending' || !row.telegramId) return json({ status: 'pending' });

	const user = await upsertTelegramUser(
		{
			telegramId: row.telegramId,
			username: row.username,
			firstName: row.firstName
		},
		url.origin
	);

	const { token: sessionToken, expiresAt } = await createSession(user.id);

	cookies.set('session', sessionToken, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		expires: expiresAt
	});

	await db.delete(telegramLoginTokens).where(eq(telegramLoginTokens.token, token));

	const next = cookies.get('next');
	if (next) cookies.delete('next', { path: '/' });
	const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

	return json({ status: 'verified', redirect: safeNext });
};
