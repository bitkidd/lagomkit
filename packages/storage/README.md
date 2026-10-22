# @lagomkit/storage

Typed file storage with interchangeable local filesystem and S3 drivers, using LagomKit's service factory pattern. The method set takes inspiration from [FlyDrive's disk API](https://flydrive.dev/docs/disk_api), with object arguments and a shared TypeScript contract.

The S3 driver uses `s3mini`, which has no runtime dependencies, instead of the AWS SDK. Both drivers target Node.js 24+.

## Install

```bash
pnpm add @lagomkit/storage
```

## Quick start

```ts
import {
	createLocalStorageDriver,
	createS3StorageDriver,
	createStorageService,
} from '@lagomkit/storage';

const storage = createStorageService({
	default: 'local',

	drivers: {
		local: createLocalStorageDriver({
			root: './storage',
			baseUrl: 'http://localhost:3000/uploads',
		}),
		s3: createS3StorageDriver({
			options: {
				// Include the bucket in the endpoint for path-style S3 services.
				endpoint: process.env.S3_ENDPOINT!,
				accessKeyId: process.env.S3_ACCESS_KEY_ID!,
				secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
				region: process.env.S3_REGION ?? 'us-east-1',
			},
		}),
	},
});

await storage.default().put({
	key: 'reports/hello.txt',
	contents: 'Hello world',
	contentType: 'text/plain',
});

const contents = await storage.default().get({ key: 'reports/hello.txt' });
const exists = await storage.use('s3').exists({ key: 'reports/hello.txt' });
```

`default()` returns the configured default driver. `use(key)` returns a named driver and preserves its concrete type. Drivers are independent; switching drivers does not migrate existing files.

## Common methods

All methods return promises. Both drivers implement `StorageDriverContract`, including methods that throw when unsupported.

| Method               | Input                                                    | Result                                                  |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| `put`                | `{ key, contents, contentType? }`                        | Write a string or `Uint8Array`                          |
| `putStream`          | `{ key, contents, contentType? }`                        | Write a Node.js `Readable`                              |
| `get`                | `{ key }`                                                | Complete UTF-8 string                                   |
| `getBytes`           | `{ key }`                                                | Complete `Uint8Array`                                   |
| `getStream`          | `{ key }`                                                | Node.js `Readable`                                      |
| `getMetaData`        | `{ key }`                                                | `{ contentLength, contentType?, etag?, lastModified? }` |
| `exists`             | `{ key }`                                                | Boolean; backend failures still throw                   |
| `delete`             | `{ key }`                                                | Delete a file; missing files succeed                    |
| `deleteAll`          | `{ prefix }`                                             | Delete files within a directory prefix                  |
| `copy`               | `{ source, destination }`                                | Copy within the same driver                             |
| `move`               | `{ source, destination }`                                | Move within the same driver                             |
| `copyFromFs`         | `{ source, destination, contentType? }`                  | Upload an absolute filesystem path or `file:` URL       |
| `moveFromFs`         | `{ source, destination, contentType? }`                  | Upload, then remove the filesystem source               |
| `listAll`            | `{ prefix?, recursive?, maxResults?, paginationToken? }` | `{ objects, paginationToken? }`                         |
| `getVisibility`      | `{ key }`                                                | `'public'` or `'private'`                               |
| `setVisibility`      | `{ key, visibility }`                                    | Change visibility when supported                        |
| `getUrl`             | `{ key }`                                                | Unsigned URL                                            |
| `getSignedUrl`       | `{ key, expiresIn?, contentType?, contentDisposition? }` | Signed download URL                                     |
| `getSignedUploadUrl` | `{ key, expiresIn?, contentType? }`                      | `{ url, method: 'PUT', headers }`                       |

Writes, copies, and moves overwrite existing destinations. Moving an S3 object copies it first and deletes the source only after the copy succeeds. This is not atomic: if deletion fails, the operation throws and both objects may remain. `moveFromFs` likewise keeps the source if uploading fails.

Keys are relative, slash-separated file names such as `avatars/user.jpg`. Absolute paths, traversal segments, repeated separators, backslashes, colons, control characters, and the internal `.lagomkit-upload-` prefix are rejected. Keys are literal, without URL decoding. Filesystem import methods accept trusted absolute paths outside the storage root; validate those paths in your application.

### Streams

```ts
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

await storage.default().putStream({
	key: 'videos/demo.mp4',
	contents: createReadStream('/absolute/path/demo.mp4'),
	contentType: 'video/mp4',
});

await pipeline(
	await storage.default().getStream({ key: 'videos/demo.mp4' }),
	createWriteStream('/absolute/path/download.mp4'),
);
```

Consume or destroy every returned download stream. `get` and `getBytes` buffer the full file; prefer streams for large files. S3 stream uploads use s3mini's multipart implementation, with bounded part buffering.

### Listings and deletion

`listAll()` lists the root. By default it returns direct files as `{ isFile: true, isDirectory: false, key }` and child directories as `{ isFile: false, isDirectory: true, prefix }`. Set `recursive: true` to return files at every depth, omitting directory entries.

Prefixes describe directories: `uploads` and `uploads/` both match `uploads/file.txt`, and exclude `uploads-backup/file.txt`. S3 listings return one page, with `maxResults` from 1 to 1000 (default 1000). Pass the returned `paginationToken` to retrieve the next page. Local listings return all entries and reject pagination options.

`deleteAll` follows every page and deletes files inside the prefix. An empty or missing prefix throws; use `{ prefix: '/' }` explicitly to delete all files. Local empty directories remain. These operations are not snapshots or transactions; concurrent writes may change the results.

### Signed URLs

```ts
const disk = storage.use('s3');

const downloadUrl = await disk.getSignedUrl({
	key: 'reports/hello.txt',
	expiresIn: 300,
	contentDisposition: 'attachment; filename="hello.txt"',
});

const upload = await disk.getSignedUploadUrl({
	key: 'avatars/user.png',
	expiresIn: 300,
	contentType: 'image/png',
});

// The client uploading the file must send the returned headers exactly.
await fetch(upload.url, {
	method: upload.method,
	headers: upload.headers,
	body: new Uint8Array([
		/* file bytes */
	]),
});
```

`expiresIn` is an integer number of seconds from 1 to 604800, defaulting to 1800. Signing does not make a network request or check file existence. Signed URLs use the S3 endpoint, even when a separate public `baseUrl` is configured. Browser uploads also require an appropriate bucket CORS policy.

## Driver configuration and capabilities

| Capability                                  | Local                       | S3                        |
| ------------------------------------------- | --------------------------- | ------------------------- |
| Reads, writes, streams, metadata, transfers | Supported                   | Supported                 |
| Directory listings                          | Supported                   | Supported                 |
| Paginated listings                          | Throws                      | Supported                 |
| Unsigned URLs                               | Requires `baseUrl`          | Endpoint URL or `baseUrl` |
| Signed downloads and uploads                | Throws                      | Supported                 |
| Read visibility                             | Configured mount visibility | Throws                    |
| Change per-file visibility                  | Throws                      | Throws                    |

### Local

`createLocalStorageDriver({ root, baseUrl?, visibility? })` creates the root lazily. Keep it application-owned. Existing symlinks below the root are rejected and excluded from listings. This is not an operating-system sandbox against another process replacing paths concurrently.

Writes use a temporary file and rename, so failed uploads leave existing contents intact. New files have mode `0600`; configure serving and permissions for your environment. The driver does not start an HTTP server. `baseUrl` identifies the HTTP location your application or web server serves, and `visibility` describes that mount (default `'private'`); it does not change permissions or expose files. `getUrl` only constructs a URL and grants no access.

Local metadata infers MIME types from extensions, falling back to `application/octet-stream`; it does not persist `contentType` supplied when writing. ETags are weak filesystem identifiers, not content hashes.

### S3

`createS3StorageDriver({ options, baseUrl? })` accepts native `s3mini` client options, including endpoint, credentials, region, and custom `fetch`. Alternatively pass `{ client, baseUrl? }` with an existing `S3mini` instance or a compatible `S3StorageClient`. `baseUrl` can point to a public CDN; it must be an HTTP(S) URL without credentials, query, or fragment.

S3 stores the supplied `contentType`, defaulting to `application/octet-stream`. Metadata uses response headers from a GET request and immediately cancels the body, because s3mini does not expose a complete HEAD metadata API. Visibility management is unsupported; configure access through bucket policies or your provider. SDK/service errors retain their original error as `cause` where available.

## Errors

All storage errors extend `StorageError`:
- `StorageInvalidKeyError`: invalid object key or deletion prefix.
- `StorageNotFoundError`: a requested source or file is missing.
- `StorageUnsupportedOperationError`: the driver cannot perform the requested operation; includes `driver` and `operation`.
- `StorageOperationError`: a backend, stream, or filesystem operation failed; includes `operation`, `key`, and the original `cause` where available.

Invalid configuration and listing page sizes throw `TypeError` or `RangeError`. Invalid signing lifetimes throw `StorageOperationError` with a `RangeError` cause. Unsupported methods always reject; they never silently succeed.

## Subpath imports

```ts
import { createStorageService } from '@lagomkit/storage/service';
import { createLocalStorageDriver } from '@lagomkit/storage/drivers/local';
import { createS3StorageDriver } from '@lagomkit/storage/drivers/s3';
import { StorageUnsupportedOperationError } from '@lagomkit/storage/helpers';
import type { StorageDriverContract } from '@lagomkit/storage/types';
```
