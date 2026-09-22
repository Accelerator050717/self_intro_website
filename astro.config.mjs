import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { loadEnv } from 'vite';

const site = (process.env.SITE_URL || loadEnv('production', process.cwd(), '').SITE_URL)?.replace(/\/$/, '');
if (site) {
  const url = new URL(site);
  if (url.protocol !== 'https:' || url.origin !== site || /localhost|127\.0\.0\.1|example\.(com|org)/i.test(url.hostname)) {
    throw new Error('SITE_URL must be your real public HTTPS origin without a path. Leave it unset for local previews.');
  }
}
export default defineConfig({
  site: site || undefined,
  output: 'static',
  trailingSlash: 'always',
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: { define: { 'import.meta.env.PUBLIC_SITE_URL': JSON.stringify(site || '') } },
});
