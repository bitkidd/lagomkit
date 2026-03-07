import type {
	ConstructorOptions,
	FetchOptions,
	Job,
	JobWithMetadata,
	StopOptions,
} from 'pg-boss';
import { PgBoss } from 'pg-boss';
import type {
	CreatePgBossServiceConfig,
	PgBossClientContract,
	PgBossSendArgs,
	PgBossServiceContract,
	PgBossTask,
	PgBossTaskArgs,
	PgBossTaskData,
	PgBossTaskMap,
	PgBossTaskName,
	PgBossTaskPayload,
} from './types.js';

/**
 * Creates a typed task declaration.
 */
export function defineTask<Data extends PgBossTaskPayload>(config: {
	name?: string;
	options?: PgBossTask<Data>['options'];
	handler: PgBossTask<Data>['handler'];
}): PgBossTask<Data> {
	return {
		...(config.name !== undefined ? { name: config.name } : {}),
		...(config.options !== undefined ? { options: config.options } : {}),
		handler: config.handler,
	};
}

/**
 * Creates a typed pg-boss service from declared tasks.
 */
export function createPgBossService<Tasks extends PgBossTaskMap>(
	config: CreatePgBossServiceConfig<Tasks>,
): PgBossServiceContract<Tasks> {
	const boss: PgBossClientContract = (() => {
		if ('boss' in config) {
			return config.boss;
		}

		if ('connectionString' in config) {
			if (config.options) {
				const options: ConstructorOptions = {
					...config.options,
					connectionString: config.connectionString,
				};

				return new PgBoss(options);
			}

			return new PgBoss(config.connectionString);
		}

		return new PgBoss(config.options);
	})();

	const workers = new Map<string, string>();

	const assertTask = <TaskName extends PgBossTaskName<Tasks>>(
		task: TaskName,
	): void => {
		if (!Object.hasOwn(config.tasks, task)) {
			throw new Error(`PgBoss task "${String(task)}" is not defined`);
		}
	};

	const getTask = <TaskName extends PgBossTaskName<Tasks>>(
		task: TaskName,
	): Tasks[TaskName] => {
		assertTask(task);
		return config.tasks[task];
	};

	const getQueueName = <TaskName extends PgBossTaskName<Tasks>>(
		task: TaskName,
	): string => {
		const taskDeclaration = getTask(task);

		if (
			taskDeclaration.name &&
			taskDeclaration.name.length > 0 &&
			taskDeclaration.name !== task
		) {
			return taskDeclaration.name;
		}

		return task;
	};

	const send = async <TaskName extends PgBossTaskName<Tasks>>(
		args: PgBossSendArgs<Tasks, TaskName>,
	): Promise<string | null> => {
		const queue = getQueueName(args.task);
		const data = args.data === undefined ? null : args.data;

		return boss.send(queue, data, args.options);
	};

	const sendAfter = async <TaskName extends PgBossTaskName<Tasks>>(
		args: {
			options?: Parameters<PgBossClientContract['sendAfter']>[2];
			value: Date | string | number;
		} & PgBossTaskArgs<Tasks, TaskName>,
	): Promise<string | null> => {
		const queue = getQueueName(args.task);
		const data = args.data === undefined ? null : args.data;

		if (args.value instanceof Date) {
			return boss.sendAfter(queue, data, args.options ?? null, args.value);
		}

		if (typeof args.value === 'string') {
			return boss.sendAfter(queue, data, args.options ?? null, args.value);
		}

		return boss.sendAfter(queue, data, args.options ?? null, args.value);
	};

	const sendThrottled = async <TaskName extends PgBossTaskName<Tasks>>(
		args: {
			options?: Parameters<PgBossClientContract['sendThrottled']>[2];
			seconds: number;
			key?: string;
		} & PgBossTaskArgs<Tasks, TaskName>,
	): Promise<string | null> => {
		const queue = getQueueName(args.task);
		const data = args.data === undefined ? null : args.data;

		return boss.sendThrottled(
			queue,
			data,
			args.options ?? null,
			args.seconds,
			args.key,
		);
	};

	const sendDebounced = async <TaskName extends PgBossTaskName<Tasks>>(
		args: {
			options?: Parameters<PgBossClientContract['sendDebounced']>[2];
			seconds: number;
			key?: string;
		} & PgBossTaskArgs<Tasks, TaskName>,
	): Promise<string | null> => {
		const queue = getQueueName(args.task);
		const data = args.data === undefined ? null : args.data;

		return boss.sendDebounced(
			queue,
			data,
			args.options ?? null,
			args.seconds,
			args.key,
		);
	};

	function fetch<TaskName extends PgBossTaskName<Tasks>>(
		task: TaskName,
		options: FetchOptions & { includeMetadata: true },
	): Promise<JobWithMetadata<PgBossTaskData<Tasks, TaskName>>[]>;
	function fetch<TaskName extends PgBossTaskName<Tasks>>(
		task: TaskName,
		options?: FetchOptions,
	): Promise<Job<PgBossTaskData<Tasks, TaskName>>[]>;
	function fetch<TaskName extends PgBossTaskName<Tasks>>(
		task: TaskName,
		options?: FetchOptions,
	):
		| Promise<Job<PgBossTaskData<Tasks, TaskName>>[]>
		| Promise<JobWithMetadata<PgBossTaskData<Tasks, TaskName>>[]> {
		const queue = getQueueName(task);

		if (options?.includeMetadata === true) {
			return boss.fetch<PgBossTaskData<Tasks, TaskName>>(
				queue,
				options as FetchOptions & { includeMetadata: true },
			);
		}

		return boss.fetch<PgBossTaskData<Tasks, TaskName>>(queue, options);
	}

	const work = async <TaskName extends PgBossTaskName<Tasks>>(
		task: TaskName,
	): Promise<string> => {
		const existingWorkerId = workers.get(task);

		if (existingWorkerId) {
			return existingWorkerId;
		}

		const taskDeclaration = getTask(task);
		const queue = getQueueName(task);
		const workerId = taskDeclaration.options
			? await boss.work<PgBossTaskData<Tasks, TaskName>>(
					queue,
					taskDeclaration.options,
					taskDeclaration.handler,
				)
			: await boss.work<PgBossTaskData<Tasks, TaskName>>(
					queue,
					taskDeclaration.handler,
				);

		workers.set(task, workerId);

		return workerId;
	};

	const start = async (): Promise<void> => {
		await boss.start();

		if (config.autoWork === false) {
			return;
		}

		const taskNames = Object.keys(config.tasks) as PgBossTaskName<Tasks>[];

		for (const taskName of taskNames) {
			await work(taskName);
		}
	};

	const stop = async (options?: StopOptions): Promise<void> => {
		await boss.stop(options);
		workers.clear();
	};

	return {
		start,
		stop,
		client: () => {
			return boss;
		},
		send,
		sendAfter,
		sendThrottled,
		sendDebounced,
		fetch,
		work,
	};
}
