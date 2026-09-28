import { defineConfig } from 'vitest/config'

// Unit tests run in Node. SQLite WebAssembly works there with in-memory databases,
// which is enough to test the engine's SQL, migrations and logic.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
