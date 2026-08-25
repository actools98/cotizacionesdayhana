import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    open: true,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
