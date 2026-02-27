import type { HasherDriver } from '../types.js';

const { crypto } = globalThis;

export function createScryptDriver(config?: {
	iterations?: number;
	saltLength?: number;
}): HasherDriver {
	const iterations = config?.iterations ?? 100_000;
	const hash = 'SHA-256';
	const saltLength = config?.saltLength ?? 16;

	const generateSalt = (): string => {
		const saltBytes = crypto.getRandomValues(new Uint8Array(saltLength));
		return Array.from(saltBytes)
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('');
	};

	const deriveKey = async ({
		content,
		salt,
	}: {
		content: string;
		salt: string;
	}): Promise<string> => {
		const keyMaterial = await crypto.subtle.importKey(
			'raw',
			new TextEncoder().encode(content.normalize('NFKC')),
			{ name: 'PBKDF2' },
			false,
			['deriveBits'],
		);

		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: 'PBKDF2',
				salt: new TextEncoder().encode(salt),
				iterations,
				hash,
			},
			keyMaterial,
			256,
		);

		return Array.from(new Uint8Array(derivedBits))
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('');
	};

	return {
		async hash({ content }: { content: string }): Promise<string> {
			const salt = generateSalt();
			const derivedKey = await deriveKey({ content, salt });
			return `${salt}:${derivedKey}`;
		},
		async verify({
			content,
			hash: storedHash,
		}: {
			content: string;
			hash: string;
		}): Promise<boolean> {
			const [salt, storedKey] = storedHash.split(':');

			if (!salt || !storedKey) {
				return false;
			}

			const derivedKey = await deriveKey({ content, salt });
			return derivedKey === storedKey;
		},
	};
}
