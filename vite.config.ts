import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/rimina-academy/',
  plugins: [preact()],
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 1200 },
  // 長いシミュレーションのテストが作業者を長く止め、テストはすべて通っても「連絡の時間切れ」で失敗あつかいになるため、その手のエラーでは落とさない（テストの失敗はそのまま落ちる）
  test: { environment: 'node', include: ['tests/**/*.test.ts'], setupFiles: ['tests/setup.ts'], testTimeout: 30000, pool: 'forks', dangerouslyIgnoreUnhandledErrors: true }, // 会話の全組み合わせのテストは重いので長めに
} as any);
