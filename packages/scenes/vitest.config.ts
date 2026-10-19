import { defineConfig } from 'vitest/config';

export default defineConfig({
  // CI runs four workspaces at once on a small runner: the beat-engine tests need more than the default 5 s there
  test: { include: ['src/**/*.test.{ts,tsx}'], testTimeout: 20000 },
});
