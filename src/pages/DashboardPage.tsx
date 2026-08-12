import { useCallback } from 'react';
import { formatMicros } from '../../shared/articles';
import { clearTraffic, getEarnings, getStatus, getTraffic, resetEarnings } from '../lib/api';
import { usePolling } from '../lib/usePolling';

const STATUS_POLL_INTERVAL_MS = 30000;

export function DashboardPage() {
  const loadEarnings = useCallback(getEarnings, []);
  const loadTraffic = useCallback(getTraffic, []);
  const loadStatus = useCallback(getStatus, []);
  const earnings = usePolling(loadEarnings);
  const traffic = usePolling(loadTraffic);
  const status = usePolling(loadStatus, STATUS_POLL_INTERVAL_MS);

  const summary = earnings.data?.summary;
  const liveLedger = earnings.data?.source === 'tollbit' ? earnings.data : null;

  return (
    <main>
      <h1>Earnings</h1>
      {earnings.error && <p className="error">{earnings.error}</p>}
      {liveLedger && (
        <p className="empty">
          {liveLedger.note}{' '}
          <a href={liveLedger.dashboardUrl} target="_blank" rel="noreferrer">
            Open the TollBit dashboard →
          </a>
        </p>
      )}

      {!liveLedger && (
        <div className="stat-row">
          <Stat label="Paid fetches" value={summary ? String(summary.count) : '—'} />
          <Stat label="Gross" value={summary ? formatMicros(summary.grossMicros) : '—'} />
          <Stat label="TollBit fee" value={summary ? formatMicros(summary.feeMicros) : '—'} />
          <Stat
            label="Your net"
            value={summary ? formatMicros(summary.netMicros) : '—'}
            highlight
          />
        </div>
      )}

      <div className="section-head">
        <h2>Transactions</h2>
        {!liveLedger && (
          <button type="button" onClick={() => resetEarnings().then(earnings.refresh)}>
            Reset ledger
          </button>
        )}
      </div>
      {earnings.data && earnings.data.transactions.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Content</th>
              <th>Agent</th>
              <th>License</th>
              <th className="right">Gross</th>
              <th className="right">Net to you</th>
            </tr>
          </thead>
          <tbody>
            {earnings.data.transactions.map((txn) => (
              <tr key={txn.id}>
                <td className="dim">{new Date(txn.at).toLocaleTimeString()}</td>
                <td>{txn.slug}</td>
                <td className="dim">{txn.agentId}</td>
                <td className="dim">{txn.licenseType}</td>
                <td className="right">{formatMicros(txn.grossMicros, txn.currency)}</td>
                <td className="right strong">{formatMicros(txn.netMicros, txn.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        !liveLedger && (
          <p className="empty">
            No paid fetches yet. Open an article and run the crawl simulator, or run{' '}
            <code>pnpm agent</code>.
          </p>
        )
      )}

      <div className="section-head">
        <h2>Bot traffic at the edge</h2>
        <button type="button" onClick={() => clearTraffic().then(traffic.refresh)}>
          Clear log
        </button>
      </div>
      {traffic.data?.length ? (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Path</th>
              <th>Matched bot</th>
              <th>Action</th>
              <th>User agent</th>
            </tr>
          </thead>
          <tbody>
            {traffic.data.map((entry, index) => (
              <tr key={`${entry.at}-${index}`}>
                <td className="dim">{new Date(entry.at).toLocaleTimeString()}</td>
                <td>{entry.path}</td>
                <td>{entry.botMatch ?? <span className="dim">—</span>}</td>
                <td>
                  <span className={entry.botMatch ? 'tag paid' : 'tag free'}>{entry.action}</span>
                </td>
                <td className="dim truncate">{entry.userAgent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty">No requests logged yet.</p>
      )}
      {status.data?.isProduction && (
        <p className="dim small">
          In production this log is per function instance and resets on redeploy — use your
          host's logs or TollBit's analytics as the real record.
        </p>
      )}
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? 'stat highlight' : 'stat'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
