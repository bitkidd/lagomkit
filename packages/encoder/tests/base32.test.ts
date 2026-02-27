import { describe, expect, test } from 'vitest';
import { createBase32Driver } from '#src/drivers/base32.js';

describe('Encoder::BASE32', () => {
	const driver = createBase32Driver();
	const textEncoder = new TextEncoder();
	const textDecoder = new TextDecoder();

	test('should return expected methods', () => {
		expect(driver).toHaveProperty('encode');
		expect(driver).toHaveProperty('decode');
	});

	test('should encode a string', async () => {
		const encoded = driver.encode({
			data: textEncoder.encode('hello world of base32'),
		});

		expect(encoded).toBe('NBSWY3DPEB3W64TMMQQG6ZRAMJQXGZJTGI======');
	});

	test('should encode a string without padding', async () => {
		const encoded = driver.encode({
			data: textEncoder.encode('hello world of base32'),
			options: { includePadding: false },
		});

		expect(encoded).toBe('NBSWY3DPEB3W64TMMQQG6ZRAMJQXGZJTGI');
	});

	test('should encode a string with special characters', () => {
		const encoded = driver.encode({
			data: textEncoder.encode('!@#$%^&*()'),
		});

		expect(encoded).toBe('EFACGJBFLYTCUKBJ');
	});

	test('should decode a string', async () => {
		const encoded = driver.decode({
			data: 'NBSWY3DPEB3W64TMMQQG6ZRAMJQXGZJTGI======',
		});

		expect(textDecoder.decode(encoded)).toBe('hello world of base32');
	});

	test('should decode a string with special characters', async () => {
		const encoded = driver.decode({
			data: 'EFACGJBFLYTCUKBJ',
		});

		expect(textDecoder.decode(encoded)).toBe('!@#$%^&*()');
	});

	test('should throw on invalid char', async () => {
		expect(() =>
			driver.decode({
				data: 'EFACGJBFLYTCUKBJ@',
			}),
		).toThrowError('Invalid character in Base32 string');
	});
});
