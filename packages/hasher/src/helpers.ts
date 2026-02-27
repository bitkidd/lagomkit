const { crypto } = globalThis;

const encoder = new TextEncoder();

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
	if (a.length !== b.length) {
		return false;
	}

	const key = await crypto.subtle.generateKey(
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	);

	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(a));

	return crypto.subtle.verify('HMAC', key, signature, encoder.encode(b));
}
