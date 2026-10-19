/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8080" } },
  build: { outDir: "dist" },
  // CI runs four workspaces at once on a small runner: give each test room (the default 5 s is tight there)
  test: { environment: "node", include: ["test/**/*.test.ts"], testTimeout: 20000 },
});
