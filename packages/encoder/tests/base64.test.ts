import { describe, expect, test } from 'vitest';
import { createBase64Driver } from '#src/drivers/base64.js';

describe('Encoder::BASE64', () => {
	const driver = createBase64Driver();
	const textEncoder = new TextEncoder();
	const textDecoder = new TextDecoder();

	test('should return expected methods', () => {
		expect(driver).toHaveProperty('encode');
		expect(driver).toHaveProperty('decode');
	});

	test('should encode a string', async () => {
		const encoded = driver.encode({
			data: textEncoder.encode('hello world of base64'),
		});

		expect(encoded).toBe('aGVsbG8gd29ybGQgb2YgYmFzZTY0');
	});

	test('should encode a string without padding', async () => {
		const encoded = driver.encode({
			data: textEncoder.encode('hello world'),
			options: { includePadding: false },
		});

		expect(encoded).toBe('aGVsbG8gd29ybGQ');
	});

	test('should encode a string with special characters', () => {
		const encoded = driver.encode({
			data: textEncoder.encode('!@#$%^&*()'),
		});

		expect(encoded).toBe('IUAjJCVeJiooKQ==');
	});

	test('should decode a string', async () => {
		const encoded = driver.decode({
			data: 'aGVsbG8gd29ybGQgb2YgYmFzZTY0',
		});

		expect(textDecoder.decode(encoded)).toBe('hello world of base64');
	});

	test('should decode a string with special characters', async () => {
		const encoded = driver.decode({
			data: 'IUAjJCVeJiooKQ==',
		});

		expect(textDecoder.decode(encoded)).toBe('!@#$%^&*()');
	});

	test('should throw on invalid char', async () => {
		expect(() =>
			driver.decode({
				data: 'aGVsbG8gd29ybGQgb2YgYmFzZTY@',
			}),
		).toThrowError('Invalid character in Base64 string');
	});
});
