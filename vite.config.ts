import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        // Keep shared CommonJS helpers out of Phaser, so the startup UI can load without it.
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.replaceAll('\\', '/').includes('/node_modules/phaser/')) return 'phaser';
        },
      },
    },
  },
});
