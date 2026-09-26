import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DIST_SERVER = path.join(DIST_DIR, 'server');

console.log('[Build] Cleaning previous dist directory...');
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}

console.log('[Build] Building React client with Vite...');
execSync('npx vite build', { stdio: 'inherit' });

console.log('[Build] Bundling edge worker...');
fs.mkdirSync(DIST_SERVER, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(ROOT_DIR, 'worker', 'index.js')],
  bundle: true,
  outfile: path.join(DIST_SERVER, 'index.js'),
  format: 'esm',
  platform: 'neutral',
  target: 'esnext',
  external: ['node:sqlite', 'express', 'cors'],
});

console.log('[Build] Build complete! Client and worker generated in dist/.');
