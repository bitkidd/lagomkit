import type { FlasherDriverContract } from '../types.js';

type FlashEntry = {
	value: unknown;
	expiresAt?: number;
};

/**
 * Creates an in-memory flasher driver.
 */
export function createMemoryFlasherDriver(): FlasherDriverContract {
	const messages = new Map<string, FlashEntry>();

	const isExpired = (entry: FlashEntry): boolean => {
		if (entry.expiresAt === undefined) {
			return false;
		}

		return entry.expiresAt <= Date.now();
	};

	const read = <T>(id: string, consume: boolean): T | undefined => {
		if (!id?.trim()) {
			return undefined;
		}

		const entry = messages.get(id);

		if (!entry) {
			return undefined;
		}

		if (isExpired(entry)) {
			messages.delete(id);
			return undefined;
		}

		if (consume) {
			messages.delete(id);
		}

		return entry.value as T;
	};

	return {
		set: async <T>(value: T, options?: { ttlMs?: number }): Promise<string> => {
			let id = crypto.randomUUID();

			while (messages.has(id)) {
				id = crypto.randomUUID();
			}

			const ttlMs = options?.ttlMs;
			const expiresAt =
				typeof ttlMs === 'number' ? Date.now() + Math.max(0, ttlMs) : undefined;

			messages.set(id, {
				value,
				...(expiresAt === undefined ? {} : { expiresAt }),
			});

			return id;
		},
		get: async <T>(id: string): Promise<T | undefined> => {
			return read<T>(id, true);
		},
		peek: async <T>(id: string): Promise<T | undefined> => {
			return read<T>(id, false);
		},
		getMany: async <T>(ids: string[]): Promise<Record<string, T>> => {
			const values: Record<string, T> = {};

			for (const id of ids) {
				if (Object.hasOwn(values, id)) {
					continue;
				}

				const value = read<T>(id, true);
				if (value !== undefined) {
					values[id] = value;
				}
			}

			return values;
		},
		peekMany: async <T>(ids: string[]): Promise<Record<string, T>> => {
			const values: Record<string, T> = {};

			for (const id of ids) {
				if (Object.hasOwn(values, id)) {
					continue;
				}

				const value = read<T>(id, false);
				if (value !== undefined) {
					values[id] = value;
				}
			}

			return values;
		},
		erase: async (id: string): Promise<void> => {
			messages.delete(id);
		},
		clear: async (): Promise<void> => {
			messages.clear();
		},
	};
}
