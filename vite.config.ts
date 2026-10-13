import { defineConfig } from 'vitest/config';
export default defineConfig({
  base: './',
  test: { environment: 'node' },
  build: { target: 'es2022' },
});
