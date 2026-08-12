# Going live: your action items

What it takes to turn this playground into real money in your account. Everything in
`mock` mode already works — these are the steps only you can do, because they need a
domain you own, a TollBit account, and a payout method.

Ordered by dependency. Items marked **blocking** gate everything after them.

---

## Phase 1 — Things you need before touching code

### 1. Pick the domain you'll monetize · **blocking**
TollBit's paywall requires a `tollbit.<yourdomain>` subdomain that they host, and a DNS
record on the parent domain to prove you own it. There is no localhost path for this —
`live` mode cannot be tested without a real domain.

- [ ] Choose the domain (a throwaway one is fine for a playground)
- [ ] Confirm you have DNS admin on it
- [ ] Decide the host for the app itself (Vercel is the shortest path; the app is an Express
      server, which Vercel runs natively)

### 2. Create the TollBit publisher org · **blocking**
- [ ] Sign up at [app.tollbit.com](https://app.tollbit.com)
- [ ] Invite whoever is needed — TollBit's onboarding explicitly expects IT, legal and
      finance users, so self-serve may not cover everything

### 3. Ask TollBit these four questions
Don't skip this — three of them change your configuration, and the docs don't answer any
of them publicly.

- [ ] **What user agent does your content fetcher present, and from which IPs?**
      You must exclude it from the bot gate or you get an infinite redirect loop
      (see item 8).
- [ ] **What is my revenue share, and what is the payout mechanism / minimum threshold?**
      The `TOLLBIT_FEE_BPS=2000` in this repo is a placeholder I invented for the
      dashboard — it is not a real TollBit number.
- [ ] **Is publisher onboarding self-serve, or does it need a sales conversation?**
      The "invite legal and finance" step suggests a contract.
- [ ] **Do you support a staging/test property**, so you can verify the flow without
      putting a paywall in front of production traffic?

### 4. Payout details · **blocking for actually getting paid**
Metering works without this; money reaching you does not.

- [ ] Complete whatever banking / tax / entity paperwork TollBit requires
- [ ] Confirm where you'll see the balance and on what schedule it settles

---

## Phase 2 — Property setup in TollBit

### 5. Add and verify the property
- [ ] Add your domain as a property in the dashboard
- [ ] Add the DNS record TollBit gives you, and wait for verification to pass

### 6. Enable analytics
TollBit needs your traffic logs to show bot activity. Either a log drain or a cloud bucket.

- [ ] **On Vercel:** add a log drain to `https://log.tollbit.com/log/vercel` with the
      headers `x-vercel-tollbit-verify` and `TollbitKey` (your org secret), then verify
      the endpoint
- [ ] **Anywhere else:** POST newline-delimited JSON to `https://log.tollbit.com/log` with
      a `TollbitKey` header, including `timestamp`, `host`, `url`, `request_user_agent`,
      `response_status`, `request_referer`, `request_method` — or drop logs in an
      S3/GCS/R2 bucket with date-prefixed filenames

### 7. Configure the agent site and set rates
- [ ] Point `tollbit.<yourdomain>` at TollBit per their DNS instructions
- [ ] Set your per-path rates, licenses, and content controls in the marketplace UI.
      This is what actually prices your content in production — the `priceMicros` values in
      `shared/articles.ts` are only the playground's local stand-in
- [ ] Mark anything you want free as open access (the equivalent of `OPEN_ACCESS` here)

---

## Phase 3 — Your code and edge

### 8. Set the loop-protection bypass · **blocking, and easy to forget**
TollBit's tollbooth fetches your page back from your origin. If that fetch matches your bot
list, your own rule bounces it back to the tollbooth — forever.

- [ ] Set `TOLLBIT_BYPASS_USER_AGENTS` to the UA from item 3
- [ ] Optionally also set `TOLLBIT_BYPASS_HEADER` + `TOLLBIT_BYPASS_SECRET` and have your
      edge inject that header on TollBit's fetches
- [ ] Verify: a request with TollBit's UA returns `200`, a request with `GPTBot` returns
      `302`

```bash
curl -s -o /dev/null -w '%{http_code}\n' -A 'TollBit-Fetcher/1.0' https://yourdomain.com/articles/x  # want 200
curl -s -o /dev/null -w '%{http_code}\n' -A 'GPTBot/1.0'          https://yourdomain.com/articles/x  # want 302
```

### 9. Install the Vercel WAF redirect rule
This is the production bot gate. It runs at the edge, before your function boots, so bot
traffic costs you no compute.

- [ ] Firewall → new rule → **If** `User Agent` `Matches expression`, pasting
      `edge/user-agent-expression.txt`
- [ ] **Then** `Redirect` → `https://tollbit.yourdomain.com`
- [ ] Save **and publish** — Vercel stages firewall changes until you publish them
- [ ] Verify with the two curls in item 8 against the deployed URL

`server/botGate.ts` stays in the code as the local-dev gate and a fallback. The two don't
conflict: the WAF redirects before the function is ever invoked, so in production the
middleware only sees traffic the WAF let through. `edge/` also has Cloudflare Worker and
nginx versions if you ever move hosts.

Two rules whichever you choose: it must be a **302, not a rewrite or proxy**, and it must
**preserve the full path**.

### 10. Deploy the app on the real domain (Vercel)
The repo is already shaped for Vercel — see [Vercel notes](#vercel-notes) below for why
each piece is the way it is.

- [ ] `vercel link`, then `vercel deploy` (or connect the Git repo)
- [ ] Add the domain to the project and point `yourdomain.com` at it
- [ ] Set project env vars: `TOLLBIT_MODE=live`,
      `TOLLBIT_SUBDOMAIN=tollbit.yourdomain.com`, `PUBLISHER_DOMAIN=yourdomain.com`,
      plus the bypass vars from item 8
- [ ] Confirm the tollbooth service from this repo is **not** deployed — in live mode
      TollBit hosts that side. Nothing references it once `TOLLBIT_MODE=live`
- [ ] After deploying, confirm `curl https://yourdomain.com/articles/x | grep '<h1>'`
      returns the real headline. If it returns an empty `<div id="root">`, the CDN is
      serving a static shell and crawlers are getting nothing — see Vercel notes

### 11. Decide your robots.txt stance
Right now `server/index.ts` serves `Disallow: /articles/` for every AI bot. That's the
posture TollBit's model assumes — but note the consequence: a well-behaved crawler that
honours robots.txt will never reach your paywall, so it never pays.

- [ ] Decide whether you want compliant bots to skip you entirely, or to be told where to
      pay. Ask TollBit what they recommend advertising

---

## Phase 4 — Prove it end to end

### 12. Get an agent identity to test with
Publisher and developer accounts are separate.

- [ ] Register at [hack.tollbit.com](https://hack.tollbit.com), register an AgentID, copy
      the secret key from Dashboard → Access
- [ ] Set `TOLLBIT_KEY` locally

### 13. Run the real flow against your live site
```bash
TOLLBIT_MODE=live \
TOLLBIT_SUBDOMAIN=tollbit.yourdomain.com \
PUBLISHER_DOMAIN=yourdomain.com \
ORIGIN_URL=https://yourdomain.com \
TOLLBIT_KEY=... \
pnpm agent --path /articles/anatomy-of-a-402
```

Expect the same four hops you see locally: `302` → `402` → token `200` → content `200`.

- [ ] Also test with the real client: `npx @tollbit/tollbit-cli content pricing <url>` then
      `content fetch <url>`
- [ ] Confirm a human browser still gets `200` and normal page speed

### 14. Confirm the money
This is the only step that proves the whole thing works.

- [ ] Find the transaction in the TollBit publisher dashboard
- [ ] Check the amount matches the rate you set, minus their actual share
- [ ] Confirm it lands in your payout balance

The Earnings page in this app reads the **local mock** ledger. In live mode it will be
empty and that's expected — TollBit's dashboard is the real books. If you want the in-app
dashboard to keep working in live mode, wire it to TollBit's reporting API instead.

---

## Shortest path if you just want to see it work

Skip most of the above with a throwaway domain:

1. Buy a cheap domain
2. Deploy this app to Vercel on it
3. Create the TollBit org, add and DNS-verify the property, get `tollbit.<domain>` live
4. Ask TollBit for their fetcher UA, set the bypass, add the Vercel WAF rule
5. Set one non-zero rate on one path
6. Get a developer key, run `pnpm agent` against the live URL, confirm the transaction
   appears in the dashboard

Items 4, 5, 8 and 14 are the ones that actually break if skipped.

---

## Vercel notes

Four things in this repo exist specifically because of how Vercel runs an Express app. If
you refactor, don't undo them.

### The entrypoint must be `server.ts` at the root
Vercel only detects a server entrypoint at `app.*`, `index.*` or `server.*` in the root or
in `src/`. A directory called `server/` containing `index.ts` is **not** detected. So
`server.ts` at the root builds the app and both calls `app.listen()` and default-exports
it; the real routes live in `server/app.ts`.

### `express.static()` does nothing on Vercel
Documented limitation: static assets must be in `public/**`, served by the CDN. So Vite
builds straight to `public/`, and `express.static` is kept only so `pnpm start:origin`
works when you run the production build somewhere else.

### The HTML shell is deliberately *not* in `public/`
This is the subtle one. If `public/index.html` existed, the CDN would serve it directly at
page routes and bypass `server/render.ts` — so TollBit and every crawler would extract an
empty `<div id="root">` instead of your article. `scripts/postbuild.mjs` moves the built
shell to `dist/shell/index.html`, which keeps page requests flowing through the function
where the article HTML gets injected. Hashed assets under `/assets/*` still come from the
CDN with a one-year immutable cache (`vercel.json`).

Verify after any build change:
```bash
curl -s https://yourdomain.com/articles/anatomy-of-a-402 | grep -c '<h1>Anatomy'   # want 1
```

### Vite is imported by a runtime-resolved name
`server/app.ts` imports the dev server via `process.env.DEV_SERVER_MODULE ?? 'vite'` rather
than a literal. A literal `await import('vite')` would be statically traced into the
production function bundle even though production never runs it — and Vite is a
devDependency.

### What does not survive serverless
- **The mock ledger** wrote to `data/ledger.json`. Serverless filesystems are read-only, so
  it now degrades to in-memory with a warning. Irrelevant in live mode (TollBit keeps the
  books), which is why the Earnings page shows a pointer to their dashboard instead of
  fake numbers when `TOLLBIT_MODE=live`.
- **The traffic log** is per function instance and resets on redeploy. Fine as a live
  demo, not a record. TollBit's analytics and your Vercel logs are the record.

If you later want the full mock playground deployed publicly (so anyone can run the paid
loop without a TollBit account), it needs a real store for the ledger and a second Vercel
project so the `302` genuinely crosses origins.

### Config
`vercel.json` sets the build command and the asset cache header. Vercel now also supports a
typed `vercel.ts` via `@vercel/config` — worth switching to if this config grows, but it
pulls in extra dependencies for what is currently one header.
