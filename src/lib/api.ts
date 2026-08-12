import type { CrawlResult } from '../../agent/crawler';
import type { Transaction } from '../../server/tollbooth/ledger';
import type { TrafficEntry } from '../../server/traffic';
import type { PaywallMode } from '../../shared/config';

export type PlaygroundStatus = {
  mode: PaywallMode;
  tollboothOrigin: string;
  publisherDomain: string;
  hasTollbitKey: boolean;
  botUserAgents: string[];
  isProduction: boolean;
};

export type Summary = { count: number; grossMicros: number; feeMicros: number; netMicros: number };

export type Earnings =
  | { source: 'mock'; summary: Summary; transactions: Transaction[] }
  | {
      source: 'tollbit';
      summary: null;
      transactions: [];
      dashboardUrl: string;
      note: string;
    };

export type SimulateInput = {
  path: string;
  userAgent: string;
  maxPriceMicros: number;
  format: 'json' | 'markdown';
  tokenType: 'content' | 'crawl';
};

export function getStatus(): Promise<PlaygroundStatus> {
  return request('/api/config');
}

export function getEarnings(): Promise<Earnings> {
  return request('/api/earnings');
}

export function resetEarnings(): Promise<Earnings> {
  return request('/api/earnings', { method: 'DELETE' });
}

export function getTraffic(): Promise<TrafficEntry[]> {
  return request('/api/traffic');
}

export function clearTraffic(): Promise<TrafficEntry[]> {
  return request('/api/traffic', { method: 'DELETE' });
}

export function simulateCrawl(input: SimulateInput): Promise<CrawlResult> {
  return request('/api/simulate-crawl', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${url}: ${body}`);
  }
  return response.json() as Promise<T>;
}
