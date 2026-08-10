import { Bot } from 'grammy';
import { db } from '$lib/server/db/index';
import { telegramLoginTokens } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { TELEGRAM_BOT_TOKEN } from '$env/static/private';

export const bot = new Bot(TELEGRAM_BOT_TOKEN);

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
	try {
		await bot.api.sendMessage(chatId, text);
	} catch (err) {
		console.error('Telegram sendMessage failed', err);
	}
}

interface TelegramFrom {
	id: number;
	username?: string;
	first_name?: string;
}

export async function handleStartCommand(
	payload: string | undefined,
	from: TelegramFrom | undefined
): Promise<string> {
	const token = payload?.trim();

	if (!token || !from) {
		return 'Welcome to Evt! Open the app and log in with Telegram to get started.';
	}

	const [loginToken] = await db
		.select()
		.from(telegramLoginTokens)
		.where(eq(telegramLoginTokens.token, token))
		.limit(1);

	if (!loginToken || loginToken.status === 'verified' || loginToken.expiresAt < new Date()) {
		return 'This login link is invalid or expired.';
	}

	await db
		.update(telegramLoginTokens)
		.set({
			status: 'verified',
			telegramId: String(from.id),
			username: from.username ?? null,
			firstName: from.first_name ?? null
		})
		.where(eq(telegramLoginTokens.token, token));

	return 'Verified — you can return to the app.';
}

bot.command('start', async (ctx) => {
	const reply = await handleStartCommand(ctx.match, ctx.from);
	await ctx.reply(reply);
});
