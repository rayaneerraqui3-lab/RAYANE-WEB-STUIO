import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'annonces-case-alias',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url && /^\/Annonces\.html(\?.*)?$/.test(req.url)) {
              req.url = req.url.replace('/Annonces.html', '/annonces.html');
            }
            next();
          });
        },
        closeBundle(error) {
          if (error) return;
          const distDir = path.resolve(__dirname, 'dist');
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
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          login: path.resolve(__dirname, 'login.html'),
          annonces: path.resolve(__dirname, 'annonces.html'),
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});