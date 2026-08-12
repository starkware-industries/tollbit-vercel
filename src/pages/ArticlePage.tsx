import { useParams } from 'react-router-dom';
import { marked } from 'marked';
import { findArticle, formatMicros } from '../../shared/articles';
import { CrawlSimulator } from '../components/CrawlSimulator';

export function ArticlePage() {
  const { slug } = useParams();
  const article = slug ? findArticle(slug) : undefined;

  if (!article) return <p className="empty">No such article.</p>;

  return (
    <main>
      <article>
        <h1>{article.title}</h1>
        <p className="byline">
          {article.author} · {article.published}
        </p>
        <div className="rate-card">
          <div>
            <span className="dim">Agent rate</span>
            <strong>
              {article.priceMicros === 0 ? 'free' : `${formatMicros(article.priceMicros)} per fetch`}
            </strong>
          </div>
          <div>
            <span className="dim">License</span>
            <strong>{article.licenseType}</strong>
          </div>
          <div>
            <span className="dim">priceMicros</span>
            <strong>{article.priceMicros.toLocaleString()}</strong>
          </div>
        </div>
        <div
          className="markdown"
          dangerouslySetInnerHTML={{ __html: marked.parse(article.body, { async: false }) }}
        />
      </article>

      <CrawlSimulator path={`/articles/${article.slug}`} />
    </main>
  );
}
