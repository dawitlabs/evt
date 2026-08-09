import { ready } from './sodium.ts';

export interface EncryptedPayload {
	ciphertext: string;
	nonce: string;
}

export async function generateEventKey(): Promise<Uint8Array> {
	const sodium = await ready();
	return sodium.crypto_secretbox_keygen();
}

export async function encryptEventData(data: unknown, eventKey: Uint8Array): Promise<EncryptedPayload> {
	const sodium = await ready();

	const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
	const plaintext = sodium.from_string(JSON.stringify(data));
	const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, eventKey);

	return {
		ciphertext: sodium.to_base64(ciphertext),
		nonce: sodium.to_base64(nonce)
	};
}

export async function decryptEventData<T>(payload: EncryptedPayload, eventKey: Uint8Array): Promise<T> {
	const sodium = await ready();

	const plaintext = sodium.crypto_secretbox_open_easy(
		sodium.from_base64(payload.ciphertext),
		sodium.from_base64(payload.nonce),
		eventKey
	);

	return JSON.parse(sodium.to_string(plaintext)) as T;
}

export async function sealEventKeyFor(eventKey: Uint8Array, recipientPublicKeyB64: string): Promise<string> {
	const sodium = await ready();

	const wrapped = sodium.crypto_box_seal(eventKey, sodium.from_base64(recipientPublicKeyB64));
	return sodium.to_base64(wrapped);
}

export async function unsealEventKey(
	wrappedKeyB64: string,
	recipientPublicKeyB64: string,
	recipientPrivateKey: Uint8Array
): Promise<Uint8Array> {
	const sodium = await ready();

	return sodium.crypto_box_seal_open(
		sodium.from_base64(wrappedKeyB64),
		sodium.from_base64(recipientPublicKeyB64),
		recipientPrivateKey
	);
}
