import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: { EVENT_DATA_KEY: Buffer.alloc(32, 7).toString('base64') }
}));

const { encryptJson, decryptJson } = await import('./crypto');

describe('crypto', () => {
	it('round-trips json', () => {
		const data = { title: 'Birthday', notes: 'ጤና ይስጥልኝ' };
		expect(decryptJson(encryptJson(data))).toEqual(data);
	});

	it('fails on tampered ciphertext', () => {
		const blob = encryptJson({ title: 'x' });
		const bytes = Buffer.from(blob.ciphertext, 'base64');
		bytes[0] ^= 0xff;
		expect(() => decryptJson({ ...blob, ciphertext: bytes.toString('base64') })).toThrow();
	});
});
