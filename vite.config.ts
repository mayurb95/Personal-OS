import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}
// Cloudflare Pages sets CF_PAGES_COMMIT_SHA during its build; local builds show "local".
const commit = process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ?? 'local'

// Personal OS build config. See docs/ARCHITECTURE.md for the reasoning behind each choice.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The app shows an "Update ready" banner instead of reloading mid-edit.
      registerType: 'prompt',
      injectRegister: false,
      // Icons are already precached by globPatterns below.
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'Personal OS',
        short_name: 'Personal OS',
        description:
          'Notes, databases, tasks, habits, workouts, journal, expenses and reading in one private app.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f2f2f7',
        theme_color: '#f2f2f7',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the whole app, including the SQLite WebAssembly binary, so it runs offline.
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,ico,webmanifest}'],
        // sqlite-wasm also ships helpers for storage modes this app doesn't use; skip caching them.
        globIgnores: ['**/sqlite3-worker1-*.js', '**/sqlite3-opfs-async-proxy-*.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  // sqlite-wasm locates its .wasm file relative to its own module; pre-bundling breaks that.
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  build: { target: 'es2022' },
})
