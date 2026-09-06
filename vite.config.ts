import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const businessName = env.VITE_BUSINESS_NAME || 'My Shop'

  return {
    // Electron loads the built app via a file:// URL, where an absolute
    // base ('/') resolves asset paths to the filesystem root instead of
    // the app folder — this is what caused the blank white screen in
    // packaged builds. Relative paths work under file://, http, and https.
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'pwa-icon.svg'],
        manifest: {
          name: `${businessName} POS`,
          short_name: businessName.length > 12 ? 'POS' : `${businessName} POS`,
          description: `Point of Sale for ${businessName} — built by REACH Digital Experts`,
          theme_color: '#f5c542',
          background_color: '#faf9f5',
          display: 'standalone',
          icons: [
            { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: 'pwa-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
          // exceljs pushes the main bundle past Workbox's 2MB default —
          // still small enough to precache comfortably for offline use.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        },
      }),
    ],
  }
})
