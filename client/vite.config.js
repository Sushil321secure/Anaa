import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev proxy follows the API's own PORT (server/.env) so the two can never drift apart. Falls back to 4000.
function apiPort() {
  try {
    const m = readFileSync(new URL('../server/.env', import.meta.url), 'utf8').match(/^PORT\s*=\s*(\d+)/m);
    if (m) return m[1];
  } catch { /* no server/.env: use the default */ }
  return '4000';
}
const target = process.env.API_URL || `http://localhost:${process.env.API_PORT || apiPort()}`; // API_URL is set inside Docker

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target, changeOrigin: false }, '/socket.io': { target, ws: true } },
  },
});
