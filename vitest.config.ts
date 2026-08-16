import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['apps/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**/*.ts'],
      exclude: ['**/*.spec.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
})
