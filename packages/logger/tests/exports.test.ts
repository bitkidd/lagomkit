import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import * as logger from '#src/exports.js';

const packageJson = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { exports: Record<string, unknown>; imports: Record<string, unknown> };

describe('Logger::Exports', () => {
	test('should export the service and both driver factories', () => {
		expect(logger.createLoggerService).toEqual(expect.any(Function));
		expect(logger.createConsolaLoggerDriver).toEqual(expect.any(Function));
		expect(logger.createAxiomLoggerDriver).toEqual(expect.any(Function));
	});

	test('should expose the standard package subpaths', () => {
		expect(packageJson.exports).toHaveProperty('.');
		expect(packageJson.exports).toHaveProperty('./service');
		expect(packageJson.exports).toHaveProperty('./types');
		expect(packageJson.exports).toHaveProperty('./drivers/*');
		expect(packageJson.imports).toHaveProperty('#src/*');
	});
});
