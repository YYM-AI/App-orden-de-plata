import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/database/**/*.test.ts',
    ],
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 120000,
    testTimeout: process.env.CLYMO_DB_TEST_TARGET === 'hosted-synthetic' ? 60000 : 20000,
  },
});
