import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// electron-vite bundles the three Electron parts (main, preload, renderer)
// with sensible defaults. See https://electron-vite.org/config
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
  },
})
