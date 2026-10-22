/** Base class for storage errors; backend errors are preserved as `cause`. */
export class StorageError extends Error {}

export class StorageUnsupportedOperationError extends StorageError {
	constructor(
		readonly driver: string,
		readonly operation: string,
	) {
		super(`Storage driver "${driver}" does not support "${operation}"`);
		this.name = 'StorageUnsupportedOperationError';
	}
}

export class StorageInvalidKeyError extends StorageError {
	constructor(readonly key: string) {
		super(`Invalid storage key: "${key}"`);
		this.name = 'StorageInvalidKeyError';
	}
}

export class StorageNotFoundError extends StorageError {
	constructor(
		readonly key: string,
		options?: ErrorOptions,
	) {
		super(`Storage file not found: "${key}"`, options);
		this.name = 'StorageNotFoundError';
	}
}

export class StorageOperationError extends StorageError {
	constructor(
		readonly operation: string,
		readonly key: string,
		options?: ErrorOptions,
	) {
		super(`Storage operation "${operation}" failed for "${key}"`, options);
		this.name = 'StorageOperationError';
	}
}
