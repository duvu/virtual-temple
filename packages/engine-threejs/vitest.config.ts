import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Resolve workspace sources directly so tests do not depend on prior package builds. */
export default defineConfig({
  resolve: {
    alias: {
      '@vtl/domain': fileURLToPath(new URL('../domain/src/index.ts', import.meta.url)),
      '@vtl/application': fileURLToPath(new URL('../application/src/index.ts', import.meta.url)),
    },
  },
});
