export function normalizeTelegramUsername(username: string): string {
	return username.trim().replace(/^@/, '').toLowerCase();
}
