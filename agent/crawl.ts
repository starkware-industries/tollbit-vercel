import { parseArgs } from 'node:util';
import { loadConfig } from '../shared/config';
import { DEFAULT_AGENT_USER_AGENT, DEFAULT_MAX_PRICE_MICROS } from '../shared/constants';
import { formatMicros } from '../shared/articles';
import { crawlAsAgent } from './crawler';

const { values } = parseArgs({
  options: {
    path: { type: 'string', default: '/articles/why-crawlers-should-pay' },
    ua: { type: 'string', default: DEFAULT_AGENT_USER_AGENT },
    'max-price': { type: 'string', default: String(DEFAULT_MAX_PRICE_MICROS) },
    format: { type: 'string', default: 'markdown' },
    'token-type': { type: 'string', default: 'content' },
  },
});

const config = loadConfig();
const result = await crawlAsAgent({
  path: values.path!,
  userAgent: values.ua,
  maxPriceMicros: Number(values['max-price']),
  format: values.format === 'json' ? 'json' : 'markdown',
  tokenType: values['token-type'] === 'crawl' ? 'crawl' : 'content',
  config,
});

console.log(`\nAgent crawl of ${values.path}  (mode=${config.mode})\n`);
for (const [index, step] of result.steps.entries()) {
  console.log(`${index + 1}. ${step.label}`);
  console.log(`   ${step.request}`);
  console.log(`   → ${step.status ?? '—'}  ${step.note}`);
  if (step.detail) console.log(`   ${JSON.stringify(step.detail)}`);
}

if (result.ok && result.pricePaidMicros) {
  console.log(`\nPaid ${formatMicros(result.pricePaidMicros, result.currency ?? 'USD')}`);
}
if (result.content) {
  console.log(`\n--- content ---\n${result.content}`);
}

process.exit(result.ok ? 0 : 1);
