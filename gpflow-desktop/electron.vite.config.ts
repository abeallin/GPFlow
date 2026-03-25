import { defineConfig } from 'electron-vite';
import path from 'path';

export default defineConfig({
  main: {
    build: {
      outDir: 'dist-electron',
      rollupOptions: {
        input: path.resolve(__dirname, 'electron/main.ts'),
      },
    },
    resolve: {
      alias: {
        '@database': path.resolve(__dirname, 'database'),
        '@automation': path.resolve(__dirname, 'automation'),
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist-electron',
      rollupOptions: {
        input: path.resolve(__dirname, 'electron/preload.ts'),
      },
    },
  },
  renderer: {},
});
