import type {
	ConstructorOptions,
	FetchOptions,
	Job,
	JobWithMetadata,
	SendOptions,
	StopOptions,
	WorkHandler,
	WorkOptions,
} from 'pg-boss';

/**
 * Payload supported by pg-boss job data.
 */
export type PgBossTaskPayload = object | null | undefined;

/**
 * Task declaration used for payload inference and worker registration.
 */
export type PgBossTask<Data extends PgBossTaskPayload = PgBossTaskPayload> = {
	/**
	 * Optional queue name override. When omitted, the task map key is used.
	 */
	readonly name?: string;
	/**
	 * Worker polling options passed through to `pg-boss.work(...)`.
	 */
	readonly options?: WorkOptions;
	/**
	 * Worker implementation for this task.
	 */
	readonly handler: WorkHandler<Data>;
};

/**
 * Collection of named task declarations.
 */
export type PgBossTaskMap = Record<string, PgBossTask<any>>;

/**
 * Allowed task keys from the configured task map.
 */
export type PgBossTaskName<Tasks extends PgBossTaskMap> = keyof Tasks & string;

/**
 * Payload type inferred from a task declaration.
 */
export type PgBossTaskData<
	Tasks extends PgBossTaskMap,
	TaskName extends PgBossTaskName<Tasks>,
> = Tasks[TaskName] extends PgBossTask<infer Data> ? Data : never;

/**
 * Send argument shape inferred from a specific task.
 */
export type PgBossSendArgs<
	Tasks extends PgBossTaskMap,
	TaskName extends PgBossTaskName<Tasks>,
> =
	undefined extends PgBossTaskData<Tasks, TaskName>
		? {
				task: TaskName;
				data?: PgBossTaskData<Tasks, TaskName>;
				options?: SendOptions;
			}
		: {
				task: TaskName;
				data: PgBossTaskData<Tasks, TaskName>;
				options?: SendOptions;
			};

/**
 * Task argument shape that conditionally requires data.
 */
export type PgBossTaskArgs<
	Tasks extends PgBossTaskMap,
	TaskName extends PgBossTaskName<Tasks>,
> =
	undefined extends PgBossTaskData<Tasks, TaskName>
		? {
				task: TaskName;
				data?: PgBossTaskData<Tasks, TaskName>;
			}
		: {
				task: TaskName;
				data: PgBossTaskData<Tasks, TaskName>;
			};

/**
 * Minimal pg-boss client surface used by the service.
 */
export interface PgBossClientContract {
	/**
	 * Creates a queue if it does not already exist.
	 */
	createQueue: (name: string) => Promise<unknown>;
	/**
	 * Starts the underlying pg-boss instance.
	 */
	start: () => Promise<unknown>;
	/**
	 * Stops the underlying pg-boss instance.
	 */
	stop: (options?: StopOptions) => Promise<void>;
	/**
	 * Sends a job to a queue.
	 */
	send: (
		name: string,
		data?: object | null,
		options?: SendOptions,
	) => Promise<string | null>;
	/**
	 * Sends a job to start after a delay or point in time.
	 */
	sendAfter: {
		(
			name: string,
			data: object | null,
			options: SendOptions | null,
			value: Date,
		): Promise<string | null>;
		(
			name: string,
			data: object | null,
			options: SendOptions | null,
			value: string,
		): Promise<string | null>;
		(
			name: string,
			data: object | null,
			options: SendOptions | null,
			value: number,
		): Promise<string | null>;
	};
	/**
	 * Sends a throttled job.
	 */
	sendThrottled: (
		name: string,
		data: object | null,
		options: SendOptions | null,
		seconds: number,
		key?: string,
	) => Promise<string | null>;
	/**
	 * Sends a debounced job.
	 */
	sendDebounced: (
		name: string,
		data: object | null,
		options: SendOptions | null,
		seconds: number,
		key?: string,
	) => Promise<string | null>;
	/**
	 * Fetches queued jobs.
	 */
	fetch: {
		<T>(
			name: string,
			options: FetchOptions & { includeMetadata: true },
		): Promise<JobWithMetadata<T>[]>;
		<T>(name: string, options?: FetchOptions): Promise<Job<T>[]>;
	};
	/**
	 * Registers a worker for a queue.
	 */
	work: {
		<ReqData, ResData = unknown>(
			name: string,
			handler: WorkHandler<ReqData, ResData>,
		): Promise<string>;
		<ReqData, ResData = unknown>(
			name: string,
			options: WorkOptions,
			handler: WorkHandler<ReqData, ResData>,
		): Promise<string>;
	};
}

/**
 * Configuration supported by createPgBossService.
 */
export type CreatePgBossServiceConfig<Tasks extends PgBossTaskMap> =
	| {
			/**
			 * Declared tasks handled by the service.
			 */
			tasks: Tasks;
			/**
			 * Whether `start()` should auto-register all declared workers.
			 */
			autoWork?: boolean;
			/**
			 * Existing pg-boss client to wrap.
			 */
			boss: PgBossClientContract;
	  }
	| {
			/**
			 * Declared tasks handled by the service.
			 */
			tasks: Tasks;
			/**
			 * Whether `start()` should auto-register all declared workers.
			 */
			autoWork?: boolean;
			/**
			 * Postgres connection string used to create an internal pg-boss client.
			 */
			connectionString: string;
			/**
			 * Extra pg-boss constructor options when using `connectionString`.
			 */
			options?: Omit<ConstructorOptions, 'connectionString'>;
	  }
	| {
			/**
			 * Declared tasks handled by the service.
			 */
			tasks: Tasks;
			/**
			 * Whether `start()` should auto-register all declared workers.
			 */
			autoWork?: boolean;
			/**
			 * Full pg-boss constructor options used to create an internal client.
			 */
			options: ConstructorOptions;
	  };

/**
 * Typed pg-boss service API.
 */
export interface PgBossServiceContract<Tasks extends PgBossTaskMap> {
	/**
	 * Starts the underlying pg-boss instance and optionally auto-registers task workers.
	 */
	start: () => Promise<void>;
	/**
	 * Stops the underlying pg-boss instance.
	 */
	stop: (options?: StopOptions) => Promise<void>;
	/**
	 * Returns the underlying pg-boss client instance.
	 */
	client: () => PgBossClientContract;
	/**
	 * Sends a task with payload inferred from the selected task key.
	 */
	send: <TaskName extends PgBossTaskName<Tasks>>(
		args: PgBossSendArgs<Tasks, TaskName>,
	) => Promise<string | null>;
	/**
	 * Sends a task that starts after a date, date string, or delay in seconds.
	 */
	sendAfter: <TaskName extends PgBossTaskName<Tasks>>(
		args: {
			options?: SendOptions | null;
			value: Date | string | number;
		} & PgBossTaskArgs<Tasks, TaskName>,
	) => Promise<string | null>;
	/**
	 * Sends a throttled task.
	 */
	sendThrottled: <TaskName extends PgBossTaskName<Tasks>>(
		args: {
			options?: SendOptions | null;
			seconds: number;
			key?: string;
		} & PgBossTaskArgs<Tasks, TaskName>,
	) => Promise<string | null>;
	/**
	 * Sends a debounced task.
	 */
	sendDebounced: <TaskName extends PgBossTaskName<Tasks>>(
		args: {
			options?: SendOptions | null;
			seconds: number;
			key?: string;
		} & PgBossTaskArgs<Tasks, TaskName>,
	) => Promise<string | null>;
	/**
	 * Fetches jobs with payload type inferred from the task key.
	 */
	fetch: {
		<TaskName extends PgBossTaskName<Tasks>>(
			task: TaskName,
			options: FetchOptions & { includeMetadata: true },
		): Promise<JobWithMetadata<PgBossTaskData<Tasks, TaskName>>[]>;
		<TaskName extends PgBossTaskName<Tasks>>(
			task: TaskName,
			options?: FetchOptions,
		): Promise<Job<PgBossTaskData<Tasks, TaskName>>[]>;
	};
	/**
	 * Registers a declared worker for a task.
	 */
	work: <TaskName extends PgBossTaskName<Tasks>>(
		task: TaskName,
	) => Promise<string>;
}
