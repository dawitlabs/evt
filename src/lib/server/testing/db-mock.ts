import { vi } from 'vitest';

/**
 * Fakes the chainable drizzle `db` builder. Each top-level statement
 * (`db.select(...)...`, `db.insert(...)...`, `db.update(...)...`) resolves
 * to the next value passed to `setResults`, in call order — regardless of
 * how many `.from()/.where()/.limit()` links are chained before the `await`.
 */
export function createDbMock() {
	let results: unknown[] = [];
	let cursor = 0;

	const db: unknown = new Proxy(
		{},
		{
			get(_target, prop) {
				if (prop === 'then') {
					const value = results[cursor++];
					return (resolve: (value: unknown) => void) => resolve(value);
				}
				return vi.fn(() => db);
			}
		}
	);

	return {
		db,
		setResults(next: unknown[]) {
			results = next;
			cursor = 0;
		}
	};
}
