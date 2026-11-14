import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@mogura/moguchart-core': path.resolve(import.meta.dirname, './src/index.ts'),
      '@mogura/moguchart-plugin-export': path.resolve(import.meta.dirname, '../plugin-export/src/index.ts'),
      '@mogura/moguchart-plugin-excel': path.resolve(import.meta.dirname, '../plugin-excel/src/index.ts'),
    },
  },
  // Vercel環境（process.env.VERCEL）または BUILD_MODE が 'demo' の場合はアプリとしてビルド
  build:
    process.env.BUILD_MODE === 'demo' || process.env.VERCEL
      ? {
        outDir: process.env.BUILD_MODE === 'demo' ? 'dist-demo' : 'dist',
      }
      : {
        copyPublicDir: false,
        lib: {
          // エントリーポイント（index.d.tsの元になるファイル）
          entry: 'src/index.ts',
          // ライブラリ名（UMD形式などで使用されます）
          name: 'MoguchartCore',
          // 出力されるファイル名
          fileName: (format) => `moguchart-core.${format === 'es' ? 'mjs' : 'umd.js'}`,
          // 出力形式
          formats: ['es', 'umd'],
        },
        rollupOptions: {
          // peerDependencies (lit) のみを外部化（ゼロランタイム依存）
          external: [
            'lit',
            /^lit\//,
          ],
          output: {
            globals: {
              lit: 'Lit',
              'lit/decorators.js': 'Lit',
              'lit/directives/repeat.js': 'Lit',
              'lit/directives/unsafe-html.js': 'Lit',
            },
          },
        },
      },
})
