import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const packagesDir = resolve(root, 'packages');
const dirs = readdirSync(packagesDir, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);

for (const dir of dirs) {
	const packageJsonPath = join(packagesDir, dir, 'package.json');
	const jsrJsonPath = join(packagesDir, dir, 'jsr.json');

	if (!existsSync(packageJsonPath) || !existsSync(jsrJsonPath)) {
		continue;
	}

	const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

	if (pkg.private === true) {
		continue;
	}

	const jsr = JSON.parse(readFileSync(jsrJsonPath, 'utf8'));

	jsr.version = pkg.version;

	writeFileSync(jsrJsonPath, `${JSON.stringify(jsr, null, '\t')}\n`, 'utf8');

	console.log(`Synced ${dir}: ${pkg.version}`);
}
