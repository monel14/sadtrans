import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/[^.]*\.supabase\.co\/.*$/,
              handler: 'NetworkOnly',
              options: {
                cacheName: 'supabase-api',
                expiration: {
                  maxEntries: 0,
                  maxAgeSeconds: 60 * 5 // 5 minutes
                }
              }
            }
          ]
        },
        manifest: {
          name: 'SadTrans B2B Platform',
          short_name: 'SadTrans',
          description: 'A B2B PaaS platform for financial service partners, providing tools for transaction management, user administration, and reporting.',
          theme_color: '#7c3aed',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'images/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'images/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0', // permet l'accès depuis d'autres machines
      port: 5173       // tu peux fixer un port si besoin (optionnel)
    },
  };
});
