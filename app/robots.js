// app/robots.js: search engines and AI assistants are welcome to read and cite olexweb.com.
const AI_AGENTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'CCBot', 'Meta-ExternalAgent', 'Amazonbot', 'DuckAssistBot'];
export default function robots() {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin'] }, { userAgent: AI_AGENTS, allow: '/', disallow: ['/admin'] }], sitemap: 'https://olexweb.com/sitemap.xml', host: 'https://olexweb.com' };
}
