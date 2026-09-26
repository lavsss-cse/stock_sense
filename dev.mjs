import { spawn } from 'node:child_process';

const processes = [
  spawn(process.execPath, ['--watch', 'server.mjs'], { stdio: 'inherit' }),
  spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev:client'], { stdio: 'inherit' }),
];

function stop() {
  for (const child of processes) child.kill();
  process.exit();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
processes.forEach((child) => child.on('exit', (code) => code && stop()));
