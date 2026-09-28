import type { APIRoute } from 'astro';
import { PLACEHOLDER_CONTENT } from '../data/site';

/**
 * Search engines stay out while the site still shows placeholder work;
 * setting PLACEHOLDER_CONTENT to false at launch opens it up.
 */
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('/sitemap-index.xml', site).href;
  const rules = PLACEHOLDER_CONTENT ? 'Disallow: /' : 'Allow: /';
  return new Response(`User-agent: *\n${rules}\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
