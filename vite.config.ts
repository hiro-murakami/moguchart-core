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
            name: 'Moguchart',
            // 出力されるファイル名のベース
            fileName: 'moguchart',
            // 出力形式
            formats: ['es', 'umd'],
          },
          rollupOptions: {
            // ライブラリに含めたくない依存関係（litなど）を指定
            external: ['lit'],
            output: {
              globals: {
                lit: 'Lit',
              },
            },
          },
        },
})
