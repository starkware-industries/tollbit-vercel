import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { LEDGER_LIMIT } from '../../shared/constants';

export type Transaction = {
  id: string;
  at: string;
  contentUrl: string;
  slug: string;
  agentId: string;
  userAgent: string;
  licenseType: string;
  currency: string;
  grossMicros: number;
  feeMicros: number;
  netMicros: number;
};

const LEDGER_FILE = resolve(process.cwd(), 'data/ledger.json');
const RADIX_BASE36 = 36;
const ID_SLICE_START = 2;
const ID_SLICE_LENGTH = 8;

let transactions: Transaction[] = load();

export function recordTransaction(
  input: Omit<Transaction, 'id' | 'at'>,
): Transaction {
  const transaction: Transaction = {
    ...input,
    id: `txn_${Math.random().toString(RADIX_BASE36).slice(ID_SLICE_START, ID_SLICE_START + ID_SLICE_LENGTH)}`,
    at: new Date().toISOString(),
  };
  transactions = [transaction, ...transactions].slice(0, LEDGER_LIMIT);
  persist();
  return transaction;
}

export function listTransactions(): Transaction[] {
  return transactions;
}

export function summarize() {
  return transactions.reduce(
    (acc, txn) => ({
      count: acc.count + 1,
      grossMicros: acc.grossMicros + txn.grossMicros,
      feeMicros: acc.feeMicros + txn.feeMicros,
      netMicros: acc.netMicros + txn.netMicros,
    }),
    { count: 0, grossMicros: 0, feeMicros: 0, netMicros: 0 },
  );
}

export function clearTransactions(): void {
  transactions = [];
  persist();
}

function load(): Transaction[] {
  try {
    const parsed = JSON.parse(readFileSync(LEDGER_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let persistWarned = false;

/** Serverless filesystems are read-only, so the ledger degrades to in-memory only. */
function persist(): void {
  try {
    mkdirSync(dirname(LEDGER_FILE), { recursive: true });
    writeFileSync(LEDGER_FILE, JSON.stringify(transactions, null, 2));
  } catch (error) {
    if (!persistWarned) {
      persistWarned = true;
      console.warn(
        `[tollbooth] ledger not persisted (${(error as Error).message}). Transactions live in memory only.`,
      );
    }
  }
}
