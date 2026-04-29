import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const repoRoot = process.cwd();

function run(command, cwd = repoRoot) {
	return execSync(command, { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
}

function runInherit(command, cwd = repoRoot) {
	execSync(command, { cwd, stdio: 'inherit' });
}

const changed = run(
	"git diff --name-only HEAD~1 HEAD -- 'packages/*/jsr.json' || true",
)
	.split('\n')
	.map((s) => s.trim())
	.filter(Boolean);

if (changed.length === 0) {
	console.log('No jsr.json changes detected. Nothing to publish.');
	process.exit(0);
}

for (const jsrPath of changed) {
	const packageDir = resolve(repoRoot, dirname(jsrPath));
	const pkgPath = resolve(packageDir, 'package.json');

	if (!existsSync(pkgPath)) {
		console.log(`Skipping ${jsrPath}: no package.json`);
		continue;
	}

	const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

	if (pkg.private === true) {
		console.log(`Skipping ${pkg.name}: private package`);
		continue;
	}

	console.log(`Publishing ${pkg.name} from ${packageDir}`);

	runInherit('npx jsr publish', packageDir);
}
