import type { Readable } from 'node:stream';

export type StorageVisibility = 'public' | 'private';

/**
 * Portable object keys are relative, slash-separated file names.
 */
export type StorageKey = { key: string };

export type StorageWriteOptions = {
	/** S3 stores this header; local metadata infers it from the file extension. */
	contentType?: string;
};

export type StorageMetaData = {
	contentLength: number;
	contentType?: string;
	etag?: string;
	lastModified?: Date;
};

export type StorageListEntry =
	| { isFile: true; isDirectory: false; key: string }
	| { isFile: false; isDirectory: true; prefix: string };

export type StorageListOptions = {
	/** Directory prefix. Omit or use `/` to list the root. */
	prefix?: string;
	recursive?: boolean;
	/** Pagination options are supported by S3, and throw on local storage. */
	maxResults?: number;
	paginationToken?: string;
};

export type StorageList = {
	objects: StorageListEntry[];
	paginationToken?: string;
};

export type StorageSignedUrlOptions = StorageKey & {
	/** Lifetime in seconds, from 1 to 604800. Defaults to 1800. */
	expiresIn?: number;
	contentType?: string;
	contentDisposition?: string;
};

export type StorageSignedUpload = {
	url: string;
	method: 'PUT';
	/** These exact headers must accompany the upload request. */
	headers: Record<string, string>;
};

/**
 * Both drivers expose every method. Unsupported operations reject with a
 * StorageUnsupportedOperationError. Writes and transfers overwrite destinations.
 */
export interface StorageDriverContract {
	put: (
		input: StorageKey &
			StorageWriteOptions & {
				contents: string | Uint8Array;
			},
	) => Promise<void>;
	putStream: (
		input: StorageKey &
			StorageWriteOptions & {
				contents: Readable;
			},
	) => Promise<void>;
	/** Reads a complete file as UTF-8 text. */
	get: (input: StorageKey) => Promise<string>;
	getBytes: (input: StorageKey) => Promise<Uint8Array>;
	/** The caller must consume or destroy the returned Node.js stream. */
	getStream: (input: StorageKey) => Promise<Readable>;
	getMetaData: (input: StorageKey) => Promise<StorageMetaData>;
	exists: (input: StorageKey) => Promise<boolean>;
	/** Deleting a missing file succeeds. */
	delete: (input: StorageKey) => Promise<void>;
	/** Deletes files inside a directory prefix. Use `/` explicitly for the root. */
	deleteAll: (input: { prefix: string }) => Promise<void>;
	copy: (input: { source: string; destination: string }) => Promise<void>;
	/** S3 moves are copy-then-delete operations, not atomic renames. */
	move: (input: { source: string; destination: string }) => Promise<void>;
	copyFromFs: (
		input: StorageWriteOptions & {
			source: string | URL;
			destination: string;
		},
	) => Promise<void>;
	/** Removes the source only after the upload completes successfully. */
	moveFromFs: (
		input: StorageWriteOptions & {
			source: string | URL;
			destination: string;
		},
	) => Promise<void>;
	listAll: (input?: StorageListOptions) => Promise<StorageList>;
	getVisibility: (input: StorageKey) => Promise<StorageVisibility>;
	setVisibility: (
		input: StorageKey & { visibility: StorageVisibility },
	) => Promise<void>;
	/** URL construction does not check existence or grant public access. */
	getUrl: (input: StorageKey) => Promise<string>;
	getSignedUrl: (input: StorageSignedUrlOptions) => Promise<string>;
	getSignedUploadUrl: (
		input: Omit<StorageSignedUrlOptions, 'contentDisposition'>,
	) => Promise<StorageSignedUpload>;
}

/** Typed access to configured storage drivers. */
export interface StorageServiceContract<
	KnownStorage extends Record<string, StorageDriverContract>,
> {
	default: () => StorageDriverContract;
	use: <Key extends keyof KnownStorage>(driver: Key) => KnownStorage[Key];
}
