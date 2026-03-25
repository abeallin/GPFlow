import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import path from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron',
      emptyOutDir: false,
      rollupOptions: {
        input: path.resolve(__dirname, 'electron/main.ts'),
        output: {
          entryFileNames: 'main.js',
        },
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
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron',
      emptyOutDir: false,
      rollupOptions: {
        input: path.resolve(__dirname, 'electron/preload.ts'),
        output: {
          entryFileNames: 'preload.js',
        },
      },
    },
  },
});
