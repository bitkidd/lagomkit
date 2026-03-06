import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import * as mailer from '#src/exports.js';

const packageJsonPath = fileURLToPath(
	new URL('../package.json', import.meta.url),
);
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
	exports?: Record<string, unknown>;
	imports?: Record<string, unknown>;
};

describe('Mailer::Exports', () => {
	test('should export expected factories from package entrypoint', () => {
		expect(mailer).toHaveProperty('createMailerService');
		expect(mailer.createMailerService).toEqual(expect.any(Function));
		expect(mailer).toHaveProperty('createSmtpMailerDriver');
		expect(mailer.createSmtpMailerDriver).toEqual(expect.any(Function));
	});

	test('should define public subpath exports in package manifest', () => {
		expect(packageJson.exports).toHaveProperty('./service');
		expect(packageJson.exports).toHaveProperty('./types');
		expect(packageJson.exports).toHaveProperty('./drivers/*');
		expect(packageJson.imports).toHaveProperty('#src/*');
	});
});
