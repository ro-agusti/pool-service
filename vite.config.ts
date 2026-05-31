import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { SvelteKitPWA } from '@vite-pwa/sveltekit'

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      manifest: {
        name: 'ClearWave',
        short_name: 'ClearWave',
        description: 'Pool service field management',
        theme_color: '#0EA5E9',
        background_color: '#F8FAFC',
        display: 'standalone',
        start_url: '/visits',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          // Supabase API — network first con fallback a cache
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(visits|properties|customers|products|visit_checklists)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 } // 24h
            }
          },
          // Google Maps scripts — stale while revalidate
          {
            urlPattern: /^https:\/\/maps\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-maps' }
          }
        ]
      }
    })
  ]
})