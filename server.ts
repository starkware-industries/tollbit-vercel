/**
 * Vercel only detects a server entrypoint at app/index/server.{ts,js} in the root or src/,
 * and vercel.json pins framework:"express" so the Vite preset doesn't claim the project and
 * build it as a static site. https://vercel.com/docs/frameworks/backend/express
 *
 * Deliberately synchronous and free of top-level await: the platform wraps this module's
 * default export. Dev, which needs an async Vite server, lives in server/dev.ts.
 */
import { readFileSync } from 'node:fs';
import { loadConfig } from './shared/config';
import { createApp, mountProductionClient } from './server/app';

// A URL relative to import.meta.url keeps this read statically analyzable, so the built
// shell gets traced into the function bundle.
const shellHtml = readFileSync(new URL('./dist/shell/index.html', import.meta.url), 'utf8');

const config = loadConfig();
const app = createApp(config, true);
mountProductionClient(app, shellHtml);

app.listen(config.originPort, () => {
  console.log(`[origin]    http://localhost:${config.originPort}  (mode=${config.mode})`);
  console.log(`[origin]    bot traffic → ${config.tollboothOrigin}`);
});

export default app;
