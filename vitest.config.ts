import { defineConfig } from 'vitest/config'

// Each workspace owns its test setup (aliases, stubs, environment); this just
// runs them together. `npm test` runs everything, `npm test -- --project admin`
// runs one.
export default defineConfig({
  test: {
    projects: ['apps/admin', 'apps/mobile', 'apps/realtime', 'apps/studio', 'packages/types'],
  },
})
