import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Dev-tooling only: allow preview access via cloudflared quick tunnels
  // (used by Atom's visual verification). Never used in production builds.
  preview: {
    allowedHosts: true,
  },
});
