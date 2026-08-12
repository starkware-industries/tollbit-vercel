import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { CLIENT_ASSET_DIR } from './shared/constants';

export default defineConfig({
  plugins: [react()],
  // Vercel serves static files from public/**; publicDir is disabled so it isn't also
  // treated as a source directory to copy from.
  publicDir: false,
  build: { outDir: CLIENT_ASSET_DIR, emptyOutDir: true },
  appType: 'custom',
});
