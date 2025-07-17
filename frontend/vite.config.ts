import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import UnoCSS from '@unocss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), UnoCSS()],
  server: {
    port: 6173,
    host: '127.0.0.1',
    hmr: {
      overlay: false, // Disable error overlay
      clientErrorOverlay: false
    },
    // Suppress WebSocket connection errors in console
    ws: {
      // Increase ping timeout to reduce connection spam
      pingTimeout: 60000,
      // Custom error handling to suppress spam
      on: {
        error: (err: Error) => {
          // Suppress WebSocket connection errors from console spam
          if (err.message?.includes('WebSocket') || err.message?.includes('connection')) {
            return // Don't log WebSocket errors
          }
          console.error(err)
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['**/tests/e2e/**', '**/node_modules/**', '**/dist/**']
  }
})
