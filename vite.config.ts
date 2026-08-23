import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split rarely-changing vendor code into stable, separately-cached
        // chunks so an app-code change no longer invalidates ~178 KB of
        // framework for returning visitors. recharts/leaflet are intentionally
        // left unmatched so they stay in their own lazy route chunks.
        // Function form (not object) — required by Vite 8's rolldown bundler.
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;
          if (id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/scheduler/')) return 'react-vendor';
          if (id.includes('/node_modules/@supabase/')) return 'supabase-vendor';
          if (id.includes('/node_modules/framer-motion/')) return 'motion-vendor';
        },
      },
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', '*.png'],
      manifest: {
        name: 'EV Site Selector',
        short_name: 'EV Selector',
        description: 'AI-Powered EV Charging Site Selection & Revenue Forecasting',
        theme_color: '#1A2332',
        background_color: '#1A2332',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        runtimeCaching: [
          {
            // Groq / Anthropic API — network first, cache as fallback
            urlPattern: /^https:\/\/(api\.groq\.com|api\.anthropic\.com)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'llm-api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            // Supabase — network first
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
            },
          },
        ],
      },
    }),
  ],
});
