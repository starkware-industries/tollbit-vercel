import { Link } from 'react-router-dom';
import { ARTICLES, formatMicros } from '../../shared/articles';
import { getStatus } from '../lib/api';
import { usePolling } from '../lib/usePolling';

const STATUS_POLL_INTERVAL_MS = 15000;

export function HomePage() {
  const { data: status } = usePolling(getStatus, STATUS_POLL_INTERVAL_MS);

  return (
    <main>
      <section className="hero">
        <h1>A newsroom with a turnstile for robots</h1>
        <p>
          Every article below is free for you. An AI crawler that asks for the same URL gets
          redirected to a TollBit tollbooth, shown a price, and served only after it pays.
        </p>
        {status && (
          <p className="mode-line">
            mode <strong>{status.mode}</strong> · tollbooth{' '}
            <code>{status.tollboothOrigin}</code>
          </p>
        )}
      </section>

      <ul className="article-list">
        {ARTICLES.map((article) => (
          <li key={article.slug}>
            <Link to={`/articles/${article.slug}`}>
              <h2>{article.title}</h2>
            </Link>
            <p>{article.description}</p>
            <div className="meta-row">
              <span className={article.priceMicros === 0 ? 'tag free' : 'tag paid'}>
                {article.priceMicros === 0 ? 'open access' : `${formatMicros(article.priceMicros)} / fetch`}
              </span>
              <span className="dim">{article.published}</span>
              {article.tags.map((tag) => (
                <span key={tag} className="dim">
                  #{tag}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
