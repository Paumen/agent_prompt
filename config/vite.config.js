import { defineConfig } from 'vite';
import yamlPlugin from './vite-plugin-yaml.js';

export default defineConfig({
  base: '/agent_prompt/',
  root: 'src',
  plugins: [yamlPlugin()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  test: {
    root: '.',
    include: ['tests/**/*.test.js'],
  },
});
