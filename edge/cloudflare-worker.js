const TOLLBIT_SUBDOMAIN = 'https://tollbit.yourdomain.com';

const AI_BOT_PATTERN =
  /(ChatGPT-User|OAI-SearchBot|GPTBot|PerplexityBot|Perplexity-User|anthropic-ai|ClaudeBot|Claude-Web|Claude-User|Claude-SearchBot|CCBot|cohere-ai|YouBot|Diffbot|meta-externalagent|Timpibot|Amazonbot|Bytespider)/i;

const HTTP_FOUND = 302;

export default {
  async fetch(request) {
    const userAgent = request.headers.get('user-agent') ?? '';
    if (!AI_BOT_PATTERN.test(userAgent)) return fetch(request);

    const incoming = new URL(request.url);
    const target = new URL(incoming.pathname + incoming.search, TOLLBIT_SUBDOMAIN);
    return Response.redirect(target.toString(), HTTP_FOUND);
  },
};
