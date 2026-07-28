import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      // Bind-mounted volumes under Docker Desktop on Windows don't always
      // emit native fs events reliably — poll as a fallback.
      usePolling: true,
    },
  },
});
