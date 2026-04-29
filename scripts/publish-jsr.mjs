import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = process.cwd();

function runInherit(command, cwd = repoRoot) {
	execSync(command, { cwd, stdio: 'inherit' });
}

const packagesDir = resolve(repoRoot, 'packages');
const packageNames = readdirSync(packagesDir, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);

for (const packageName of packageNames) {
	const packageDir = resolve(packagesDir, packageName);
	const pkgPath = resolve(packageDir, 'package.json');
	const jsrPath = join(packageDir, 'jsr.json');

	if (!existsSync(pkgPath) || !existsSync(jsrPath)) {
		console.log(`Skipping ${packageName}: missing package.json or jsr.json`);
		continue;
	}

	const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

	if (pkg.private === true) {
		console.log(`Skipping ${pkg.name}: private package`);
		continue;
	}

	console.log(`Publishing ${pkg.name} from ${packageDir}`);

	runInherit('pnpx jsr publish', packageDir);
}
