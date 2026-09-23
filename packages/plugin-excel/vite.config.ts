import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@mogura/moguchart-core': path.resolve(import.meta.dirname, '../core/src/index.ts'),
    },
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'MoguchartPluginExcel',
      fileName: (format) => `moguchart-plugin-excel.${format === 'es' ? 'mjs' : 'umd.js'}`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: [
        'lit',
        /^lit\//,
        '@mogura/moguchart-core',
      ],
      output: {
        globals: {
          lit: 'Lit',
          '@mogura/moguchart-core': 'MoguchartCore',
        },
      },
    },
  },
})
