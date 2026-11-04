import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { site } from './src/site.config';
import { contributions } from './server/contributions.mjs';

/** on Vercel the production address is known at build time; link previews need absolute image addresses */
const ORIGIN = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** the loading screen is plain HTML, so it can show before any script runs; its words come from the site config */
function loadingWords(): Plugin {
  return {
    name: 'loading-words',
    transformIndexHtml: html => html
      .replaceAll('%NAME%', esc(site.name))
      .replaceAll('%NAME_CAPS%', esc(site.name.toUpperCase()))
      .replaceAll('%ROLE%', esc(site.role))
      .replaceAll('%ORIGIN%', ORIGIN)
      .replace('<!--LINES-->', site.loadingLines.map(l => `<p>${esc(l)}</p>`).join('')),
  };
}

/** the same live /api/github the site gets on Vercel, for `vite dev` and `vite preview` */
function liveGithub(): Plugin {
  const mw = async (req: any, res: any, next: () => void) => {
    if (!req.url?.startsWith('/api/github')) return next();
    const user = new URL(req.url, 'http://x').searchParams.get('user') || 'binaryrishabh';
    try { const d = await contributions(user); res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(d)); }
    catch (e) { res.statusCode = 502; res.end(JSON.stringify({ error: String(e) })); }
  };
  return { name: 'live-github', configureServer: s => { s.middlewares.use(mw); }, configurePreviewServer: s => { s.middlewares.use(mw); } };
}

export default defineConfig({
  plugins: [react(), loadingWords(), liveGithub()],
  server: { port: 5510, strictPort: true },
  preview: { port: 5520, strictPort: true },
  // two pages: the portfolio at /, and the 3D world at /world/
  build: { target: 'es2022', chunkSizeWarningLimit: 1600, rollupOptions: { input: { main: resolve(__dirname, 'index.html'), world: resolve(__dirname, 'world/index.html') } } },
});
