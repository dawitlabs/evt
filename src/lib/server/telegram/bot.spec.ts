import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '$lib/server/testing/db-mock';

vi.mock('$env/static/private', () => ({ TELEGRAM_BOT_TOKEN: 'test-token' }));

const dbMock = createDbMock();
vi.mock('$lib/server/db/index', () => ({ db: dbMock.db }));

const { bot, sendTelegramMessage, handleStartCommand } = await import('./bot');

describe('sendTelegramMessage', () => {
	it('calls bot.api.sendMessage with the chat id and text', async () => {
		const sendMessage = vi.spyOn(bot.api, 'sendMessage').mockResolvedValue({} as never);

		await sendTelegramMessage('12345', 'hello there');

		expect(sendMessage).toHaveBeenCalledWith('12345', 'hello there');
	});

	it('does not throw when the Telegram API call fails', async () => {
		vi.spyOn(bot.api, 'sendMessage').mockRejectedValue(new Error('down'));

		await expect(sendTelegramMessage('12345', 'hello there')).resolves.toBeUndefined();
	});
});

describe('handleStartCommand', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns a welcome message when there is no login token payload', async () => {
		const reply = await handleStartCommand(undefined, { id: 555 });
		expect(reply).toContain('Welcome to Evt');
	});

	it('returns a welcome message when the sender is unknown', async () => {
		const reply = await handleStartCommand('abc123', undefined);
		expect(reply).toContain('Welcome to Evt');
	});

	it('rejects a token that does not exist', async () => {
		dbMock.setResults([[]]); // no matching login token

		const reply = await handleStartCommand('abc123', { id: 555 });

		expect(reply).toBe('This login link is invalid or expired.');
	});

	it('rejects a token that has already been verified', async () => {
		dbMock.setResults([[{ token: 'abc123', status: 'verified', expiresAt: new Date(Date.now() + 60_000) }]]);

		const reply = await handleStartCommand('abc123', { id: 555 });

		expect(reply).toBe('This login link is invalid or expired.');
	});

	it('rejects an expired token', async () => {
		dbMock.setResults([[{ token: 'abc123', status: 'pending', expiresAt: new Date(Date.now() - 1000) }]]);

		const reply = await handleStartCommand('abc123', { id: 555 });

		expect(reply).toBe('This login link is invalid or expired.');
	});

	it('verifies a pending, unexpired token and confirms in the reply', async () => {
		dbMock.setResults([
			[{ token: 'abc123', status: 'pending', expiresAt: new Date(Date.now() + 60_000) }], // lookup
			undefined // update -> verified
		]);

		const reply = await handleStartCommand('abc123', { id: 555, username: 'bob', first_name: 'Bob' });

		expect(reply).toBe('Verified — you can return to the app.');
	});
});
