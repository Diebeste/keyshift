import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const VERSION = `${pkg.version}+${stamp}`;

/** Emits sw.js with a versioned cache and the full precache list of built files. */
function serviceWorker(): Plugin {
  return {
    name: 'keyshift-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const publicFiles = ['manifest.webmanifest', 'favicon.svg', 'icon-192.png', 'icon-512.png'];
      const precache = ['./', ...[...files, ...publicFiles].map((f) => './' + f)];
      const src = readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8')
        .replace('__CACHE__', `keyshift-v${VERSION}`)
        .replace('__PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [svelte(), serviceWorker()],
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000, assetsInlineLimit: 0 },
  optimizeDeps: { exclude: ['essentia.js'] },
});
