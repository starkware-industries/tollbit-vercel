/**
 * Dev-only entrypoint. Vite is imported here and nowhere reachable from server.ts, so it
 * never gets traced into the production function bundle.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { loadConfig } from '../shared/config';
import { createApp } from './app';
import { renderPage } from './render';

const config = loadConfig();
const app = createApp(config, false);

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
app.use(vite.middlewares);

app.get('/{*path}', async (req, res, next) => {
  try {
    const raw = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const template = await vite.transformIndexHtml(req.originalUrl, raw);
    res.type('html').send(renderPage(template, req.originalUrl));
  } catch (error) {
    vite.ssrFixStacktrace(error as Error);
    next(error);
  }
});

app.listen(config.originPort, () => {
  console.log(`[origin]    http://localhost:${config.originPort}  (mode=${config.mode}, dev)`);
  console.log(`[origin]    bot traffic → ${config.tollboothOrigin}`);
});
