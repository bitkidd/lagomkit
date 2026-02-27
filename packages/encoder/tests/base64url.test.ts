import { describe, expect, test } from 'vitest';

import { createBase64UrlDriver } from '#src/drivers/base64url.js';

describe('Encoder::BASE64URL', () => {
	const driver = createBase64UrlDriver();
	const textEncoder = new TextEncoder();
	const textDecoder = new TextDecoder();

	test('should return expected methods', () => {
		expect(driver).toHaveProperty('encode');
		expect(driver).toHaveProperty('decode');
	});

	test('should encode without padding by default', () => {
		const encoded = driver.encode({ data: textEncoder.encode('hello world') });

		expect(encoded).toBe('aGVsbG8gd29ybGQ');
	});

	test('should encode with URL-safe alphabet', () => {
		const encoded = driver.encode({ data: new Uint8Array([251, 255, 255]) });

		expect(encoded).toBe('-___');
	});

	test('should encode with optional padding', () => {
		const encoded = driver.encode({
			data: new Uint8Array([251]),
			options: { includePadding: true },
		});

		expect(encoded).toBe('-w==');
	});

	test('should decode without padding', () => {
		const decoded = driver.decode({ data: 'aGVsbG8gd29ybGQ' });

		expect(textDecoder.decode(decoded)).toBe('hello world');
	});

	test('should decode with padding', () => {
		const decoded = driver.decode({ data: '-w==' });

		expect(decoded).toEqual(new Uint8Array([251]));
	});

	test('should throw on invalid char', () => {
		expect(() => driver.decode({ data: 'aGVsbG8@' })).toThrowError(
			'Invalid character in Base64 string',
		);
	});
});
