import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@mogura/moguchart-core': path.resolve(import.meta.dirname, './src/index.ts'),
      '@mogura/moguchart-plugin-export': path.resolve(import.meta.dirname, '../plugin-export/src/index.ts'),
    },
  },
  // Vercel環境（process.env.VERCEL）または BUILD_MODE が 'demo' の場合はアプリとしてビルド
  build:
    process.env.BUILD_MODE === 'demo' || process.env.VERCEL
      ? {
        outDir: process.env.BUILD_MODE === 'demo' ? 'dist-demo' : 'dist',
      }
      : {
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
          // peerDependencies と dependencies を外部化してバンドルに含めない
          external: [
            'lit',
            /^lit\//,
            'lodash-es',
            'dayjs',
          ],
          output: {
            globals: {
              lit: 'Lit',
              'lit/decorators.js': 'Lit',
              'lit/directives/repeat.js': 'Lit',
              'lit/directives/unsafe-html.js': 'Lit',
              'lodash-es': '_',
              dayjs: 'dayjs',
            },
          },
        },
      },
})
