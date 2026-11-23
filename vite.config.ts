import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'studio-mpa-helpers',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url && /^\/Annonces\.html(\?.*)?$/.test(req.url)) {
              req.url = req.url.replace('/Annonces.html', '/annonces.html');
            }
            next();
          });
        },
        closeBundle(error?: Error): void {
          if (error) return;
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
          const lower = path.resolve(distDir, 'annonces.html');
          const upper = path.resolve(distDir, 'Annonces.html');
          if (fs.existsSync(lower)) {
            fs.copyFileSync(lower, upper);
          }
          const fbConfig = path.resolve(__dirname, 'firebase-applet-config.json');
          if (fs.existsSync(distDir) && fs.existsSync(fbConfig)) {
            fs.copyFileSync(fbConfig, path.resolve(distDir, 'firebase-applet-config.json'));
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          login: path.resolve(__dirname, 'login.html'),
          messages: path.resolve(__dirname, 'messages.html'),
          annonces: path.resolve(__dirname, 'annonces.html'),
          publications: path.resolve(__dirname, 'publications.html'),
          parrametre: path.resolve(__dirname, 'parrametre.html'),
          recherche: path.resolve(__dirname, 'recherche.html'),
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
