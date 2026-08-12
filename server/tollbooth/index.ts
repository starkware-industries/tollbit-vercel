import express from 'express';
import type { Request, Response } from 'express';
import {
  ACCEPT_CONTENT_HEADER,
  BPS_DIVISOR,
  DEFAULT_FEE_BPS,
  HTTP_PAYMENT_REQUIRED,
  KEY_HEADER,
  ORIGIN_CATALOG_PATH,
  ORIGIN_CONTENT_PATH,
  RATES_PATH,
  TOKEN_HEADER,
  TOKEN_PATH_CONTENT,
  TOKEN_PATH_CRAWL,
} from '../../shared/constants';
import { loadConfig } from '../../shared/config';
import { formatMicros } from '../../shared/articles';
import { listTransactions, recordTransaction, summarize, clearTransactions } from './ledger';
import { mintToken, tokenTtlSeconds, verifyToken, type TokenType } from './tokens';

type OriginContent = {
  slug: string;
  title: string;
  description: string;
  author: string;
  published: string;
  currency: string;
  priceMicros: number;
  licenseType: string;
  markdown: string;
};

const config = loadConfig();
const AUDIENCE = `tollbit.${config.publisherDomain}`;
const MARKDOWN_CONTENT_TYPE = 'text/markdown';

const app = express();
app.use(express.json());

app.post([TOKEN_PATH_CONTENT, TOKEN_PATH_CRAWL], async (req, res) => {
  const tokenType: TokenType = req.path.endsWith('/crawl') ? 'crawl' : 'content';
  const key = req.header(KEY_HEADER);
  if (!key) {
    res.status(401).json(problem(401, 'Missing TollbitKey header'));
    return;
  }

  const { url, userAgent, maxPriceMicros, currency, licenseType } = req.body ?? {};
  if (!url || !userAgent) {
    res.status(400).json(problem(400, 'url and userAgent are required'));
    return;
  }

  const token = await mintToken({
    url,
    userAgent,
    agentId: agentIdFromKey(key),
    audience: AUDIENCE,
    tokenType,
    maxPriceMicros,
    currency,
    licenseType,
  });

  res.json({ token, expiresInSeconds: tokenTtlSeconds(), tokenType });
});

app.get(`${RATES_PATH}/*contentUrl`, async (req, res) => {
  const content = await fetchOriginContent(`/${paramPath(req, 'contentUrl')}`);
  if (!content) {
    res.status(404).json(problem(404, 'No rate for that URL'));
    return;
  }
  res.json({ contentUrl: content.slug, rate: rateOf(content) });
});

app.get('/__ledger', (_req, res) => {
  res.json({ summary: summarize(), transactions: listTransactions() });
});

app.delete('/__ledger', (_req, res) => {
  clearTransactions();
  res.json({ summary: summarize(), transactions: [] });
});

app.get('/', async (_req, res) => {
  const catalog = await fetchOriginCatalog();
  res.json({
    propertyDomain: config.publisherDomain,
    message: 'TollBit-style tollbooth (playground mock). Paid content requires a token.',
    docs: 'https://docs.tollbit.com/docs/quickstart',
    catalog,
  });
});

app.get('/*path', async (req, res) => {
  const contentPath = `/${paramPath(req, 'path')}`;
  const content = await fetchOriginContent(contentPath);
  if (!content) {
    res.status(404).json(problem(404, `No metered content at ${contentPath}`));
    return;
  }

  const userAgent = req.header('user-agent') ?? '';
  const isFree = content.priceMicros === 0;
  const token = req.header(TOKEN_HEADER);

  if (!token && !isFree) {
    respondWithPaywall(res, content, contentPath);
    return;
  }

  if (token) {
    const rejection = await validateToken(token, userAgent, content);
    if (rejection) {
      res.status(rejection.status).json(problem(rejection.status, rejection.detail));
      return;
    }
  }

  const transaction = isFree
    ? null
    : recordTransaction({
        contentUrl: `${config.publisherDomain}${contentPath}`,
        slug: content.slug,
        agentId: await agentIdFromToken(token),
        userAgent,
        licenseType: content.licenseType,
        currency: content.currency,
        ...splitRevenue(content.priceMicros),
      });

  if (transaction) {
    res.setHeader('Tollbit-Transaction-Id', transaction.id);
    console.log(
      `[tollbooth] paid ${formatMicros(transaction.grossMicros)} for ${contentPath} — you net ${formatMicros(transaction.netMicros)}`,
    );
  }

  if (req.header(ACCEPT_CONTENT_HEADER)?.includes('markdown')) {
    res.type(MARKDOWN_CONTENT_TYPE).send(`# ${content.title}\n\n${content.markdown}`);
    return;
  }

  res.json({
    content: {
      header: `# ${content.title}`,
      body: content.markdown,
      footer: `© ${config.publisherDomain}`,
    },
    metadata: {
      title: content.title,
      description: content.description,
      author: content.author,
      published: content.published,
      modified: content.published,
    },
    rate: rateOf(content),
  });
});

app.listen(config.tollboothPort, () => {
  console.log(
    `[tollbooth] mock TollBit subdomain on http://localhost:${config.tollboothPort} (audience ${AUDIENCE})`,
  );
});

function respondWithPaywall(res: Response, content: OriginContent, contentPath: string): void {
  res
    .status(HTTP_PAYMENT_REQUIRED)
    .setHeader(
      'WWW-Authenticate',
      `Bearer realm="tollbit", charset="UTF-8", price_micros="${content.priceMicros}", currency="${content.currency}"`,
    )
    .json({
      ...problem(HTTP_PAYMENT_REQUIRED, `Payment required for ${contentPath}`),
      tollbit: {
        propertyDomain: config.publisherDomain,
        contentUrl: `${config.publisherDomain}${contentPath}`,
        rate: rateOf(content),
        tokenEndpoint: `http://localhost:${config.tollboothPort}${TOKEN_PATH_CONTENT}`,
        instructions: [
          `POST the token endpoint with headers { TollbitKey } and body { url, userAgent, maxPriceMicros, currency, licenseType }`,
          `Retry this GET with headers { ${TOKEN_HEADER}, User-Agent } — the token is bound to that exact User-Agent`,
        ],
        docs: 'https://docs.tollbit.com/docs/quickstart',
      },
    });
}

async function validateToken(
  token: string,
  userAgent: string,
  content: OriginContent,
): Promise<{ status: number; detail: string } | null> {
  try {
    const claims = await verifyToken(token, AUDIENCE);
    if (claims.x?.ua && claims.x.ua !== userAgent) {
      return { status: 403, detail: 'Token is bound to a different User-Agent' };
    }
    const maxPrice = claims.x?.mpm;
    if (claims.tt === 'content' && typeof maxPrice === 'number' && maxPrice < content.priceMicros) {
      return {
        status: HTTP_PAYMENT_REQUIRED,
        detail: `maxPriceMicros ${maxPrice} is below the rate ${content.priceMicros}`,
      };
    }
    return null;
  } catch (error) {
    return { status: 401, detail: `Invalid or expired token: ${(error as Error).message}` };
  }
}

function splitRevenue(priceMicros: number) {
  const feeBps = Number(process.env.TOLLBIT_FEE_BPS ?? DEFAULT_FEE_BPS);
  const feeMicros = Math.round((priceMicros * feeBps) / BPS_DIVISOR);
  return { grossMicros: priceMicros, feeMicros, netMicros: priceMicros - feeMicros };
}

function rateOf(content: OriginContent) {
  return {
    price: { priceMicros: content.priceMicros, currency: content.currency },
    license: { id: content.slug, licenseType: content.licenseType, permissions: [] },
  };
}

async function fetchOriginContent(contentPath: string): Promise<OriginContent | null> {
  const url = `${config.originUrl}${ORIGIN_CONTENT_PATH}?path=${encodeURIComponent(contentPath)}`;
  const response = await fetch(url).catch(() => null);
  if (!response?.ok) return null;
  return (await response.json()) as OriginContent;
}

async function fetchOriginCatalog(): Promise<unknown[]> {
  const response = await fetch(`${config.originUrl}${ORIGIN_CATALOG_PATH}`).catch(() => null);
  if (!response?.ok) return [];
  return (await response.json()) as unknown[];
}

async function agentIdFromToken(token: string | undefined): Promise<string> {
  if (!token) return 'anonymous';
  try {
    const claims = await verifyToken(token, AUDIENCE);
    return claims.x?.aid ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function agentIdFromKey(key: string): string {
  return `agent_${key.slice(0, KEY_PREFIX_LENGTH)}`;
}

function paramPath(req: Request, name: string): string {
  const value = (req.params as Record<string, string | string[]>)[name];
  return Array.isArray(value) ? value.join('/') : (value ?? '');
}

function problem(status: number, detail: string) {
  return {
    type: 'https://docs.tollbit.com/docs/quickstart',
    title: STATUS_TITLES[status] ?? 'Error',
    status,
    detail,
  };
}

const KEY_PREFIX_LENGTH = 6;

const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  [HTTP_PAYMENT_REQUIRED]: 'Payment Required',
};
