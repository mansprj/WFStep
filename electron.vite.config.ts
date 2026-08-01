import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// electron-vite bundles the three Electron parts (main, preload, renderer)
// with sensible defaults. See https://electron-vite.org/config
const sharedAlias = { '@shared': resolve(import.meta.dirname, 'src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: sharedAlias },
  },
  preload: {
    resolve: { alias: sharedAlias },
  },
  renderer: {
    plugins: [react()],
    resolve: { alias: sharedAlias },
  },
})
