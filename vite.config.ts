import path from "path";
import { defineConfig, loadEnv } from "vite";
import fs from "fs";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "script",
        srcDir: ".",
        filename: "custom-sw.js",
        strategies: "injectManifest",
        devOptions: {
          enabled: false,
        },
        workbox: {
          // Ignorer les URLs externes qui ne peuvent pas être mises en cache
          globIgnores: ["../node_modules/**/*", "**/*.map"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com/,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com/,
              handler: "CacheFirst",
              options: {
                cacheName: "gstatic-fonts",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/cdn\.tailwindcss\.com/,
              handler: "NetworkOnly",
            },
            {
              urlPattern: /^https:\/\/cdn\.onesignal\.com/,
              handler: "NetworkOnly",
            },
            {
              urlPattern: /^https:\/\/onesignal\.com\/sdks\/.*/,
              handler: "NetworkOnly",
            },
            {
              urlPattern: /^https:\/\/ui-avatars\.com\/api\/.*/,
              handler: "CacheFirst",
              options: {
                cacheName: "ui-avatars",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 1 month
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/placehold\.co\/.*/,
              handler: "CacheFirst",
              options: {
                cacheName: "placeholder-images",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/,
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "cdn-resources",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
                },
              },
            },
          ],
          // Ne pas essayer de mettre en cache les ressources externes
          navigateFallback: null,
          navigateFallbackDenylist: [
            /^\/api/,
            /^\/functions/,
            /^\/rest/,
            /^\/auth/,
            /^\/storage/,
          ],
        },
      }),
    ],
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      https: {
        key: fs.readFileSync(
          path.resolve(__dirname, "certs/localhost-key.pem"),
        ),
        cert: fs.readFileSync(path.resolve(__dirname, "certs/localhost.pem")),
      },
      fs: {
        // Allow serving files from parent directory for OneSignal service workers
        allow: ["..", "."],
      },
    },
    // Configure public directory and file serving
    publicDir: "public",
    build: {
      // Copy OneSignal service worker files to root
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
        },
      },
    },
  };
});
