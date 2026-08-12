import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type Express } from 'express';
import type { PlaygroundConfig } from '../shared/config';
import { AI_BOT_USER_AGENTS } from '../shared/bots';
import { ARTICLES, CURRENCY, findArticle } from '../shared/articles';
import {
  CLIENT_ASSET_DIR,
  ORIGIN_CATALOG_PATH,
  ORIGIN_CONTENT_PATH,
  SHELL_HTML_PATH,
  TOLLBIT_PUBLISHER_DASHBOARD,
} from '../shared/constants';
import { crawlAsAgent } from '../agent/crawler';
import { botGate } from './botGate';
import { articleSlug, renderPage } from './render';
import { clearTraffic, listTraffic } from './traffic';

/**
 * Resolved with a runtime value so bundlers (Vercel's included) don't trace Vite — a
 * devDependency — into the production function bundle.
 */
const DEV_SERVER_MODULE = process.env.DEV_SERVER_MODULE ?? 'vite';

export async function createApp(config: PlaygroundConfig, isProduction: boolean): Promise<Express> {
  const app = express();
  app.use(express.json());
  app.use(botGate(config));

  app.get('/robots.txt', (_req, res) => {
    const disallowAll = AI_BOT_USER_AGENTS.map(
      (bot) => `User-agent: ${bot}\nDisallow: /articles/`,
    ).join('\n\n');
    res.type('text/plain').send(
      `# Humans and search crawlers welcome.\nUser-agent: *\nAllow: /\n\n` +
        `# AI agents: paid access via TollBit at ${config.tollboothOrigin}\n${disallowAll}\n`,
    );
  });

  app.get(ORIGIN_CONTENT_PATH, (req, res) => {
    const path = typeof req.query.path === 'string' ? req.query.path : '';
    const slug = articleSlug(path) ?? path.replace(/^\/+/, '');
    const article = findArticle(slug);
    if (!article) {
      res.status(404).json({ error: `No content for ${path}` });
      return;
    }
    res.json({
      slug: article.slug,
      title: article.title,
      description: article.description,
      author: article.author,
      published: article.published,
      currency: CURRENCY,
      priceMicros: article.priceMicros,
      licenseType: article.licenseType,
      markdown: article.body,
    });
  });

  app.get(ORIGIN_CATALOG_PATH, (_req, res) => {
    res.json(
      ARTICLES.map((article) => ({
        contentUrl: `${config.publisherDomain}/articles/${article.slug}`,
        title: article.title,
        priceMicros: article.priceMicros,
        currency: CURRENCY,
        licenseType: article.licenseType,
      })),
    );
  });

  app.get('/api/config', (_req, res) => {
    res.json({
      mode: config.mode,
      tollboothOrigin: config.tollboothOrigin,
      publisherDomain: config.publisherDomain,
      hasTollbitKey: config.hasTollbitKey,
      botUserAgents: AI_BOT_USER_AGENTS,
      isProduction,
    });
  });

  app.get('/api/traffic', (_req, res) => {
    res.json(listTraffic());
  });

  app.delete('/api/traffic', (_req, res) => {
    clearTraffic();
    res.json([]);
  });

  app.get('/api/earnings', async (_req, res) => {
    if (config.mode === 'live') {
      res.json(liveEarnings());
      return;
    }
    const ledger = await fetchLedger(config, 'GET');
    if (!ledger) {
      res.status(502).json({ error: `Tollbooth unreachable at ${config.tollboothOrigin}` });
      return;
    }
    res.json({ source: 'mock', ...ledger });
  });

  app.delete('/api/earnings', async (_req, res) => {
    if (config.mode === 'live') {
      res.json(liveEarnings());
      return;
    }
    const ledger = await fetchLedger(config, 'DELETE');
    res.json({ source: 'mock', ...(ledger ?? { summary: null, transactions: [] }) });
  });

  app.post('/api/simulate-crawl', async (req, res) => {
    const { path, userAgent, maxPriceMicros, format, tokenType } = req.body ?? {};
    if (typeof path !== 'string' || !path.startsWith('/')) {
      res.status(400).json({ error: 'path must be an absolute path on this site' });
      return;
    }
    try {
      const result = await crawlAsAgent({
        path,
        userAgent,
        maxPriceMicros,
        format: format === 'json' ? 'json' : 'markdown',
        tokenType: tokenType === 'crawl' ? 'crawl' : 'content',
        config,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  await mountClient(app, isProduction);
  return app;
}

async function mountClient(app: Express, isProduction: boolean): Promise<void> {
  if (isProduction) {
    // On Vercel the CDN serves public/** and express.static is ignored; this is for
    // running the production build anywhere else.
    app.use(express.static(resolve(process.cwd(), CLIENT_ASSET_DIR), { index: false }));
    const template = readFileSync(resolve(process.cwd(), SHELL_HTML_PATH), 'utf8');
    app.get('/{*path}', (req, res) => {
      res.type('html').send(renderPage(template, req.originalUrl));
    });
    return;
  }

  const { createServer } = (await import(DEV_SERVER_MODULE)) as typeof import('vite');
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
}

function liveEarnings() {
  return {
    source: 'tollbit' as const,
    summary: null,
    transactions: [],
    dashboardUrl: TOLLBIT_PUBLISHER_DASHBOARD,
    note: 'Live mode: TollBit hosts the tollbooth and keeps the books. This page only reads the local mock ledger.',
  };
}

async function fetchLedger(
  config: PlaygroundConfig,
  method: 'GET' | 'DELETE',
): Promise<Record<string, unknown> | null> {
  const response = await fetch(`${config.tollboothOrigin}/__ledger`, { method }).catch(() => null);
  if (!response?.ok) return null;
  return (await response.json()) as Record<string, unknown>;
}
