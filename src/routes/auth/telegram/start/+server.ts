import { json } from '@sveltejs/kit';
import crypto from 'crypto';
import { db } from '$lib/server/db/index';
import { telegramLoginTokens } from '$lib/server/db/schema';
import { TELEGRAM_BOT_USERNAME } from '$env/static/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	const token = crypto.randomBytes(16).toString('hex');
	const expiresAt = new Date(Date.now() + 1000 * 60 * 5);

	await db.insert(telegramLoginTokens).values({ token, expiresAt });

	return json({
		token,
		link: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`
	});
};
