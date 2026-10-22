import type { LogObject } from 'consola';
import { describe, expect, test } from 'vitest';
import { createConsolaLoggerDriver } from '#src/drivers/consola.js';
import type { LoggerLevel } from '#src/types.js';

const levels: LoggerLevel[] = [
	'trace',
	'debug',
	'info',
	'warn',
	'error',
	'fatal',
];

function createHarness(level?: LoggerLevel) {
	const records: LogObject[] = [];
	const driver = createConsolaLoggerDriver({
		...(level !== undefined ? { level } : {}),
		options: {
			reporters: [
				{
					log: (record) => {
						records.push(record);
					},
				},
			],
		},
	});

	return { driver, records };
}

describe('Logger::Consola', () => {
	test.each(levels)('should filter messages below %s', (level) => {
		const { driver, records } = createHarness(level);

		for (const messageLevel of levels) {
			driver[messageLevel]({ message: messageLevel });
		}

		expect(records.map((record) => record.type)).toEqual(
			levels.slice(levels.indexOf(level)),
		);
	});

	test('should default to info and support explicit levels', () => {
		const { driver, records } = createHarness();

		driver.log({ level: 'debug', message: 'Hidden' });
		driver.log({ level: 'info', message: 'Visible' });

		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({ type: 'info', args: ['Visible'] });
	});

	test('should preserve message, structured context, and the original error', () => {
		const { driver, records } = createHarness();
		const error = new Error('Database unavailable');
		const context = { requestId: 'req_123', details: { retry: true } };

		driver.error({ message: 'Request failed', context, error });

		expect(records[0]?.args).toEqual(['Request failed', context, error]);
		expect(records[0]?.args[2]).toBe(error);
	});

	test('should merge context without modifying the caller objects', () => {
		const records: LogObject[] = [];
		const baseContext = { service: 'api', requestId: 'default' };
		const messageContext = { requestId: 'req_123' };
		const driver = createConsolaLoggerDriver({
			context: baseContext,
			options: {
				defaults: { tag: 'app' },
				reporters: [
					{
						log: (record) => {
							records.push(record);
						},
					},
				],
			},
		});

		driver.info({ message: 'Hello', context: messageContext });
		driver.info({ message: 'Again' });

		expect(records[0]).toMatchObject({
			tag: 'app',
			args: ['Hello', { service: 'api', requestId: 'req_123' }],
		});
		expect(records[1]?.args).toEqual([
			'Again',
			{ service: 'api', requestId: 'default' },
		]);
		expect(baseContext).toEqual({ service: 'api', requestId: 'default' });
		expect(messageContext).toEqual({ requestId: 'req_123' });
	});

	test('should emit repeated messages immediately and return void', () => {
		const { driver, records } = createHarness();

		for (let index = 0; index < 10; index += 1) {
			expect(driver.info({ message: 'Repeated' })).toBeUndefined();
		}

		expect(records).toHaveLength(10);
		expect(driver).not.toHaveProperty('flush');
	});

	test('should reject invalid configured and per-message levels', () => {
		expect(() =>
			// @ts-expect-error checking invalid configuration at runtime
			createConsolaLoggerDriver({ level: 'verbose' }),
		).toThrow('Logger level "verbose" is not defined');

		const { driver } = createHarness();

		expect(() =>
			// @ts-expect-error checking inherited level names at runtime
			driver.log({ level: 'toString', message: 'Invalid' }),
		).toThrow('Logger level "toString" is not defined');
	});
});
