import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: ['es2019', 'firefox91'],
  },
  server: {
    proxy: {
      '/api/fintraffic': {
        target: 'https://parking.fintraffic.fi',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fintraffic/, ''),
      },
      '/api/overpass': {
        target: 'https://overpass-api.de',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/overpass/, ''),
      },
    },
  },
});
