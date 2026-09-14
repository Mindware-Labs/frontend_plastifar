import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
/** La CSP del index.html es para produccion: en desarrollo bloquearia el preámbulo inline de React Refresh y el HMR. */
const stripCspInDev = {
  name: "plf-strip-csp-in-dev",
  apply: "serve" as const,
  transformIndexHtml(html: string) {
    return html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>\s*/i, "");
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), stripCspInDev],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
})
