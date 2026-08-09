import { ready } from './sodium.ts';

export interface GeneratedKeypair {
	publicKey: string;
	encryptedPrivateKey: string;
	salt: string;
	nonce: string;
}

export interface EncryptedKeyMaterial {
	encryptedPrivateKey: string;
	salt: string;
	nonce: string;
}

export async function generateKeypair(passphrase: string): Promise<GeneratedKeypair> {
	const sodium = await ready();

	const keypair = sodium.crypto_box_keypair();
	const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
	const derivedKey = sodium.crypto_pwhash(
		sodium.crypto_secretbox_KEYBYTES,
		passphrase,
		salt,
		sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_ALG_ARGON2ID13
	);

	const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
	const encryptedPrivateKey = sodium.crypto_secretbox_easy(keypair.privateKey, nonce, derivedKey);

	return {
		publicKey: sodium.to_base64(keypair.publicKey),
		encryptedPrivateKey: sodium.to_base64(encryptedPrivateKey),
		salt: sodium.to_base64(salt),
		nonce: sodium.to_base64(nonce)
	};
}

export async function unlockPrivateKey(
	passphrase: string,
	material: EncryptedKeyMaterial
): Promise<Uint8Array> {
	const sodium = await ready();

	const salt = sodium.from_base64(material.salt);
	const derivedKey = sodium.crypto_pwhash(
		sodium.crypto_secretbox_KEYBYTES,
		passphrase,
		salt,
		sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_ALG_ARGON2ID13
	);

	return sodium.crypto_secretbox_open_easy(
		sodium.from_base64(material.encryptedPrivateKey),
		sodium.from_base64(material.nonce),
		derivedKey
	);
}
