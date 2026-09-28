// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: 'https://seriousplaystudio.com',
  integrations: [sitemap()],
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  image: { responsiveStyles: true, layout: 'constrained' },
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
