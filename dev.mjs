import { spawn } from 'node:child_process';

console.log('🌿 [StockSense · Business OS] Starting API server (port 8787) & Vite Client (port 5173)...');

const isWin = process.platform === 'win32';

const serverProc = spawn('node', ['server.mjs'], {
  stdio: 'inherit',
  shell: isWin,
});

const viteProc = spawn(isWin ? 'npx.cmd' : 'npx', ['vite', '--host'], {
  stdio: 'inherit',
  shell: isWin,
});

serverProc.on('error', (err) => {
  console.error('[Server Error]:', err);
});

viteProc.on('error', (err) => {
  console.error('[Vite Error]:', err);
});

function cleanup() {
  try {
    serverProc.kill();
  } catch {}
  try {
    viteProc.kill();
  } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
