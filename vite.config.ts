import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    optimizeDeps: {
      include: ['@google/generative-ai'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      },
      proxy: {
        '/api/ocr': {
          target: 'http://clovaocr-api-kr.ncloud.com/external/v1/52328/4fdb26aa714cfb1dde640907f6dded4b4ea32425059d52c41d3538e0b0b3162a',
          changeOrigin: true,
          secure: false,
          headers: {
            'X-OCR-SECRET': 'aERjUWpIeHNVQWVYQWF4c0R3Z0VpaW9jaHpEQm5VaXA='
          },
          rewrite: (path) => path.replace(/^\/api\/ocr/, ''),
        },
        '/api/kakao-token': {
          target: 'https://kauth.kakao.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/kakao-token/, '/oauth/token'),
        },
        '/api/kakao-api': {
          target: 'https://kapi.kakao.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/kakao-api/, ''),
        },
      },
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 1000,
    },
  };
});
