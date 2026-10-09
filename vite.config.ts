import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the same build works at /az-elex-manual/, at a PR preview
  // subfolder, and at a custom domain root.
  base: './',
})
