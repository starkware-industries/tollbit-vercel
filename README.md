# TollBit Playground

A Vite + React SPA that charges AI crawlers for its content, end to end. Humans read for
free; anything that identifies itself as an AI agent gets redirected to a tollbooth, shown
a price, and served only after it pays — and you can watch the money land on the Earnings
page.

It runs fully offline against a bundled mock of TollBit, and flips to your real TollBit
subdomain with two env vars.

```bash
pnpm install
pnpm dev          # origin :5173 + mock tollbooth :5174
pnpm agent        # crawl the site as a paying agent and print every hop
```

Then open http://localhost:5173 — read an article, hit **Run crawl** at the bottom, and
check **Earnings**.

## Why there is a server

TollBit's paywall is not something a static SPA can do. The integration TollBit documents
is an *edge rule*: match AI bot user agents and `302` them to a DNS-verified
`tollbit.<yourdomain>` subdomain that TollBit hosts, which serves the paywall, takes the
payment, and pays you. So this repo ships a thin origin server that plays the part of your
CDN/WAF, plus a local stand-in for the TollBit side so the whole loop is testable on
localhost.

```
browser  ──────────────────────────────────────────────▶  origin :5173  ──▶ SPA + article HTML

AI bot   ──▶ origin :5173 ──302──▶ tollbooth :5174 ──402 price──▶ agent
                                        ▲                            │
                                        └────── Tollbit-Token ───────┘
                                   200 + content, transaction recorded
```

## The flow, concretely

| # | Step | What happens |
|---|------|--------------|
| 1 | `GET /articles/x` with `User-Agent: GPTBot/1.0` | `server/botGate.ts` matches the UA against TollBit's published bot list and answers `302` to the tollbooth, path preserved |
| 2 | `GET tollbooth/articles/x` | No token → `402 Payment Required` with rate, license, token endpoint and retry instructions |
| 3 | `POST /tollbit/dev/v2/tokens/content` | With `TollbitKey` and a `maxPriceMicros` ceiling → short-lived JWT bound to that exact user agent |
| 4 | `GET tollbooth/articles/x` with `Tollbit-Token` | Content served, transaction recorded, gross split into TollBit's fee and your net |

Things the mock enforces, because the real one does: tokens expire (5 min), a token used
with a different `User-Agent` gets `403`, a `maxPriceMicros` below the rate gets `402`, and
`OPEN_ACCESS` content is served with no token and no transaction.

## Layout

```
server.ts       Vercel's detected entrypoint — builds the app, listens, default-exports it
shared/         articles + rates, bot user-agent list, constants, env config
server/
  app.ts        origin: SPA, crawlable article HTML, /api/*, /__origin/* content feed
  botGate.ts    stands in for your CDN/WAF rule (production uses a Vercel WAF rule)
  render.ts     injects real article HTML + JSON-LD into the shell so crawlers see content
  tollbooth/    local stand-in for TollBit: paywall, token minting/verify, ledger
agent/
  crawler.ts    the four-step flow, used by both the CLI and the in-page simulator
  crawl.ts      `pnpm agent` CLI
src/            the SPA — articles, Earnings dashboard, Integration status
```

`server/render.ts` matters more than it looks: TollBit extracts content from your public
page, so the origin serves real HTML with the article body, meta tags and JSON-LD rather
than an empty SPA shell. React replaces it on mount.

## Deploying to Vercel

Shaped for it already: `server.ts` is at the root because that's where Vercel looks for a
server entrypoint, the client builds to `public/` because `express.static()` is ignored
there, and the HTML shell is deliberately kept **out** of `public/` so page requests reach
the function and get real article HTML injected instead of the CDN serving an empty shell.
The details, and what doesn't survive serverless, are in
[GOING-LIVE.md § Vercel notes](./GOING-LIVE.md#vercel-notes).

```bash
vercel link && vercel deploy
```

Production uses a Vercel WAF rule as the bot gate rather than the in-app middleware, so bot
traffic never wakes a function.

## Commands

| Command | What |
|---|---|
| `pnpm dev` | origin + tollbooth with HMR |
| `pnpm build` | client bundle → `public/`, shell → `dist/shell/` (see Vercel notes) |
| `pnpm start` | serve the production build locally, origin + tollbooth |
| `pnpm start:origin` | origin only — what production looks like in live mode |
| `pnpm agent` | crawl as an agent; `--path`, `--ua`, `--max-price`, `--format json\|markdown`, `--token-type content\|crawl` |
| `pnpm typecheck` | `tsc --noEmit` |

Try the failure paths:

```bash
pnpm agent --path /articles/anatomy-of-a-402 --max-price 10000   # 402, budget too low
pnpm agent --path /articles/open-access-note                     # free, no transaction
curl -s -A "GPTBot/1.0" -i localhost:5173/articles/anatomy-of-a-402 | head -4   # the 302
```

## Configuration

Copy `.env.example` to `.env`. The one that matters is `TOLLBIT_MODE`:

- **`mock`** (default) — bots go to the bundled tollbooth. No TollBit account needed.
- **`live`** — bots go to your real `tollbit.<yourdomain>`; the agent mints tokens against
  `gateway.tollbit.com` using `TOLLBIT_KEY`.
- **`off`** — bot gate disabled, everything free. Useful as a control.

`TOLLBIT_FEE_BPS` (default `2000` = 20%) is a **playground assumption** used only to show a
gross/fee/net split on the dashboard. Your real revenue share comes from your TollBit
contract.

## Going live

**See [GOING-LIVE.md](./GOING-LIVE.md) for the full checklist**, including the two things
that silently break it: the loop-protection bypass, and the questions you have to ask
TollBit because the docs don't answer them. The short version:

1. Create an org at [app.tollbit.com](https://app.tollbit.com), add your property, verify
   it with the DNS record TollBit gives you.
2. Point `tollbit.yourdomain.com` at TollBit, and enable analytics (log drain or bucket).
3. Set rates, licenses and free paths in the marketplace UI. The per-article
   `priceMicros` in `shared/articles.ts` is the playground's local equivalent.
4. Install the redirect rule at your edge. `edge/` has ready-made snippets for Vercel WAF,
   a Cloudflare Worker, and nginx, all using the same user-agent list as `shared/bots.ts`.
5. Set `TOLLBIT_MODE=live`, `TOLLBIT_SUBDOMAIN=tollbit.yourdomain.com`,
   `PUBLISHER_DOMAIN=yourdomain.com`. To crawl your own live site as a paying agent, add
   `TOLLBIT_KEY` from the [developer dashboard](https://hack.tollbit.com).

In live mode the tollbooth in this repo is unused — TollBit hosts it. What stays yours is
the bot gate, the crawlable HTML, and the rates.

Docs: [edge redirect](https://docs.tollbit.com/docs/other) ·
[architecture](https://docs.tollbit.com/docs/platform-architecture) ·
[agent quickstart](https://docs.tollbit.com/docs/quickstart) ·
[rates](https://docs.tollbit.com/docs/setting-rates)
