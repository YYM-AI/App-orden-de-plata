import { defineConfig } from '@playwright/test';
import base from './playwright.config';
process.env.CLYMO_E2E_WORKER = '1';
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://127.0.0.1:3101' },
  outputDir: 'test-results/worker',
  reporter: [['list']],
  // The local Worker uses .local/worker-preview.json; no public tunnel or deployment.
  webServer: undefined,
});
