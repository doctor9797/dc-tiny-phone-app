import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      // 开发环境下，将 server.js 的 API 中间件注入 Vite dev server
      {
        name: 'api-middleware',
        configureServer: async (server) => {
          const mod = await import('./server.js');
          const apiApp = mod.default || mod;
          // vite dev server expects Connect.NextHandleFunction; Express app is compatible
          server.middlewares.use(apiApp as any);
        },
      },
    ],
    define: {},
    build: {
      // 确保 public/ 中的文件被复制到 dist/
      copyPublicDir: true,
      // 分块打包，首屏更快
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'framer-motion'],
            ui: ['lucide-react', 'recharts'],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      // 不再需要 proxy，API 由上面的 middleware 直接处理
    },
  };
});
