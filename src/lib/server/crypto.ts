import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';

export interface EncryptedBlob {
	ciphertext: string;
	nonce: string;
}

let masterKey: Buffer | null = null;

function getKey(): Buffer {
	if (masterKey) return masterKey;
	if (!env.EVENT_DATA_KEY) throw new Error('EVENT_DATA_KEY is not set');
	const key = Buffer.from(env.EVENT_DATA_KEY, 'base64');
	if (key.length !== 32) throw new Error('EVENT_DATA_KEY must be 32 bytes base64');
	masterKey = key;
	return key;
}

// ponytail: single master key; per-event DEKs only if key rotation ever becomes a requirement
export function encryptJson(data: unknown): EncryptedBlob {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
	const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
	return {
		ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64'),
		nonce: iv.toString('base64')
	};
}

export function decryptJson<T>(blob: EncryptedBlob): T {
	const data = Buffer.from(blob.ciphertext, 'base64');
	const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(blob.nonce, 'base64'));
	decipher.setAuthTag(data.subarray(data.length - 16));
	const plaintext = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]);
	return JSON.parse(plaintext.toString('utf8')) as T;
}
