import { describe, expect, test, vi } from 'vitest';

import {
	createPgBossService,
	defineTask,
	type PgBossClientContract,
} from '#src/exports.js';

function createBossMock(): PgBossClientContract {
	let workerSequence = 0;

	return {
		createQueue: vi.fn(async () => {
			return undefined;
		}),
		start: vi.fn(async () => {
			return undefined;
		}),
		stop: vi.fn(async () => {
			return undefined;
		}),
		send: vi.fn(async () => {
			return 'job_1';
		}),
		sendAfter: vi.fn(async () => {
			return 'job_2';
		}),
		sendThrottled: vi.fn(async () => {
			return 'job_3';
		}),
		sendDebounced: vi.fn(async () => {
			return 'job_4';
		}),
		fetch: vi.fn(async () => {
			return [];
		}),
		work: vi.fn(async () => {
			workerSequence += 1;
			return `worker_${workerSequence}`;
		}),
	};
}

describe('PgBoss::Service', () => {
	const sendWelcomeWorker = vi.fn(async () => {
		return undefined;
	});
	const syncInvoiceWorker = vi.fn(async () => {
		return undefined;
	});
	const cleanupWorker = vi.fn(async () => {
		return undefined;
	});

	const tasks = {
		'email.sendWelcome': defineTask<{
			userId: string;
			locale?: 'en' | 'de';
		}>({
			name: 'queues.email.sendWelcome',
			options: { pollingIntervalSeconds: 5 },
			handler: sendWelcomeWorker,
		}),
		'billing.syncInvoice': defineTask<{ invoiceId: string; force?: boolean }>({
			handler: syncInvoiceWorker,
		}),
		'housekeeping.cleanup': defineTask<undefined>({
			handler: cleanupWorker,
		}),
	};

	test('should return expected methods', () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks });

		expect(service).toHaveProperty('start');
		expect(service).toHaveProperty('stop');
		expect(service).toHaveProperty('client');
		expect(service).toHaveProperty('send');
		expect(service).toHaveProperty('sendAfter');
		expect(service).toHaveProperty('sendThrottled');
		expect(service).toHaveProperty('sendDebounced');
		expect(service).toHaveProperty('fetch');
		expect(service).toHaveProperty('work');
	});

	test('should send a typed task using task queue name', async () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks });

		await service.send({
			task: 'email.sendWelcome',
			data: { userId: 'usr_1', locale: 'en' },
		});

		expect(boss.send).toHaveBeenCalledWith(
			'queues.email.sendWelcome',
			{
				userId: 'usr_1',
				locale: 'en',
			},
			undefined,
		);
	});

	test('should send null payload when data is omitted', async () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks });

		await service.send({ task: 'housekeeping.cleanup' });

		expect(boss.send).toHaveBeenCalledWith(
			'housekeeping.cleanup',
			null,
			undefined,
		);
	});

	test('should call deferred and throttled send methods', async () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks });

		await service.sendAfter({
			task: 'billing.syncInvoice',
			data: { invoiceId: 'inv_1' },
			value: 5,
		});

		await service.sendThrottled({
			task: 'billing.syncInvoice',
			data: { invoiceId: 'inv_2' },
			seconds: 30,
			key: 'tenant_1',
		});

		await service.sendDebounced({
			task: 'billing.syncInvoice',
			data: { invoiceId: 'inv_3' },
			seconds: 30,
		});

		expect(boss.sendAfter).toHaveBeenCalledWith(
			'billing.syncInvoice',
			{ invoiceId: 'inv_1' },
			null,
			5,
		);
		expect(boss.sendThrottled).toHaveBeenCalledWith(
			'billing.syncInvoice',
			{ invoiceId: 'inv_2' },
			null,
			30,
			'tenant_1',
		);
		expect(boss.sendDebounced).toHaveBeenCalledWith(
			'billing.syncInvoice',
			{ invoiceId: 'inv_3' },
			null,
			30,
			undefined,
		);
	});

	test('should register declared worker from task definition', async () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks, autoWork: false });

		const workerId = await service.work('email.sendWelcome');

		expect(workerId).toBe('worker_1');
		expect(boss.createQueue).toHaveBeenCalledWith('queues.email.sendWelcome');
		expect(boss.work).toHaveBeenCalledWith(
			'queues.email.sendWelcome',
			{ pollingIntervalSeconds: 5 },
			sendWelcomeWorker,
		);
	});

	test('should not register same task worker twice', async () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks, autoWork: false });

		const workerId1 = await service.work('billing.syncInvoice');
		const workerId2 = await service.work('billing.syncInvoice');

		expect(workerId1).toBe('worker_1');
		expect(workerId2).toBe('worker_1');
		expect(boss.work).toHaveBeenCalledTimes(1);
	});

	test('should collapse concurrent worker registration for the same task', async () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks, autoWork: false });

		const [workerId1, workerId2] = await Promise.all([
			service.work('billing.syncInvoice'),
			service.work('billing.syncInvoice'),
		]);

		expect(workerId1).toBe('worker_1');
		expect(workerId2).toBe('worker_1');
		expect(boss.createQueue).toHaveBeenCalledTimes(1);
		expect(boss.work).toHaveBeenCalledTimes(1);
	});

	test('should auto-register declared workers on start by default', async () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks });

		await service.start();

		expect(boss.start).toHaveBeenCalledTimes(1);
		expect(boss.createQueue).toHaveBeenCalledTimes(3);
		expect(boss.work).toHaveBeenCalledTimes(3);
	});

	test('should create queue only once for repeated worker registration', async () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks, autoWork: false });

		await service.work('billing.syncInvoice');
		await service.work('billing.syncInvoice');

		expect(boss.createQueue).toHaveBeenCalledTimes(1);
		expect(boss.createQueue).toHaveBeenCalledWith('billing.syncInvoice');
	});

	test('should skip auto worker registration when autoWork is false', async () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks, autoWork: false });

		await service.start();

		expect(boss.start).toHaveBeenCalledTimes(1);
		expect(boss.work).toHaveBeenCalledTimes(0);
	});

	test('should throw on undefined task name at runtime', async () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks });

		await expect(
			// @ts-expect-error checking unknown task
			service.send({ task: 'unknown.task', data: {} }),
		).rejects.toThrowError('PgBoss task "unknown.task" is not defined');
	});

	test('should expose original boss client', () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks });

		expect(service.client()).toBe(boss);
	});

	test('should start and stop the underlying boss client', async () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks });

		await service.start();
		await service.stop({ graceful: true });

		expect(boss.start).toHaveBeenCalledTimes(1);
		expect(boss.stop).toHaveBeenCalledWith({ graceful: true });
	});

	test('should clear worker state even when stop fails', async () => {
		const boss = createBossMock();
		boss.stop = vi.fn(async () => {
			throw new Error('stop failed');
		});
		const service = createPgBossService({ boss, tasks, autoWork: false });

		await service.work('billing.syncInvoice');

		await expect(service.stop()).rejects.toThrowError('stop failed');

		await service.work('billing.syncInvoice');

		expect(boss.work).toHaveBeenCalledTimes(2);
	});

	test('should provide type-safe task payloads', async () => {
		const boss = createBossMock();
		const service = createPgBossService({ boss, tasks });

		await service.send({
			task: 'billing.syncInvoice',
			data: { invoiceId: 'inv_100', force: true },
		});

		await service.send({
			task: 'billing.syncInvoice',
			// @ts-expect-error wrong payload shape for billing.syncInvoice
			data: { userId: 'usr_1' },
		});
	});

	test('should create internal pg-boss client from connection string', () => {
		const service = createPgBossService({
			connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
			tasks,
		});

		expect(service.client()).toBeDefined();
	});
});
