import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { site } from './src/site.config';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** the loading screen is plain HTML, so it can show before any script runs; its words come from the site config */
function loadingWords(): Plugin {
  return {
    name: 'loading-words',
    transformIndexHtml: html => html
      .replaceAll('%NAME%', esc(site.name))
      .replaceAll('%NAME_CAPS%', esc(site.name.toUpperCase()))
      .replaceAll('%ROLE%', esc(site.role))
      .replace('<!--LINES-->', site.loadingLines.map(l => `<p>${esc(l)}</p>`).join('')),
  };
}

export default defineConfig({
  plugins: [react(), loadingWords()],
  server: { port: 5510, strictPort: true },
  preview: { port: 5520, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
});
