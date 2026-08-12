# Edge redirect rules

Production equivalents of `server/botGate.ts`. Pick the one matching your stack, replace
`tollbit.yourdomain.com`, and keep the user-agent list in sync with `shared/bots.ts`.

The rule is always the same shape: **match AI bot user agents → 302 to your tollbit
subdomain, preserving the path**. Never rewrite or proxy — TollBit needs the redirect so
the bot ends up on a host it controls.

## Vercel WAF

Dashboard → Firewall → new rule:

- **If** `User Agent` `Matches expression` → paste `user-agent-expression.txt`
- **Then** `Redirect` → `https://tollbit.yourdomain.com`

Also add a log drain to `https://log.tollbit.com/log/vercel` with headers
`x-vercel-tollbit-verify` and `TollbitKey` for analytics.

## Cloudflare Worker

See `cloudflare-worker.js`. Deploy it in front of your origin route.

## nginx

See `nginx.conf` for a `map`-based version you can include in a `server` block.
