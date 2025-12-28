import { defineConfig } from 'vite';

export default defineConfig({
  build: {
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
});
