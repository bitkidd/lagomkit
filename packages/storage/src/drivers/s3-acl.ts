import { createHash } from 'node:crypto';
import { parseXml, XmlElement } from '@rgrove/parse-xml';
import { S3ServiceError, type S3mini } from 's3mini';
import { StorageUnsupportedOperationError } from '../helpers.js';
import type { StorageVisibility } from '../types.js';

const ALL_USERS = 'http://acs.amazonaws.com/groups/global/AllUsers';
const UNSUPPORTED_ACL_CODES = new Set([
	'AccessControlListNotSupported',
	'NotImplemented',
	'NotSupported',
	'OperationNotSupported',
	'UnsupportedOperation',
]);

function nameOf(element: XmlElement): string {
	return element.name.split(':').at(-1) ?? element.name;
}

function child(element: XmlElement, name: string): XmlElement | undefined {
	return element.children.find((node): node is XmlElement => {
		return node instanceof XmlElement && nameOf(node) === name;
	});
}

function readVisibility(body: string): StorageVisibility {
	const policy = parseXml(body).root;
	const acl = policy && child(policy, 'AccessControlList');

	if (!policy || nameOf(policy) !== 'AccessControlPolicy' || !acl) {
		throw new Error('S3 response has no valid access control policy');
	}

	let visibility: StorageVisibility = 'private';

	for (const grant of acl.children) {
		if (!(grant instanceof XmlElement) || nameOf(grant) !== 'Grant') {
			continue;
		}

		const grantee = child(grant, 'Grantee');
		const permission = child(grant, 'Permission')?.text.trim();

		if (!grantee || !permission) {
			throw new Error('S3 response has an invalid ACL grant');
		}

		// Visibility describes anonymous read access in the ACL, not effective
		// access through bucket policies, Block Public Access, or a CDN.
		if (
			child(grantee, 'URI')?.text.trim() === ALL_USERS &&
			(permission === 'READ' || permission === 'FULL_CONTROL')
		) {
			visibility = 'public';
		}
	}

	return visibility;
}

function readErrorCode(body: string): string | undefined {
	try {
		const error = parseXml(body).root;

		if (error && nameOf(error) === 'Error') {
			return child(error, 'Code')?.text.trim();
		}
	} catch {
		// Some providers return plain text or HTML errors; retain the HTTP status.
	}

	return undefined;
}

/** Uses the public presigner because s3mini has no dedicated object ACL methods. */
export function createS3AclClient(config: {
	client: Pick<S3mini, 'getPresignedUrl'>;
	fetch: typeof globalThis.fetch;
	requestAbortTimeout?: number;
}) {
	const request = async (
		method: 'GET' | 'PUT',
		key: string,
		headers: Record<string, string> = {},
	): Promise<Response> => {
		const url = await config.client.getPresignedUrl(
			method,
			key,
			60,
			{ acl: '' },
			headers,
		);
		const response = await config.fetch(url, {
			method,
			headers,
			redirect: 'error',
			...(config.requestAbortTimeout
				? { signal: AbortSignal.timeout(config.requestAbortTimeout) }
				: {}),
		});

		if (!response.ok) {
			const body = await response.text();
			const code =
				response.headers.get('x-amz-error-code') ?? readErrorCode(body);

			const error = new S3ServiceError(
				`S3 returned ${response.status} – ${code ?? response.statusText}`,
				response.status,
				code,
				body,
			);

			if (
				response.status === 405 ||
				response.status === 501 ||
				UNSUPPORTED_ACL_CODES.has(code ?? '')
			) {
				throw new StorageUnsupportedOperationError(
					's3',
					method === 'GET' ? 'getVisibility' : 'setVisibility',
					{ cause: error },
				);
			}

			throw error;
		}

		return response;
	};

	return {
		getVisibility: async (key: string): Promise<StorageVisibility> => {
			const response = await request('GET', key);

			return readVisibility(await response.text());
		},
		setVisibility: async (
			key: string,
			visibility: StorageVisibility,
		): Promise<void> => {
			if (visibility !== 'public' && visibility !== 'private') {
				throw new TypeError('S3 storage visibility must be public or private');
			}

			const response = await request('PUT', key, {
				'x-amz-acl': visibility === 'public' ? 'public-read' : 'private',
				// Send S3's integrity checksum for the empty canned-ACL request body.
				'content-md5': createHash('md5').update('').digest('base64'),
			});
			await response.body?.cancel();
		},
	};
}
