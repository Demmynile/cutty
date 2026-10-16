import path from 'node:path'
import { defineProject } from 'vitest/config'

const stub = (name: string) => path.resolve(__dirname, `__tests__/stubs/${name}.ts`)

// Schemas are plain objects built with Sanity's identity helpers, so the
// studio packages are stubbed and the definitions are tested as data.
export default defineProject({
  resolve: {
    alias: [
      { find: /^sanity$/, replacement: stub('sanity') },
      { find: /^sanity\/structure$/, replacement: stub('sanity-structure') },
      { find: /^@sanity\/vision$/, replacement: stub('sanity-vision') },
    ],
  },
  test: {
    name: 'studio',
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    unstubEnvs: true,
  },
})
