import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineProject({
  resolve: {
    alias: [
      { find: '@cutty/types', replacement: here('../../packages/types/index.ts') },
      { find: /^@\//, replacement: here('./') },
      // The real package throws outside a React Server Components build.
      { find: 'server-only', replacement: here('./__tests__/stubs/server-only.ts') },
    ],
  },
  esbuild: { jsx: 'automatic' },
  test: {
    name: 'admin',
    environment: 'node',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['__tests__/setup.ts'],
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
})
