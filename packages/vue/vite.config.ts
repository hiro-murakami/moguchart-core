import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/index.ts'),
      name: 'MoguchartVue',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'moguchart-vue.mjs' : 'moguchart-vue.umd.js'),
    },
    rollupOptions: {
      external: ['vue', '@mogura/moguchart-core'],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          '@mogura/moguchart-core': 'MoguchartCore',
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
