import { useState } from 'react';
import { marked } from 'marked';
import { DEFAULT_AGENT_USER_AGENT, DEFAULT_MAX_PRICE_MICROS } from '../../shared/constants';
import { formatMicros } from '../../shared/articles';
import { simulateCrawl } from '../lib/api';
import type { CrawlResult } from '../../agent/crawler';

const USER_AGENT_CHOICES = [
  DEFAULT_AGENT_USER_AGENT,
  'ClaudeBot/1.0 (+tollbit-playground)',
  'PerplexityBot/1.0 (+tollbit-playground)',
  'Mozilla/5.0 (a plain browser, not a bot)',
];

const LOW_BUDGET_MICROS = 10_000;

export function CrawlSimulator({ path }: { path: string }) {
  const [userAgent, setUserAgent] = useState(USER_AGENT_CHOICES[0]);
  const [maxPriceMicros, setMaxPriceMicros] = useState(DEFAULT_MAX_PRICE_MICROS);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      setResult(await simulateCrawl({ path, userAgent, maxPriceMicros, format: 'markdown', tokenType: 'content' }));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="simulator">
      <h3>Crawl this page as an agent</h3>
      <p className="dim">
        Replays the real flow server-side: origin → 302 → 402 challenge → token → paid fetch.
      </p>

      <div className="controls">
        <label>
          User agent
          <select value={userAgent} onChange={(event) => setUserAgent(event.target.value)}>
            {USER_AGENT_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </label>
        <label>
          Agent budget
          <select
            value={maxPriceMicros}
            onChange={(event) => setMaxPriceMicros(Number(event.target.value))}
          >
            <option value={DEFAULT_MAX_PRICE_MICROS}>
              {formatMicros(DEFAULT_MAX_PRICE_MICROS)} (will pay)
            </option>
            <option value={LOW_BUDGET_MICROS}>
              {formatMicros(LOW_BUDGET_MICROS)} (too low — refused)
            </option>
          </select>
        </label>
        <button type="button" onClick={run} disabled={running}>
          {running ? 'Crawling…' : 'Run crawl'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <ol className="steps">
            {result.steps.map((step, index) => (
              <li key={index}>
                <div className="step-head">
                  <span className={statusClass(step.status)}>{step.status ?? '—'}</span>
                  <strong>{step.label}</strong>
                </div>
                <code>{step.request}</code>
                <p>{step.note}</p>
                {step.detail !== undefined && (
                  <pre>{JSON.stringify(step.detail, null, 2)}</pre>
                )}
              </li>
            ))}
          </ol>

          {result.content && (
            <div className="agent-view">
              <h4>What the agent received</h4>
              <div
                className="markdown"
                dangerouslySetInnerHTML={{ __html: marked.parse(result.content, { async: false }) }}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function statusClass(status: number | null): string {
  if (status === null) return 'pill';
  if (status >= 200 && status < 300) return 'pill ok';
  if (status === 402) return 'pill pay';
  if (status >= 300 && status < 400) return 'pill redirect';
  return 'pill bad';
}
