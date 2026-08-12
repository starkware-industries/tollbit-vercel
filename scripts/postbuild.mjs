import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const BUILT_SHELL = resolve('public/index.html');
const SHELL_DESTINATION = resolve('dist/shell/index.html');

mkdirSync(dirname(SHELL_DESTINATION), { recursive: true });
renameSync(BUILT_SHELL, SHELL_DESTINATION);
rmSync(resolve('public/.vite'), { recursive: true, force: true });

console.log(`moved built shell → ${SHELL_DESTINATION}`);
console.log('public/ now holds only CDN-served assets');
