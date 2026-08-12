import { DEFAULT_ORIGIN_PORT, DEFAULT_TOLLBOOTH_PORT } from './constants';

export type PaywallMode = 'off' | 'mock' | 'live';

export type PlaygroundConfig = {
  mode: PaywallMode;
  originPort: number;
  tollboothPort: number;
  /** Where bot traffic gets 302'd. In live mode this is your DNS-verified tollbit.<domain>. */
  tollboothOrigin: string;
  originUrl: string;
  publisherDomain: string;
  hasTollbitKey: boolean;
  /**
   * Requests the bot gate must never redirect, or TollBit's own content fetch loops back
   * into the gate forever. Confirm the real values with TollBit before going live.
   */
  bypass: {
    userAgentSubstrings: string[];
    headerName: string | null;
    headerValue: string | null;
  };
};

export function loadConfig(): PlaygroundConfig {
  const mode = readMode();
  const originPort = readPort('ORIGIN_PORT', DEFAULT_ORIGIN_PORT);
  const tollboothPort = readPort('TOLLBOOTH_PORT', DEFAULT_TOLLBOOTH_PORT);
  const liveSubdomain = process.env.TOLLBIT_SUBDOMAIN?.replace(/\/+$/, '');

  return {
    mode,
    originPort,
    tollboothPort,
    tollboothOrigin:
      mode === 'live' && liveSubdomain
        ? withScheme(liveSubdomain)
        : `http://localhost:${tollboothPort}`,
    originUrl: process.env.ORIGIN_URL ?? `http://localhost:${originPort}`,
    publisherDomain: process.env.PUBLISHER_DOMAIN ?? `localhost:${originPort}`,
    hasTollbitKey: Boolean(process.env.TOLLBIT_KEY),
    bypass: {
      userAgentSubstrings: splitList(process.env.TOLLBIT_BYPASS_USER_AGENTS),
      headerName: process.env.TOLLBIT_BYPASS_HEADER?.toLowerCase() ?? null,
      headerValue: process.env.TOLLBIT_BYPASS_SECRET ?? null,
    },
  };
}

function splitList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readMode(): PaywallMode {
  const raw = process.env.TOLLBIT_MODE;
  if (raw === 'off' || raw === 'mock' || raw === 'live') return raw;
  return process.env.TOLLBIT_SUBDOMAIN ? 'live' : 'mock';
}

function readPort(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function withScheme(host: string): string {
  return /^https?:\/\//.test(host) ? host : `https://${host}`;
}
