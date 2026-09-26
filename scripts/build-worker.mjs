import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
execFileSync(process.execPath, [resolve(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', 'dist/client'], { cwd: root, stdio: 'inherit' });
const page = await readFile(resolve(dist, 'client', 'index.html'), 'utf8');
const favicon = await readFile(resolve(root, 'public', 'favicon.svg'), 'utf8');
await mkdir(resolve(dist, 'server'), { recursive: true });
await build({
  entryPoints: [resolve(root, 'worker', 'index.js')], outfile: resolve(dist, 'server', 'index.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  plugins: [{ name: 'stocksense-virtual-assets', setup(builder) {
    builder.onResolve({ filter: /^virtual:stocksense-(html|favicon)$/ }, (args) => ({ path: args.path, namespace: 'stocksense' }));
    builder.onLoad({ filter: /.*/, namespace: 'stocksense' }, (args) => ({ contents: args.path.endsWith('html') ? page : favicon, loader: 'text' }));
  } }],
});
await mkdir(resolve(dist, '.openai'), { recursive: true });
await cp(resolve(root, '.openai', 'hosting.json'), resolve(dist, '.openai', 'hosting.json'));
await cp(resolve(root, 'drizzle'), resolve(dist, '.openai', 'drizzle'), { recursive: true });
console.log('Built StockSense client, Worker API, and database migrations.');
