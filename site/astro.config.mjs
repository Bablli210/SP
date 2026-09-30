// @ts-check
import { readFile } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * Build check: robots.txt must be in the output, and must keep crawlers out
 * while the site is a placeholder preview (Base.astro marks every page with
 * <html data-note> while PLACEHOLDER_CONTENT is on). Fails the build otherwise.
 * @returns {import('astro').AstroIntegration}
 */
function robotsGuard() {
  return {
    name: 'serious-play:robots-guard',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const robots = await readFile(new URL('robots.txt', dir), 'utf8').catch(() => null);
        if (robots === null) throw new Error('robots.txt is missing from the build (src/pages/robots.txt.ts).');
        const home = await readFile(new URL('index.html', dir), 'utf8').catch(() => '');
        const preview = /<html\b[^>]*\sdata-note[\s>=]/.test(home);
        if (preview && !/^Disallow:\s*\/\s*$/m.test(robots)) {
          throw new Error('The site is a placeholder preview, but robots.txt does not say "Disallow: /".');
        }
        logger.info(preview ? 'robots.txt keeps crawlers out (placeholder preview).' : 'robots.txt is open (live site).');
      },
    },
  };
}

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  // Where the site lives: canonical URLs, the sitemap and social cards use it.
  // Preview on sp.o-rbit.co; set SITE_URL=https://seriousplaystudio.com at launch.
  site: process.env.SITE_URL || 'https://sp.o-rbit.co',
  integrations: [sitemap(), robotsGuard()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  image: { responsiveStyles: true, layout: 'constrained' },
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
