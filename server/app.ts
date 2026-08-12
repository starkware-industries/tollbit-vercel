import { resolve } from 'node:path';
import express, { type Express } from 'express';
import type { PlaygroundConfig } from '../shared/config';
import { AI_BOT_USER_AGENTS } from '../shared/bots';
import { ARTICLES, CURRENCY, findArticle } from '../shared/articles';
import {
  CLIENT_ASSET_DIR,
  ORIGIN_CATALOG_PATH,
  ORIGIN_CONTENT_PATH,
  TOLLBIT_PUBLISHER_DASHBOARD,
} from '../shared/constants';
import { crawlAsAgent } from '../agent/crawler';
import { botGate } from './botGate';
import { articleSlug, renderPage } from './render';
import { clearTraffic, listTraffic } from './traffic';

/**
 * Routes only — the client is mounted by the caller, because production and dev mount it
 * very differently and only the dev path may touch Vite.
 */
export function createApp(config: PlaygroundConfig, isProduction: boolean): Express {
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

  return app;
}

/**
 * `shellHtml` is passed in rather than read here so the only filesystem read of build
 * output lives in the entrypoint, where Vercel's file tracer can see it.
 */
export function mountProductionClient(app: Express, shellHtml: string): void {
  // On Vercel the CDN serves public/** and express.static is ignored; this is for running
  // the production build anywhere else.
  app.use(express.static(resolve(process.cwd(), CLIENT_ASSET_DIR), { index: false }));
  app.get('/{*path}', (req, res) => {
    res.type('html').send(renderPage(shellHtml, req.originalUrl));
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
