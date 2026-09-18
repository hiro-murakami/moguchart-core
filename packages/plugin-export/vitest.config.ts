import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@mogura/moguchart-core': path.resolve(import.meta.dirname, '../core/src/index.ts'),
    },
  },
})
