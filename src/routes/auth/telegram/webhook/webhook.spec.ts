import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDbMock } from '$lib/server/testing/db-mock';

const sendTelegramMessage = vi.fn();
vi.mock('$lib/server/telegram/bot', () => ({ sendTelegramMessage }));

vi.mock('$env/static/private', () => ({ TELEGRAM_WEBHOOK_SECRET: 'test-secret' }));

const dbMock = createDbMock();
vi.mock('$lib/server/db/index', () => ({ db: dbMock.db }));

const { POST } = await import('./+server');

function makeEvent(update: unknown, secret = 'test-secret') {
	// Route handlers only read request headers/body — a full RequestEvent isn't needed for this seam.
	return {
		request: {
			headers: new Headers({ 'x-telegram-bot-api-secret-token': secret }),
			json: () => Promise.resolve(update)
		}
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /auth/telegram/webhook', () => {
	beforeEach(() => {
		sendTelegramMessage.mockReset();
	});

	it('replies through the shared helper once a login token is verified', async () => {
		dbMock.setResults([
			[{ token: 'abc123', status: 'pending', expiresAt: new Date(Date.now() + 60_000) }],
			undefined // update telegramLoginTokens -> verified
		]);

		await POST(
			makeEvent({ message: { text: '/start abc123', from: { id: 555, username: 'bob' } } })
		);

		expect(sendTelegramMessage).toHaveBeenCalledWith('555', 'Verified — you can return to the app.');
	});

	it('replies through the shared helper when the login token is invalid or expired', async () => {
		dbMock.setResults([[]]); // no matching token

		await POST(
			makeEvent({ message: { text: '/start doesnotexist', from: { id: 555, username: 'bob' } } })
		);

		expect(sendTelegramMessage).toHaveBeenCalledWith(
			'555',
			'This login link is invalid or expired.'
		);
	});

	it('rejects requests without the correct webhook secret before touching Telegram', async () => {
		let caught: unknown;
		try {
			await POST(
				makeEvent({ message: { text: '/start abc123', from: { id: 555 } } }, 'wrong-secret')
			);
		} catch (err) {
			caught = err;
		}

		expect(sendTelegramMessage).not.toHaveBeenCalled();
		expect(caught).toMatchObject({ status: 401 });
	});
});
