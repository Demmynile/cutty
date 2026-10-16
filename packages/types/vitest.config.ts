import { defineProject } from 'vitest/config'

export default defineProject({
  test: { name: 'types', environment: 'node', include: ['__tests__/**/*.test.ts'] },
})
