import path from "path";
import { defineConfig, loadEnv } from "vite";
import fs from "fs";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'script',
        srcDir: '.',
        filename: 'custom-sw.js',
        strategies: 'injectManifest',
        devOptions: {
          enabled: false
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
              },
            },
            {
              urlPattern: /^https:\/\/cdn\.tailwindcss\.com/,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/cdn\.onesignal\.com/,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/onesignal\.com\/sdks\/.*/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'onesignal-sdk-styles',
              },
            },
          ],
        }
      })
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
        key: fs.readFileSync(path.resolve(__dirname, "certs/localhost-key.pem")),
        cert: fs.readFileSync(path.resolve(__dirname, "certs/localhost.pem")),
      },
    },
  };
});
