import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Vercel環境（process.env.VERCEL）または BUILD_MODE が 'demo' の場合はアプリとしてビルド
  build:
    process.env.BUILD_MODE === 'demo' || process.env.VERCEL
      ? {
          outDir: 'dist', // Vercelのデフォルト設定（dist）に合わせる
        }
      : {
          lib: {
            // エントリーポイント（index.d.tsの元になるファイル）
            entry: 'src/index.ts',
            // ライブラリ名（UMD形式などで使用されます）
            name: 'MoguchartCore',
            // 出力されるファイル名のベース
            fileName: 'moguchart-core',
            // 出力形式
            formats: ['es', 'umd'],
          },
          rollupOptions: {
            // peerDependencies と dependencies を外部化してバンドルに含めない
            external: [
              'lit',
              /^lit\//,
              'lodash',
              'dayjs',
              '@holiday-jp/holiday_jp',
              'html2canvas-pro',
              'jspdf',
            ],
            output: {
              globals: {
                lit: 'Lit',
                'lit/decorators.js': 'Lit',
                'lit/directives/repeat.js': 'Lit',
                'lit/directives/unsafe-html.js': 'Lit',
                lodash: '_',
                dayjs: 'dayjs',
                'html2canvas-pro': 'html2canvas',
                jspdf: 'jsPDF',
                '@holiday-jp/holiday_jp': 'HolidayJp',
              },
            },
          },
        },
})
