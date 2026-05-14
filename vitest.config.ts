import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: false,
    environment: 'node',
    include: ['features/**/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['shared/**/*.ts', 'features/**/*.ts'],
      exclude: ['features/**/tests/**'],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
    conditions: ['node'],
  },
});
