import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const folder = resolve('.local/function-bundle');
await mkdir(folder, { recursive: true });
await build({ entryPoints: ['src/function.ts'], outfile: folder + '/function.mjs', bundle: true,
  platform: 'node', format: 'esm', target: 'node22', sourcemap: false,
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" } });
const pkg = { name: 'labrelay-function', version: '0.2.0', private: true, type: 'module' };
await writeFile(folder + '/package.json', JSON.stringify(pkg, null, 2));
await writeFile(folder + '/package-lock.json', JSON.stringify({ name: pkg.name, version: pkg.version, lockfileVersion: 3,
  requires: true, packages: { '': { name: pkg.name, version: pkg.version } } }, null, 2));
const bundled = await readFile(folder + '/function.mjs', 'utf8');
if (bundled.includes('standard_') || bundled.includes('APPWRITE_API_KEY=')) throw new Error('Unexpected credential marker in the function bundle.');
const archive = resolve('.local/labrelay-function.tar.gz');
execFileSync('tar', ['-czf', archive, '-C', folder, 'function.mjs', 'package.json', 'package-lock.json']);
console.log('Prepared .local/labrelay-function.tar.gz: prebuilt Function and dependency-free deployment manifest.');
