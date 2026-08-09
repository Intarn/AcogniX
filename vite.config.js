import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // React frontend is located inside the frontend directory.
  root: './frontend',

  // Load environment variables from the project root.
  envDir: '..',

  plugins: [
    react(),
    tailwindcss()
  ],

  // Development frontend server.
  server: {
    port: 5173
  },

  // Production frontend build output.
  build: {
    outDir: '../dist/frontend',
    emptyOutDir: true
  }
});
