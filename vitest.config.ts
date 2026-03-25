import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@database': path.resolve(__dirname, 'database'),
      '@automation': path.resolve(__dirname, 'automation'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
