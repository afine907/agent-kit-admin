import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    include: ['src/**'],
    exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/bin/**'],
  },
});
