import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  // O Phaser sozinho tem ~1,2 MB minificado.
  build: { chunkSizeWarningLimit: 1600 },
})
