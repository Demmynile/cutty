import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'

export default defineProject({
  resolve: {
    alias: [{ find: '@cutty/types', replacement: fileURLToPath(new URL('../../packages/types/index.ts', import.meta.url)) }],
  },
  test: {
    name: 'realtime',
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
})
