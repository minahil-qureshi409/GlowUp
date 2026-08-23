import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    // The suite covers pure logic — date arithmetic, validation schemas and the
    // redirect allowlist. Anything needing a database belongs in a different
    // kind of test than this.
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` is a build-time guard Next resolves; under Vitest it has
      // no module to load, so it is stubbed. Nothing under test cares.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
});
