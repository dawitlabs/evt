import { redirect } from '@sveltejs/kit';
import crypto from 'crypto';
import { upsertTelegramUser, createSession } from '$lib/server/auth/telegram';
import { TELEGRAM_BOT_TOKEN } from '$env/static/private';
import type { RequestHandler } from './$types';

function verifyTelegramAuth(data: Record<string, string>, botToken: string): boolean {
	const { hash, ...fields } = data;
	const secret = crypto.createHash('sha256').update(botToken).digest();
	const checkString = Object.keys(fields)
		.sort()
		.map((key) => `${key}=${fields[key]}`)
		.join('\n');
	const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
	return hmac === hash;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const data = Object.fromEntries(url.searchParams);

	if (!verifyTelegramAuth(data, TELEGRAM_BOT_TOKEN)) {
		throw redirect(303, '/login?error=invalid_auth');
	}

	if (Date.now() / 1000 - Number(data.auth_date) > 86400) {
		throw redirect(303, '/login?error=expired');
	}

	const user = await upsertTelegramUser({
		telegramId: data.id,
		username: data.username,
		firstName: data.first_name,
		photoUrl: data.photo_url
	});

	const { token, expiresAt } = await createSession(user.id);

	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		expires: expiresAt
	});

	throw redirect(303, user.publicKey ? '/dashboard' : '/setup-keys');
};
