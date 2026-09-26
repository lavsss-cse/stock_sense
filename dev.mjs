import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const processes = [
  spawn(process.execPath, ['--watch', 'server.mjs'], { stdio: 'inherit', shell: false }),
  spawn(isWindows ? 'npm.cmd' : 'npm', ['run', 'dev:client'], { stdio: 'inherit', shell: isWindows }),
];

function stop() {
  for (const child of processes) child.kill();
  process.exit();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
processes.forEach((child) => child.on('exit', (code) => code && stop()));
