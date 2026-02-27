import { describe, expect, test } from 'vitest';
import { createHexDriver } from '#src/drivers/hex.js';

describe('Encoder::HEX', () => {
	const driver = createHexDriver();
	const textEncoder = new TextEncoder();
	const textDecoder = new TextDecoder('utf-8');

	test('should return expected methods', () => {
		expect(driver).toHaveProperty('encode');
		expect(driver).toHaveProperty('decode');
	});

	test('should encode data correctly', () => {
		const data = textEncoder.encode('hello world');
		const encoded = driver.encode({ data });
		expect(encoded).toBe('68656C6C6F20776F726C64');
	});

	test('should decode data correctly', () => {
		const decoded = driver.decode({ data: '68656C6C6F20776F726C64' });
		const data = textDecoder.decode(decoded);
		expect(data).toEqual('hello world');
	});

	test('should throw an error on invalid character during decoding', () => {
		const invalidEncoded = '68656C6C6F20776F726C6G';
		expect(() => driver.decode({ data: invalidEncoded })).toThrow(
			'Invalid character in input: 6G',
		);
	});

	test('should throw an error on incomplete byte during decoding', () => {
		const incompleteEncoded = '00FF108'; // Missing one byte
		expect(() => driver.decode({ data: incompleteEncoded })).toThrow(
			'Invalid data length',
		);
	});

	test('should handle an empty string correctly', () => {
		const emptyEncoded = '';
		const emptyDecoded = new Uint8Array([]);
		const decoded = driver.decode({ data: emptyEncoded });
		expect(decoded).toEqual(emptyDecoded);
	});

	test('should handle encoding and decoding of large data correctly', () => {
		const largeData = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 255]);
		const encoded = driver.encode({ data: largeData });
		const decoded = driver.decode({ data: encoded });
		expect(decoded).toEqual(largeData);
	});
});
