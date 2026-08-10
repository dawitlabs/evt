import { webhookCallback } from 'grammy';
import { bot } from '$lib/server/telegram/bot';
import { TELEGRAM_WEBHOOK_SECRET } from '$env/static/private';
import type { RequestHandler } from './$types';

// grammy's 'sveltekit' adapter types its return as Promise<unknown> even
// though it resolves a real Response at runtime — a gap in grammy's own types.
export const POST: RequestHandler = webhookCallback(bot, 'sveltekit', {
	secretToken: TELEGRAM_WEBHOOK_SECRET
}) as RequestHandler;
