import { defineConfig } from 'vite';

export default defineConfig({
  base: '/agent_prompt/',
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  test: {
    root: '.',
    include: ['tests/**/*.test.js'],
  },
});
