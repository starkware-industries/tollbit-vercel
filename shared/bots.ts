/**
 * User agents TollBit tells publishers to forward to their tollbit subdomain.
 * Keep in sync with https://docs.tollbit.com/docs/vercel (WAF rule expression).
 */
export const AI_BOT_USER_AGENTS = [
  'ChatGPT-User',
  'OAI-SearchBot',
  'GPTBot',
  'PerplexityBot',
  'Perplexity-User',
  'anthropic-ai',
  'ClaudeBot',
  'Claude-Web',
  'Claude-User',
  'Claude-SearchBot',
  'CCBot',
  'cohere-ai',
  'YouBot',
  'Diffbot',
  'meta-externalagent',
  'Timpibot',
  'Amazonbot',
  'Bytespider',
] as const;

const BOT_PATTERN = new RegExp(`(${AI_BOT_USER_AGENTS.join('|')})`, 'i');

export function matchAiBot(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const match = BOT_PATTERN.exec(userAgent);
  return match ? match[1] : null;
}
