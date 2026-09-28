import { defineConfig } from 'vitest/config'

// Unit tests run in Node. SQLite WebAssembly works there with in-memory databases,
// which is enough to test the engine's SQL, migrations and logic.
export default defineConfig({
  test: {
    environment: 'node',
    // Match the owner's time zone so date tests behave like the phone.
    env: { TZ: 'Asia/Kolkata' },
    include: ['src/**/*.test.ts'],
  },
})
