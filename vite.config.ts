import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/rimina-academy/',
  plugins: [preact()],
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 1200 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30000 }, // 会話の全組み合わせのテストは重いので長めに
} as any);
