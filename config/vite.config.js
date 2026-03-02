import { resolve } from 'path';
import { defineConfig } from 'vite';
import yamlPlugin from './vite-plugin-yaml.js';

export default defineConfig({
  base: '/agent_prompt/',
  root: 'src',
  plugins: [yamlPlugin()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, '../src/index.html'),
        preview: resolve(__dirname, '../src/preview.html'),
      },
    },
  },
  test: {
    root: '.',
    include: ['tests/**/*.test.js'],
  },
});
