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
      name: 'MoguchartPluginExport',
      fileName: (format) => `moguchart-plugin-export.${format === 'es' ? 'mjs' : 'umd.js'}`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: [
        'lit',
        /^lit\//,
        '@mogura/moguchart-core',
        'html2canvas-pro',
        'jspdf',
      ],
      output: {
        globals: {
          lit: 'Lit',
          '@mogura/moguchart-core': 'MoguchartCore',
          'html2canvas-pro': 'html2canvas',
          jspdf: 'jsPDF',
        },
      },
    },
  },
})
