import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    fs: { allow: [".."] },
    proxy: { "/api": process.env.OMCM_PROXY_TARGET || "http://127.0.0.1:8000" },
  },
  test: {
    // Tests live beside frontend; resolve their packages from this installation.
    alias: {
      "@testing-library": fileURLToPath(
        new URL("./node_modules/@testing-library", import.meta.url),
      ),
      react: fileURLToPath(new URL("./node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(
        new URL("./node_modules/react-dom", import.meta.url),
      ),
      "react-leaflet": fileURLToPath(
        new URL("./node_modules/react-leaflet", import.meta.url),
      ),
    },
    include: ["../tests/frontend/**/*.test.{ts,tsx}"],
    globals: false,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    exclude: ["node_modules/**"],
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
