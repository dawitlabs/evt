import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/static/private', () => ({ TELEGRAM_BOT_TOKEN: 'test-token' }));

import { sendTelegramMessage } from './bot';

describe('sendTelegramMessage', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('posts the chat id and text to the Telegram API', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
		vi.stubGlobal('fetch', fetchMock);

		await sendTelegramMessage('12345', 'hello there');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.telegram.org/bottest-token/sendMessage',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ chat_id: '12345', text: 'hello there' })
			})
		);
	});

	it('does not throw when the Telegram API responds with an error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve('bad request') })
		);

		await expect(sendTelegramMessage('12345', 'hello there')).resolves.toBeUndefined();
	});

	it('does not throw when the network request itself fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

		await expect(sendTelegramMessage('12345', 'hello there')).resolves.toBeUndefined();
	});
});
