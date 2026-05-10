// vitest.config.ts — Phase 1 adds coverage thresholds; everything else from Phase 0 unchanged
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/entries/**', 'src/**/*.tsx'],
      thresholds: {
        // Phase 1 owns calc and audit only; later phases will add their own per-glob entries.
        'src/calc/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
        'src/audit/**': { lines: 100, branches: 100, functions: 100, statements: 100 },
      },
    },
  },
});
