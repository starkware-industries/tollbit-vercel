import { MICRO_PRICE_PRECISION_THRESHOLD, MICROS_PER_UNIT } from './constants';

export type Article = {
  slug: string;
  title: string;
  description: string;
  author: string;
  published: string;
  tags: string[];
  /** Price an agent pays per fetch, in micro-units of USD. 50_000 = $0.05 */
  priceMicros: number;
  licenseType: 'ON_DEMAND_LICENSE' | 'OPEN_ACCESS';
  body: string;
};

export const CURRENCY = 'USD';

export const ARTICLES: Article[] = [
  {
    slug: 'why-crawlers-should-pay',
    title: 'Why Crawlers Should Pay',
    description:
      'The economics of the agentic web, and what changes when a fetch has a price attached to it.',
    author: 'Ofir I.',
    published: '2026-07-14',
    tags: ['economics', 'agents'],
    priceMicros: 50_000,
    licenseType: 'ON_DEMAND_LICENSE',
    body: `## The free-crawl bargain is over

For twenty years the deal was simple: search engines crawled your pages for free and
sent readers back. Impressions paid for the words. That loop is broken. An answer
engine reads the page, summarizes it, and the reader never arrives.

## Metering a fetch

If the visit will not be repaid in attention, it has to be repaid in cash. That means a
crawl needs three things it never had before:

1. **Identity** — the requester says who it is, verifiably.
2. **A price** — the publisher states a rate before content is handed over.
3. **Settlement** — the money moves without a human signing a contract per article.

TollBit supplies all three at the edge, which is why the integration is a redirect rule
rather than a rewrite of your CMS.

## What it feels like in practice

A bot hits an article. Your edge notices the user agent, and instead of serving 200 OK
it answers 302 to a tollbooth. The tollbooth asks for a token. No token, no body — just
a price list and instructions. The agent mints a token against its balance, retries, and
now both sides got what they wanted: the crawler has clean text, and the publisher has a
line item.`,
  },
  {
    slug: 'anatomy-of-a-402',
    title: 'Anatomy of a 402',
    description:
      'HTTP has had a Payment Required status code since 1997. It is finally getting used.',
    author: 'Ofir I.',
    published: '2026-07-22',
    tags: ['http', 'protocol'],
    priceMicros: 120_000,
    licenseType: 'ON_DEMAND_LICENSE',
    body: `## A status code waiting for a use case

\`402 Payment Required\` shipped in HTTP/1.1 as a placeholder. There was no way to say
*how much*, *to whom*, or *how*, so nobody sent it. Machine buyers change the calculus:
an agent can parse a price and decide, in a millisecond, whether the content is worth it.

## What a useful 402 carries

A payment challenge is only actionable if it answers every question the client has:

- the amount, in a unit small enough for a single article
- the currency
- the license the payment buys
- the endpoint that mints proof of payment
- how to present that proof on retry

Strip any one of those and the agent is left guessing.

## Retry semantics

The retry is a plain GET with one extra header. No cookies, no session, no redirect
dance. Tokens are short lived and bound to the requesting user agent, so an intercepted
token buys the attacker nothing after a few minutes.`,
  },
  {
    slug: 'robots-txt-was-never-a-fence',
    title: 'robots.txt Was Never a Fence',
    description:
      'A polite request is not access control. What replaces it when the crawler has a wallet.',
    author: 'Ofir I.',
    published: '2026-08-02',
    tags: ['policy', 'crawling'],
    priceMicros: 80_000,
    licenseType: 'ON_DEMAND_LICENSE',
    body: `## Honour system, meet incentive

\`robots.txt\` works exactly as well as the crawler wants it to. It has no teeth because
it was designed for a web where crawling was mutually beneficial. Disallow lines are
advisory, and the well behaved bots that respect them were never the problem.

## Enforcement moves to the edge

The replacement is not a better text file. It is a check that happens before your origin
answers: identify the requester, look up policy, and route accordingly. Allow, block, or
— the new third option — charge.

## Keeping the door open for humans

Whatever you build must not touch the human path. Readers should never see a token
prompt, and your Core Web Vitals should not move. That constraint is why bot handling
belongs in a redirect at the edge and not inside your application code.`,
  },
  {
    slug: 'open-access-note',
    title: 'About This Playground',
    description: 'A free page, deliberately left un-metered so you can compare the two paths.',
    author: 'Ofir I.',
    published: '2026-08-10',
    tags: ['meta'],
    priceMicros: 0,
    licenseType: 'OPEN_ACCESS',
    body: `## Free on purpose

This page is marked \`OPEN_ACCESS\`. Bots that ask for it still get identified and
logged, but the tollbooth hands over the body without a token and no transaction is
recorded.

Use it as your control: crawl this and a paid article back to back, and the only thing
that differs is the payment challenge.`,
  },
];

export function findArticle(slug: string): Article | undefined {
  return ARTICLES.find((article) => article.slug === slug);
}

export function formatMicros(micros: number, currency = CURRENCY): string {
  const units = micros / MICROS_PER_UNIT;
  const fractionDigits =
    units > 0 && units < MICRO_PRICE_PRECISION_THRESHOLD ? 6 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: fractionDigits,
  }).format(units);
}
