import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Electron loads the built app via a file:// URL, where an absolute
  // base ('/') resolves asset paths to the filesystem root instead of
  // the app folder — this is what caused the blank white screen in
  // packaged builds. Relative paths work under file://, http, and https.
  base: './',
  // No PWA/service-worker plugin here on purpose: this app is only ever
  // distributed as a packaged Electron desktop app (see docs/DISTRIBUTION.md),
  // never a browser-hosted PWA, and service workers can't register on a
  // file:// origin anyway — a PWA plugin here would just be dead weight
  // (extra JS to parse, extra files in every installer) with nothing to do.
  plugins: [react(), tailwindcss()],
})
