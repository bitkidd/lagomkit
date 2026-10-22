import { gunzipSync } from 'node:zlib';
import { describe, expect, test, vi } from 'vitest';
import {
	createAxiomLoggerDriver,
	type AxiomLoggerClient,
} from '#src/drivers/axiom.js';
import type { LoggerLevel } from '#src/types.js';

const levels: LoggerLevel[] = [
	'trace',
	'debug',
	'info',
	'warn',
	'error',
	'fatal',
];

function createClient() {
	return {
		ingest: vi.fn<AxiomLoggerClient['ingest']>().mockResolvedValue({
			ingested: 1,
			failed: 0,
			processedBytes: 0,
			blocksCreated: 0,
			walLength: 0,
		}),
	};
}

describe('Logger::Axiom', { concurrent: false }, () => {
	test.each(levels)('should filter messages below %s', (level) => {
		const client = createClient();
		const driver = createAxiomLoggerDriver({ dataset: 'logs', client, level });

		for (const messageLevel of levels) {
			driver[messageLevel]({ message: messageLevel });
		}

		expect(client.ingest.mock.calls.map(([, event]) => event)).toEqual(
			levels.slice(levels.indexOf(level)).map((messageLevel) => {
				return expect.objectContaining({ level: messageLevel });
			}),
		);
	});

	test('should default to info and keep context separate from event fields', () => {
		const client = createClient();
		const driver = createAxiomLoggerDriver({
			dataset: 'app-logs',
			client,
			context: { service: 'api', requestId: 'default' },
		});

		driver.debug({ message: 'Hidden' });
		driver.log({
			level: 'warn',
			message: 'Retrying',
			context: { level: 'fatal', _time: 'invalid', requestId: 'req_123' },
		});

		expect(client.ingest).toHaveBeenCalledExactlyOnceWith('app-logs', {
			_time: expect.any(String),
			level: 'warn',
			message: 'Retrying',
			context: {
				service: 'api',
				requestId: 'req_123',
				level: 'fatal',
				_time: 'invalid',
			},
		});
	});

	test('should serialize Error details and preserve non-Error failures', () => {
		const client = createClient();
		const driver = createAxiomLoggerDriver({ dataset: 'logs', client });
		const error = new TypeError('Invalid input');

		driver.error({ message: 'Failed', error });
		driver.error({ message: 'Rejected', error: { code: 'DENIED' } });

		expect(client.ingest).toHaveBeenNthCalledWith(1, 'logs', {
			_time: expect.any(String),
			level: 'error',
			message: 'Failed',
			error: {
				name: 'TypeError',
				message: 'Invalid input',
				stack: error.stack,
			},
		});
		expect(client.ingest).toHaveBeenNthCalledWith(
			2,
			'logs',
			expect.objectContaining({ error: { code: 'DENIED' } }),
		);
	});

	test('should report synchronous ingest failures without interrupting the caller', () => {
		const client = createClient();
		const error = new Error('Ingest failed');
		const errors: unknown[] = [];
		client.ingest.mockImplementationOnce(() => {
			throw error;
		});
		const driver = createAxiomLoggerDriver({
			dataset: 'logs',
			client,
			onError: (failure) => {
				errors.push(failure);
			},
		});

		expect(driver.info({ message: 'Hello' })).toBeUndefined();
		expect(errors).toEqual([error]);
	});

	test('should consume rejected requests and failing error handlers', async () => {
		const client = createClient();
		const error = new Error('Delivery failed');
		const errors: unknown[] = [];
		client.ingest.mockRejectedValueOnce(error);
		const driver = createAxiomLoggerDriver({
			dataset: 'logs',
			client,
			onError: (failure) => {
				errors.push(failure);
				throw new Error('Error handler failed');
			},
		});

		expect(driver.info({ message: 'Hello' })).toBeUndefined();

		await expect.poll(() => errors).toEqual([error]);
	});

	test('should report rejected events from a successful HTTP request', async () => {
		const client = createClient();
		const errors: unknown[] = [];
		client.ingest.mockResolvedValueOnce({
			ingested: 0,
			failed: 1,
			processedBytes: 0,
			blocksCreated: 0,
			walLength: 0,
		});
		const driver = createAxiomLoggerDriver({
			dataset: 'logs',
			client,
			onError: (error) => {
				errors.push(error);
			},
		});

		driver.info({ message: 'Hello' });

		await expect
			.poll(() => errors)
			.toEqual([new Error('Axiom logger failed to ingest the message')]);
	});

	test.each(['', '   '])('should reject an empty dataset (%j)', (dataset) => {
		expect(() =>
			createAxiomLoggerDriver({ dataset, client: createClient() }),
		).toThrow('Axiom logger dataset must be a non-empty string');
	});

	test('should reject an invalid configured level', () => {
		expect(() =>
			createAxiomLoggerDriver({
				dataset: 'logs',
				client: createClient(),
				// @ts-expect-error checking invalid configuration at runtime
				level: 'verbose',
			}),
		).toThrow('Logger level "verbose" is not defined');
	});

	test('should send in the background through the real SDK without network access', async () => {
		const requests: Request[] = [];
		const driver = createAxiomLoggerDriver({
			dataset: 'app-logs',
			options: {
				token: 'test-token',
				edge: 'eu-central-1.aws.edge.axiom.co',
				fetch: async (input, init) => {
					requests.push(new Request(input, init));

					return Response.json({ ingested: 1, failed: 0 });
				},
			},
		});
		const started = Date.now();

		expect(
			driver.info({ message: 'Started', context: { requestId: 'req_123' } }),
		).toBeUndefined();
		expect(driver).not.toHaveProperty('flush');

		expect(requests).toHaveLength(0);
		await expect.poll(() => requests.length, { timeout: 3000 }).toBe(1);

		const request = requests[0];

		if (!request) {
			throw new Error('Expected an ingest request');
		}

		expect(request.url).toBe(
			'https://eu-central-1.aws.edge.axiom.co/v1/ingest/app-logs',
		);
		expect(request.method).toBe('POST');
		expect(request.headers.get('authorization')).toBe('Bearer test-token');

		const body = Buffer.from(await request.arrayBuffer());
		const text =
			request.headers.get('content-encoding') === 'gzip'
				? gunzipSync(body).toString('utf8')
				: body.toString('utf8');
		const events = text.split('\n').map((line) => {
			return JSON.parse(line) as Record<string, unknown>;
		});

		expect(events).toEqual([
			{
				_time: expect.any(String),
				level: 'info',
				message: 'Started',
				context: { requestId: 'req_123' },
			},
		]);

		for (const event of events) {
			const timestamp = Date.parse(String(event._time));

			expect(timestamp).toBeGreaterThanOrEqual(started);
			expect(timestamp).toBeLessThanOrEqual(Date.now());
		}
	});

	test('should report SDK delivery errors through onError', async () => {
		const errors: unknown[] = [];
		const driver = createAxiomLoggerDriver({
			dataset: 'logs',
			onError: (error) => {
				errors.push(error);
			},
			options: {
				token: 'test-token',
				fetch: async () => {
					return new Response('Unauthorized', { status: 401 });
				},
			},
		});

		expect(driver.error({ message: 'A message' })).toBeUndefined();

		await expect.poll(() => errors.length, { timeout: 3000 }).toBe(1);
		expect(errors[0]).toEqual(new Error('forbidden'));
	});

	test('should contain serialization failures before making a request', async () => {
		const errors: unknown[] = [];
		const requests: Request[] = [];
		const driver = createAxiomLoggerDriver({
			dataset: 'logs',
			onError: (error) => {
				errors.push(error);
			},
			options: {
				token: 'test-token',
				fetch: async (input, init) => {
					requests.push(new Request(input, init));

					return Response.json({ ingested: 1, failed: 0 });
				},
			},
		});
		const context: Record<string, unknown> = {};
		context.self = context;

		expect(
			driver.info({ message: 'Circular context', context }),
		).toBeUndefined();

		await expect.poll(() => errors.length).toBe(1);
		expect(errors[0]).toBeInstanceOf(TypeError);
		expect(requests).toHaveLength(0);
	});
});
