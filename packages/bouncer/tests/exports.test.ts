import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as bouncer from '#src/exports.js';

const packageJsonPath = fileURLToPath(
	new URL('../package.json', import.meta.url),
);
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
	exports?: Record<string, unknown>;
	imports?: Record<string, unknown>;
};

describe('Bouncer::Exports', () => {
	test('should export expected factories from package entrypoint', () => {
		expect(bouncer).toHaveProperty('createBouncerService');
		expect(bouncer).toHaveProperty('definePolicy');
		expect(bouncer.createBouncerService).toEqual(expect.any(Function));
		expect(bouncer.definePolicy).toEqual(expect.any(Function));
	});

	test('should define public subpath exports in package manifest', () => {
		expect(packageJson.exports).toHaveProperty('./service');
		expect(packageJson.exports).toHaveProperty('./types');
		expect(packageJson.imports).toHaveProperty('#src/*');
	});
});
