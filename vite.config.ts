import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [],
  server: {
    host: true,
    port: 5173
  },
  build: {
    chunkSizeWarningLimit: 2000
  }
})
