import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/Digital-Signature-Chat-Application/',
  plugins: [react()],
  define: {
    // Polyfill process.env for some libs
    'process.env': {},
  },
  resolve: {
    alias: {
      // Polyfill Buffer if needed by dependencies
      buffer: 'buffer/',
    }
  }
})
