import { TELEGRAM_BOT_TOKEN } from '$env/static/private';

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
	try {
		const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ chat_id: chatId, text })
		});

		if (!res.ok) {
			console.error('Telegram sendMessage failed', await res.text());
		}
	} catch (err) {
		console.error('Telegram sendMessage failed', err);
	}
}
