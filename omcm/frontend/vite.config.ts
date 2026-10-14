import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": process.env.OMCM_PROXY_TARGET || "http://127.0.0.1:8000" },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    exclude: ["node_modules/**", "tests/**"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mapping: ["leaflet", "react-leaflet"],
          charts: ["recharts"],
        },
      },
    },
  },
});
