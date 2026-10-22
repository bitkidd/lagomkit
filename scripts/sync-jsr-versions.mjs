import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packagesDir = fileURLToPath(new URL('../packages/', import.meta.url));

for (const directory of readdirSync(packagesDir, { withFileTypes: true })) {
	if (!directory.isDirectory()) {
		continue;
	}

	const packagePath = join(packagesDir, directory.name, 'package.json');
	const jsrPath = join(packagesDir, directory.name, 'jsr.json');

	if (!existsSync(packagePath) || !existsSync(jsrPath)) {
		continue;
	}

	const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
	const source = readFileSync(jsrPath, 'utf8');
	const jsr = JSON.parse(source);

	if (pkg.private || jsr.version === pkg.version) {
		continue;
	}

	if (jsr.name !== pkg.name) {
		throw new Error(`Package names do not match for ${directory.name}`);
	}

	jsr.version = pkg.version;
	const indent = source.match(/^[\t ]+(?=")/m)?.[0] ?? '\t';
	writeFileSync(jsrPath, `${JSON.stringify(jsr, null, indent)}\n`);
	console.log(`Updated ${pkg.name} JSR version to ${pkg.version}`);
}
