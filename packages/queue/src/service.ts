import type {
	FetchOptions,
	Job,
	JobWithMetadata,
	StopOptions,
} from 'pg-boss';
import { PgBoss } from 'pg-boss';
import type {
	createQueueServiceConfig,
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

type PgBossTaskContext<
	Tasks extends PgBossTaskMap,
	TaskName extends PgBossTaskName<Tasks>,
> = {
	task: TaskName;
	declaration: Tasks[TaskName];
	queue: string;
};

/**
 * Builds a pg-boss client from either an injected instance or constructor config.
 */
function buildBossClient<Tasks extends PgBossTaskMap>(
	config: createQueueServiceConfig<Tasks>,
): PgBossClientContract {
	if ('boss' in config) {
		return config.boss;
	}

	if ('connectionString' in config) {
		if (config.options) {
			const options = {
				...config.options,
				connectionString: config.connectionString,
			};

			return new PgBoss(options);
		}

		return new PgBoss(config.connectionString);
	}

	return new PgBoss(config.options);
}

/**
 * Converts omitted payloads to `null`, which matches pg-boss job data semantics.
 */
function normalizeTaskPayload<Data extends PgBossTaskPayload>(
	data: Data | undefined,
): Exclude<Data, undefined> | null {
	return data === undefined ? null : (data as Exclude<Data, undefined>);
}

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
export function createQueueService<Tasks extends PgBossTaskMap>(
	config: createQueueServiceConfig<Tasks>,
): PgBossServiceContract<Tasks> {
	const boss = buildBossClient(config);
	const workerIds = new Map<string, string>();
	const workerRegistrations = new Map<string, Promise<string>>();
	const queueCreation = new Map<string, Promise<void>>();

	const assertTask = <TaskName extends PgBossTaskName<Tasks>>(
		task: TaskName,
	): void => {
		if (!Object.hasOwn(config.tasks, task)) {
			throw new Error(`PgBoss task "${String(task)}" is not defined`);
		}
	};

	const getTaskDeclaration = <TaskName extends PgBossTaskName<Tasks>>(
		task: TaskName,
	): Tasks[TaskName] => {
		assertTask(task);
		return config.tasks[task];
	};

	const getQueueName = <TaskName extends PgBossTaskName<Tasks>>(
		task: TaskName,
	): string => {
		const taskDeclaration = getTaskDeclaration(task);

		if (
			taskDeclaration.name &&
			taskDeclaration.name.length > 0 &&
			taskDeclaration.name !== task
		) {
			return taskDeclaration.name;
		}

		return task;
	};

	const getTaskContext = <TaskName extends PgBossTaskName<Tasks>>(
		task: TaskName,
	): PgBossTaskContext<Tasks, TaskName> => {
		const declaration = getTaskDeclaration(task);

		return {
			declaration,
			queue: getQueueName(task),
			task,
		};
	};

	/**
	 * Ensures a queue exists before sends or workers depend on it.
	 */
	const ensureQueue = async (queue: string): Promise<string> => {
		const existingCreation = queueCreation.get(queue);

		if (existingCreation) {
			await existingCreation;
			return queue;
		}

		const creation = Promise.resolve(boss.createQueue(queue)).then(
			() => undefined,
		);
		queueCreation.set(queue, creation);

		try {
			await creation;
		} catch (error) {
			queueCreation.delete(queue);
			throw error;
		}

		return queue;
	};

	const send = async <TaskName extends PgBossTaskName<Tasks>>(
		args: PgBossSendArgs<Tasks, TaskName>,
	): Promise<string | null> => {
		const { queue } = getTaskContext(args.task);
		const data = normalizeTaskPayload(args.data);

		return boss.send(queue, data, args.options);
	};

	const sendAfter = async <TaskName extends PgBossTaskName<Tasks>>(
		args: {
			options?: Parameters<PgBossClientContract['sendAfter']>[2];
			value: Date | string | number;
		} & PgBossTaskArgs<Tasks, TaskName>,
	): Promise<string | null> => {
		const { queue } = getTaskContext(args.task);
		const data = normalizeTaskPayload(args.data);
		const options = args.options ?? null;
		const { value } = args;

		if (value instanceof Date) {
			return boss.sendAfter(queue, data, options, value);
		}

		if (typeof value === 'string') {
			return boss.sendAfter(queue, data, options, value);
		}

		return boss.sendAfter(queue, data, options, value);
	};

	const sendThrottled = async <TaskName extends PgBossTaskName<Tasks>>(
		args: {
			options?: Parameters<PgBossClientContract['sendThrottled']>[2];
			seconds: number;
			key?: string;
		} & PgBossTaskArgs<Tasks, TaskName>,
	): Promise<string | null> => {
		const { queue } = getTaskContext(args.task);
		const data = normalizeTaskPayload(args.data);

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
		const { queue } = getTaskContext(args.task);
		const data = normalizeTaskPayload(args.data);

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
	/**
	 * Fetches jobs from the resolved queue while preserving the task payload type.
	 */
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
		const { queue } = getTaskContext(task);

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
		const existingWorkerId = workerIds.get(task);

		if (existingWorkerId) {
			return existingWorkerId;
		}

		const existingRegistration = workerRegistrations.get(task);

		if (existingRegistration) {
			return existingRegistration;
		}

		const registration = (async (): Promise<string> => {
			const { declaration, queue } = getTaskContext(task);
			await ensureQueue(queue);

			const workerId = declaration.options
				? await boss.work<PgBossTaskData<Tasks, TaskName>>(
						queue,
						declaration.options,
						declaration.handler,
					)
				: await boss.work<PgBossTaskData<Tasks, TaskName>>(
						queue,
						declaration.handler,
					);

			workerIds.set(task, workerId);

			return workerId;
		})();

		workerRegistrations.set(task, registration);

		try {
			return await registration;
		} catch (error) {
			workerRegistrations.delete(task);
			throw error;
		}
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
		try {
			await boss.stop(options);
		} finally {
			workerIds.clear();
			workerRegistrations.clear();
		}
	};

	return {
		start,
		stop,
		send,
		sendAfter,
		sendThrottled,
		sendDebounced,
		fetch,
		work,
		client: () => {
			return boss;
		},
	};
}
