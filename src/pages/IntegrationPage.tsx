import { getStatus } from '../lib/api';
import { usePolling } from '../lib/usePolling';

const STATUS_POLL_INTERVAL_MS = 10000;

export function IntegrationPage() {
  const { data: status } = usePolling(getStatus, STATUS_POLL_INTERVAL_MS);

  return (
    <main>
      <h1>Integration</h1>

      <section>
        <h2>Current wiring</h2>
        {status ? (
          <table>
            <tbody>
              <tr>
                <td>Paywall mode</td>
                <td>
                  <code>{status.mode}</code>{' '}
                  <span className="dim">
                    {status.mode === 'mock'
                      ? '— local tollbooth, no TollBit account needed'
                      : status.mode === 'live'
                        ? '— redirecting to your real TollBit subdomain'
                        : '— bot gate disabled, everything served free'}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Tollbooth</td>
                <td>
                  <code>{status.tollboothOrigin}</code>
                </td>
              </tr>
              <tr>
                <td>Property domain</td>
                <td>
                  <code>{status.publisherDomain}</code>
                </td>
              </tr>
              <tr>
                <td>TOLLBIT_KEY present</td>
                <td>{status.hasTollbitKey ? 'yes' : 'no (mock key used)'}</td>
              </tr>
              <tr>
                <td>Gated user agents</td>
                <td className="dim">{status.botUserAgents.join(', ')}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="empty">Loading…</p>
        )}
      </section>

      <section>
        <h2>How the money flows</h2>
        <ol className="flow">
          <li>
            An AI crawler requests <code>/articles/…</code> from your origin.
          </li>
          <li>
            The edge rule matches its user agent and answers <code>302</code> to{' '}
            <code>tollbit.yourdomain.com</code>, preserving the path.
          </li>
          <li>
            The tollbooth has no token, so it answers <code>402 Payment Required</code> with the
            rate, the license, and the token endpoint.
          </li>
          <li>
            The agent POSTs <code>/dev/v2/tokens/content</code> with its <code>TollbitKey</code> and
            a <code>maxPriceMicros</code> ceiling, and gets back a short-lived JWT bound to its user
            agent.
          </li>
          <li>
            It retries with <code>Tollbit-Token</code>. The tollbooth serves clean content, records
            the transaction, and TollBit pays you the net.
          </li>
        </ol>
      </section>

      <section>
        <h2>Going live on your own domain</h2>
        <ol className="flow">
          <li>
            Create an org at <a href="https://app.tollbit.com">app.tollbit.com</a> and add your
            property.
          </li>
          <li>Verify the property by adding the DNS record TollBit gives you.</li>
          <li>
            Point <code>tollbit.yourdomain.com</code> at TollBit and enable analytics (log drain or
            bucket).
          </li>
          <li>Set rates and licenses per path in the marketplace UI.</li>
          <li>
            Install the redirect rule at your edge — Vercel WAF, Cloudflare Worker, Fastly, Akamai —
            using the same user-agent list this playground uses.
          </li>
          <li>
            Set <code>TOLLBIT_MODE=live</code> and <code>TOLLBIT_SUBDOMAIN=tollbit.yourdomain.com</code>{' '}
            here, and this app's bot gate targets the real tollbooth.
          </li>
        </ol>
        <p className="dim">
          Docs: <a href="https://docs.tollbit.com/docs/other">edge redirect</a> ·{' '}
          <a href="https://docs.tollbit.com/docs/quickstart">agent quickstart</a> ·{' '}
          <a href="https://docs.tollbit.com/docs/setting-rates">rates</a>
        </p>
      </section>
    </main>
  );
}
