import {
  ACCEPT_CONTENT_HEADER,
  DEFAULT_AGENT_USER_AGENT,
  DEFAULT_MAX_PRICE_MICROS,
  DEV_TOLLBIT_KEY,
  HTTP_FOUND,
  HTTP_OK,
  HTTP_PAYMENT_REQUIRED,
  KEY_HEADER,
  TOKEN_HEADER,
  TOKEN_PATH_CONTENT,
  TOKEN_PATH_CRAWL,
  TOLLBIT_GATEWAY_URL,
} from '../shared/constants';
import type { PlaygroundConfig } from '../shared/config';

export type CrawlStep = {
  label: string;
  request: string;
  status: number | null;
  note: string;
  detail?: unknown;
};

export type CrawlResult = {
  ok: boolean;
  steps: CrawlStep[];
  transactionId: string | null;
  pricePaidMicros: number | null;
  currency: string | null;
  content: string | null;
};

export type CrawlOptions = {
  path: string;
  userAgent?: string;
  maxPriceMicros?: number;
  tokenType?: 'content' | 'crawl';
  format?: 'json' | 'markdown';
  config: PlaygroundConfig;
};

export async function crawlAsAgent(options: CrawlOptions): Promise<CrawlResult> {
  const userAgent = options.userAgent ?? DEFAULT_AGENT_USER_AGENT;
  const maxPriceMicros = options.maxPriceMicros ?? DEFAULT_MAX_PRICE_MICROS;
  const { config } = options;
  const steps: CrawlStep[] = [];

  const originUrl = `${config.originUrl}${options.path}`;
  const hop = await fetch(originUrl, { headers: { 'user-agent': userAgent }, redirect: 'manual' });

  if (hop.status !== HTTP_FOUND) {
    steps.push({
      label: 'Crawl the publisher origin',
      request: `GET ${originUrl}`,
      status: hop.status,
      note:
        hop.status === HTTP_OK
          ? 'Served straight from origin — no paywall in front of this bot (TOLLBIT_MODE=off?)'
          : 'Expected a 302 to the tollbit subdomain',
    });
    return {
      ok: hop.status === HTTP_OK,
      steps,
      transactionId: null,
      pricePaidMicros: null,
      currency: null,
      content: hop.status === HTTP_OK ? await hop.text() : null,
    };
  }

  const tollboothUrl = hop.headers.get('location') ?? '';
  steps.push({
    label: 'Crawl the publisher origin',
    request: `GET ${originUrl}`,
    status: hop.status,
    note: `Edge recognised the bot user agent and redirected to ${tollboothUrl}`,
  });

  const unpaid = await fetch(tollboothUrl, { headers: { 'user-agent': userAgent } });
  const challenge = await readBody(unpaid);

  if (unpaid.status === HTTP_OK) {
    steps.push({
      label: 'Request content without a token',
      request: `GET ${tollboothUrl}`,
      status: unpaid.status,
      note: 'Open access — content returned with no payment',
    });
    return {
      ok: true,
      steps,
      transactionId: null,
      pricePaidMicros: 0,
      currency: null,
      content: asText(challenge),
    };
  }

  if (unpaid.status !== HTTP_PAYMENT_REQUIRED) {
    steps.push({
      label: 'Request content without a token',
      request: `GET ${tollboothUrl}`,
      status: unpaid.status,
      note: 'Unexpected response from the tollbooth',
      detail: challenge,
    });
    return { ok: false, steps, transactionId: null, pricePaidMicros: null, currency: null, content: null };
  }

  const rate = extractRate(challenge);
  steps.push({
    label: 'Request content without a token',
    request: `GET ${tollboothUrl}`,
    status: unpaid.status,
    note: rate
      ? `Payment required: ${rate.priceMicros} micros ${rate.currency} (${rate.licenseType})`
      : 'Payment required',
    detail: challenge,
  });

  const tokenEndpoint = resolveTokenEndpoint(challenge, config, options.tokenType ?? 'content');
  const tollbitKey = process.env.TOLLBIT_KEY ?? DEV_TOLLBIT_KEY;
  const contentUrl = `${config.publisherDomain}${options.path}`;

  const tokenResponse = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { [KEY_HEADER]: tollbitKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      url: contentUrl,
      userAgent,
      maxPriceMicros,
      currency: rate?.currency ?? 'USD',
      licenseType: rate?.licenseType ?? 'ON_DEMAND_LICENSE',
    }),
  });
  const tokenBody = await readBody(tokenResponse);
  const token = extractToken(tokenBody);

  steps.push({
    label: 'Mint a payment token',
    request: `POST ${tokenEndpoint}`,
    status: tokenResponse.status,
    note: token
      ? `Signed token issued for ${contentUrl}, bound to this user agent`
      : 'Failed to mint a token',
    detail: token ? undefined : tokenBody,
  });

  if (!token) {
    return { ok: false, steps, transactionId: null, pricePaidMicros: null, currency: null, content: null };
  }

  const headers: Record<string, string> = { 'user-agent': userAgent, [TOKEN_HEADER]: token };
  if (options.format === 'markdown') headers[ACCEPT_CONTENT_HEADER] = 'text/markdown';

  const paid = await fetch(tollboothUrl, { headers });
  const paidBody = await readBody(paid);
  const transactionId = paid.headers.get('tollbit-transaction-id');

  steps.push({
    label: 'Retry with the token',
    request: `GET ${tollboothUrl}`,
    status: paid.status,
    note:
      paid.status === HTTP_OK
        ? `Paid and served${transactionId ? ` (transaction ${transactionId})` : ''}`
        : 'Tollbooth rejected the token',
    detail: paid.status === HTTP_OK ? undefined : paidBody,
  });

  return {
    ok: paid.status === HTTP_OK,
    steps,
    transactionId,
    pricePaidMicros: rate?.priceMicros ?? null,
    currency: rate?.currency ?? null,
    content: paid.status === HTTP_OK ? asText(paidBody) : null,
  };
}

function resolveTokenEndpoint(
  challenge: unknown,
  config: PlaygroundConfig,
  tokenType: 'content' | 'crawl',
): string {
  const advertised = asRecord(asRecord(challenge)?.tollbit)?.tokenEndpoint;
  if (typeof advertised === 'string' && tokenType === 'content') return advertised;
  const base = config.mode === 'live' ? TOLLBIT_GATEWAY_URL : config.tollboothOrigin;
  return `${base}${tokenType === 'crawl' ? TOKEN_PATH_CRAWL : TOKEN_PATH_CONTENT}`;
}

function extractRate(
  challenge: unknown,
): { priceMicros: number; currency: string; licenseType: string } | null {
  const rate = asRecord(asRecord(asRecord(challenge)?.tollbit)?.rate);
  const price = asRecord(rate?.price);
  const license = asRecord(rate?.license);
  if (!price || typeof price.priceMicros !== 'number') return null;
  return {
    priceMicros: price.priceMicros,
    currency: typeof price.currency === 'string' ? price.currency : 'USD',
    licenseType: typeof license?.licenseType === 'string' ? license.licenseType : 'ON_DEMAND_LICENSE',
  };
}

function extractToken(body: unknown): string | null {
  const record = asRecord(body);
  for (const key of ['token', 'accessToken', 'tollbitToken']) {
    const value = record?.[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function asText(body: unknown): string {
  return typeof body === 'string' ? body : JSON.stringify(body, null, 2);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}
