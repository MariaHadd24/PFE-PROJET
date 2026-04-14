import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const backendPort = Number(process.env.PFE_BACKEND_PORT || process.env.VITE_BACKEND_PORT || 8001)
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${backendPort}`

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: ['pfe.leoni'],
    proxy: {
      // Explicit WS endpoint proxy (more reliable than relying on the '/api' matcher)
      '/api/ws': {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
