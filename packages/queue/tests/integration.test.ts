import { PGlite } from '@electric-sql/pglite';
import { PgBoss } from 'pg-boss';
import { afterEach, describe, expect, test } from 'vitest';

import { createQueueService, defineTask } from '#src/exports.js';

type SqlResult = {
	rows: any[];
};

function createDeferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;

	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve;
		reject = promiseReject;
	});

	return { promise, resolve, reject };
}

async function createIntegrationHarness() {
	const db = new PGlite();
	const boss = new PgBoss({
		db: {
			executeSql: async (
				text: string,
				values?: unknown[],
			): Promise<SqlResult> => {
				if ((values?.length ?? 0) === 0) {
					const results = await db.exec(text);
					return { rows: results.at(-1)?.rows ?? [] };
				}

				const result = await db.query(text, values ?? []);
				return { rows: result.rows };
			},
		},
		schedule: false,
		supervise: false,
	});

	return {
		boss,
		db,
		close: async () => {
			await boss.stop();
			await db.close();
		},
	};
}

describe.sequential('PgBoss::Integration', () => {
	const cleanup: Array<() => Promise<void>> = [];

	afterEach(async () => {
		while (cleanup.length > 0) {
			const dispose = cleanup.pop();
			if (dispose) {
				await dispose();
			}
		}
	});

	test('should create queues on start and process a real job', async () => {
		const harness = await createIntegrationHarness();
		cleanup.push(harness.close);

		const handled = createDeferred<{ userId: string }>();
		const taskQueueName = 'auth_password_reset_email';

		const service = createQueueService({
			autoWork: true,
			boss: harness.boss,
			tasks: {
				'auth.passwordResetEmail': defineTask<{ userId: string }>({
					handler: async ([job]) => {
						if (job) {
							handled.resolve(job.data);
						} else {
							handled.reject('No job');
						}
					},
					name: taskQueueName,
					options: { pollingIntervalSeconds: 0.5 },
				}),
			},
		});

		await service.start();

		const queue = await harness.boss.getQueue(taskQueueName);
		expect(queue?.name).toBe(taskQueueName);

		const jobId = await service.send({
			data: { userId: 'usr_123' },
			task: 'auth.passwordResetEmail',
		});

		expect(jobId).toEqual(expect.any(String));

		await expect(handled.promise).resolves.toEqual({ userId: 'usr_123' });
	}, 15_000);
});
