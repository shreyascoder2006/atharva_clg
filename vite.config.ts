import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Vendors change far less often than the app, so they get their own long-lived
        // chunks: three.js core, the React Three ecosystem, and the animation library.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/three\//.test(id)) return 'three';
          if (/@react-three|three-stdlib|camera-controls|troika|meshline/.test(id)) return 'r3f';
          if (/node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//.test(id)) return 'motion';
          return 'vendor';
        },
      },
    },
    // three.js core alone is ~700 kB minified (~180 kB gzip) and cannot be split further.
    chunkSizeWarningLimit: 800,
  },
});
