import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index';
import { telegramLoginTokens } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { TELEGRAM_WEBHOOK_SECRET } from '$env/static/private';
import { sendTelegramMessage } from '$lib/server/telegram/bot';
import type { RequestHandler } from './$types';

interface TelegramUpdate {
	message?: {
		text?: string;
		from?: { id: number; username?: string; first_name?: string };
	};
}

export const POST: RequestHandler = async ({ request }) => {
	if (request.headers.get('x-telegram-bot-api-secret-token') !== TELEGRAM_WEBHOOK_SECRET) {
		throw error(401, 'invalid secret token');
	}

	const update: TelegramUpdate = await request.json();
	const text = update.message?.text ?? '';
	const from = update.message?.from;
	const match = text.match(/^\/start (\w+)$/);

	if (!match || !from) return json({ ok: true });

	const [token] = await db
		.select()
		.from(telegramLoginTokens)
		.where(eq(telegramLoginTokens.token, match[1]))
		.limit(1);

	if (!token || token.status === 'verified' || token.expiresAt < new Date()) {
		await sendTelegramMessage(String(from.id), 'This login link is invalid or expired.');
		return json({ ok: true });
	}

	await db
		.update(telegramLoginTokens)
		.set({
			status: 'verified',
			telegramId: String(from.id),
			username: from.username ?? null,
			firstName: from.first_name ?? null
		})
		.where(eq(telegramLoginTokens.token, match[1]));

	await sendTelegramMessage(String(from.id), 'Verified — you can return to the app.');

	return json({ ok: true });
};
