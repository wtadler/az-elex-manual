import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the same build works at /az-elex-manual/, at a PR preview
  // subfolder, and at a custom domain root.
  base: './',
  // Agent worktrees live under .claude/; don't run their copies of the tests.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
})
