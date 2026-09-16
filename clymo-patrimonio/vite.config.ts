import { defineConfig } from 'vite';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';

// Parallel Workers build; the established Next.js local build remains available.
export default defineConfig({
  plugins: [vinext(), cloudflare({ viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] } })],
  build: { target: 'safari16.4', sourcemap: false },
});
