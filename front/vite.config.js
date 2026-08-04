import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt", not "autoUpdate": autoUpdate reloads the tab the moment a new
      // service worker activates, which would throw away whatever is in the
      // editor. The user gets a toast instead — see PWAPrompts.jsx.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-64.png'],
      manifest: {
        id: '/',
        name: 'Vichar — Notes',
        short_name: 'Vichar',
        description:
          'Write, encrypt and organise your notes, with AI grammar and formatting help.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Matches the daisyUI `forest` base-100 the app renders on, so the
        // splash screen and the OS status bar do not flash a different color.
        background_color: '#171212',
        theme_color: '#171212',
        orientation: 'portrait-primary',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Android crops "any" icons to its own shape; the maskable variant
          // keeps the mark inside the 80% safe circle so it is not clipped.
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'New note',
            short_name: 'New note',
            url: '/create',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Deep links are client-side routes, so every navigation falls back to
        // the precached shell — the same job vercel.json does on the network.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Nothing from the API is cached. Note bodies can be encrypted and
        // every response is scoped to the signed-in user, so a stale copy in
        // the Cache API would outlive the session cookie that authorised it.
        // The shell works offline; the data deliberately does not.
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
