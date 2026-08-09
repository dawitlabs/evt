import sodium from 'libsodium-wrappers-sumo';

export async function ready(): Promise<typeof sodium> {
	await sodium.ready;
	return sodium;
}
