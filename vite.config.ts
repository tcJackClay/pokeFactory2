import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

const POKEAPI_DEV_PROXY_PREFIX = '/api/pokeapi';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        [POKEAPI_DEV_PROXY_PREFIX]: {
          target: 'https://pokeapi.co',
          changeOrigin: true,
          secure: true,
          rewrite: (requestPath) => requestPath.replace(POKEAPI_DEV_PROXY_PREFIX, '/api/v2'),
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('factoryReferenceSets/chunks/')) {
              return 'factory-reference-sets';
            }
            if (id.includes('factoryTrainerTemplates.ts') || id.includes('factoryTrainerMonSetPools.ts')) {
              return 'factory-trainer-data';
            }
            if (id.includes('node_modules')) {
              return 'vendor';
            }
            return undefined;
          },
        },
      },
    },
  };
});
