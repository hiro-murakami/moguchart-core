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
      name: 'MoguchartReact',
      fileName: (format) => `moguchart-react.${format === 'es' ? 'mjs' : 'umd.js'}`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'lit',
        /^lit\//,
        '@lit/react',
        '@mogura/moguchart-core',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@lit/react': 'LitReact',
          '@mogura/moguchart-core': 'MoguchartCore',
        },
      },
    },
  },
})
