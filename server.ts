/**
 * Vercel only detects a server entrypoint at app/index/server.{ts,js} in the root or src/,
 * so this file — not server/app.ts — is what the platform boots.
 * https://vercel.com/docs/frameworks/backend/express
 */
import { loadConfig } from './shared/config';
import { createApp } from './server/app';

const config = loadConfig();
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

const app = await createApp(config, isProduction);

app.listen(config.originPort, () => {
  console.log(`[origin]    http://localhost:${config.originPort}  (mode=${config.mode})`);
  console.log(`[origin]    bot traffic → ${config.tollboothOrigin}`);
});

export default app;
