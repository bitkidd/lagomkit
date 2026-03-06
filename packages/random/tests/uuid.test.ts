import { describe, expect, test } from 'vitest';
import { createRandomUuidDriver } from '#src/drivers/uuid.js';

describe('Random::Uuid', () => {
	const driver = createRandomUuidDriver();

	test('should return a driver instance', () => {
		expect(driver).toHaveProperty('generate');
	});

	test('should generate random uuid', async () => {
		const random = driver.generate();

		expect(random).toBeDefined();
	});
});
