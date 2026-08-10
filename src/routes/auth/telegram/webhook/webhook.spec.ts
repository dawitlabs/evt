import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';

vi.mock('$env/static/private', () => ({
	TELEGRAM_BOT_TOKEN: 'test-token',
	TELEGRAM_WEBHOOK_SECRET: 'test-secret'
}));

vi.mock('$lib/server/db/index', () => ({
	db: new Proxy({}, { get: () => () => Promise.resolve([]) })
}));

const { POST } = await import('./+server');
const { bot } = await import('$lib/server/telegram/bot');

// grammy's webhookCallback calls bot.init() on its first invocation
// regardless of the secret token outcome. Pre-seed botInfo so that doesn't
// make a real getMe() network call in tests — only the fields our code
// actually reads matter here, not Telegram's full (and evolving) User shape.
bot.botInfo = {
	id: 1,
	is_bot: true,
	first_name: 'TestBot',
	username: 'test_bot',
	can_join_groups: true,
	can_read_all_group_messages: false,
	supports_inline_queries: false
} as typeof bot.botInfo;

function makeEvent(secret: string) {
	return {
		request: new Request('https://evt.example.com/auth/telegram/webhook', {
			method: 'POST',
			headers: { 'x-telegram-bot-api-secret-token': secret },
			body: JSON.stringify({})
		})
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /auth/telegram/webhook', () => {
	it('rejects requests without the correct webhook secret before touching Telegram', async () => {
		const res = await POST(makeEvent('wrong-secret'));

		expect(res.status).toBe(401);
	});
});
