import type { NextFunction, Request, Response } from 'express';
import { matchAiBot } from '../shared/bots';
import { BOT_MATCH_HEADER, HTTP_FOUND } from '../shared/constants';
import type { PlaygroundConfig } from '../shared/config';
import { logTraffic } from './traffic';

/**
 * Stands in for the CDN/WAF rule TollBit asks publishers to install: match an AI bot
 * user agent and 302 it to the tollbit subdomain, preserving the request path.
 * See https://docs.tollbit.com/docs/other
 */
export function botGate(config: PlaygroundConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (isInfrastructurePath(req.path)) {
      next();
      return;
    }

    const userAgent = req.header('user-agent') ?? '';

    if (isBypassed(req, config, userAgent)) {
      next();
      return;
    }

    const botMatch = matchAiBot(userAgent);

    if (!botMatch) {
      logTraffic({ method: req.method, path: req.originalUrl, userAgent, botMatch: null, action: 'human' });
      next();
      return;
    }

    if (config.mode === 'off') {
      logTraffic({ method: req.method, path: req.originalUrl, userAgent, botMatch, action: 'bot-allowed' });
      res.setHeader(BOT_MATCH_HEADER, botMatch);
      next();
      return;
    }

    logTraffic({
      method: req.method,
      path: req.originalUrl,
      userAgent,
      botMatch,
      action: 'redirected-to-tollbooth',
    });
    res.setHeader(BOT_MATCH_HEADER, botMatch);
    res.redirect(HTTP_FOUND, `${config.tollboothOrigin}${req.originalUrl}`);
  };
}

/**
 * TollBit's tollbooth fetches the page back from this origin to extract content. If that
 * fetch matched the bot list it would be redirected into the tollbooth again, forever.
 */
function isBypassed(req: Request, config: PlaygroundConfig, userAgent: string): boolean {
  const { userAgentSubstrings, headerName, headerValue } = config.bypass;

  if (headerName && headerValue && req.header(headerName) === headerValue) return true;

  return userAgentSubstrings.some((substring) =>
    userAgent.toLowerCase().includes(substring.toLowerCase()),
  );
}

function isInfrastructurePath(path: string): boolean {
  if (INFRASTRUCTURE_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  return STATIC_ASSET_PATTERN.test(path);
}

/** Assets and dev-server module requests are never metered content. */
const STATIC_ASSET_PATTERN = /\.[a-z0-9]{2,5}$/i;

const INFRASTRUCTURE_PREFIXES = [
  '/api',
  '/__origin',
  '/@vite',
  '/@react-refresh',
  '/@fs',
  '/@id',
  '/src/',
  '/node_modules/',
  '/assets/',
  '/favicon',
  '/robots.txt',
  '/.well-known',
];
