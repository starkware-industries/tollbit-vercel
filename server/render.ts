import { marked } from 'marked';
import { ARTICLES, findArticle, formatMicros, type Article } from '../shared/articles';

const HEAD_PLACEHOLDER = '<!--head-tags-->';
const APP_PLACEHOLDER = '<!--app-html-->';

/**
 * TollBit fetches your public page to extract content, so the origin has to serve real
 * HTML — not an empty SPA shell. React replaces this markup on mount.
 */
export function renderPage(template: string, path: string): string {
  const slug = articleSlug(path);
  const article = slug ? findArticle(slug) : undefined;

  if (article) {
    return template
      .replace(HEAD_PLACEHOLDER, articleHead(article))
      .replace(APP_PLACEHOLDER, articleBody(article));
  }

  return template.replace(HEAD_PLACEHOLDER, indexHead()).replace(APP_PLACEHOLDER, indexBody());
}

export function articleSlug(path: string): string | null {
  const match = /^\/articles\/([^/?#]+)/.exec(path);
  return match ? decodeURIComponent(match[1]) : null;
}

function articleHead(article: Article): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.description,
    author: { '@type': 'Person', name: article.author },
    datePublished: article.published,
    isAccessibleForFree: article.priceMicros === 0,
  };

  return [
    `<meta name="description" content="${escapeHtml(article.description)}" />`,
    `<meta property="og:title" content="${escapeHtml(article.title)}" />`,
    `<meta name="tollbit-price-micros" content="${article.priceMicros}" />`,
    `<meta name="tollbit-license" content="${article.licenseType}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
  ].join('\n    ');
}

function articleBody(article: Article): string {
  return `<article class="prerendered">
      <h1>${escapeHtml(article.title)}</h1>
      <p class="byline">${escapeHtml(article.author)} · ${article.published} · ${formatMicros(article.priceMicros)} per agent fetch</p>
      ${marked.parse(article.body, { async: false })}
    </article>`;
}

function indexHead(): string {
  return '<meta name="description" content="A sandbox news site that charges AI crawlers through TollBit." />';
}

function indexBody(): string {
  const items = ARTICLES.map(
    (article) =>
      `<li><a href="/articles/${article.slug}">${escapeHtml(article.title)}</a> — ${escapeHtml(article.description)}</li>`,
  ).join('\n        ');
  return `<main class="prerendered">
      <h1>The Toll Gazette</h1>
      <ul>
        ${items}
      </ul>
    </main>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
