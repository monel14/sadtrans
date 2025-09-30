import path from "path";
import { defineConfig, loadEnv } from "vite";
import fs from "fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [],
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
