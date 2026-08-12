import { TRAFFIC_LOG_LIMIT } from '../shared/constants';

export type TrafficAction = 'human' | 'redirected-to-tollbooth' | 'bot-allowed';

export type TrafficEntry = {
  at: string;
  method: string;
  path: string;
  userAgent: string;
  botMatch: string | null;
  action: TrafficAction;
};

let entries: TrafficEntry[] = [];

export function logTraffic(entry: Omit<TrafficEntry, 'at'>): void {
  entries = [{ ...entry, at: new Date().toISOString() }, ...entries].slice(0, TRAFFIC_LOG_LIMIT);
}

export function listTraffic(): TrafficEntry[] {
  return entries;
}

export function clearTraffic(): void {
  entries = [];
}
