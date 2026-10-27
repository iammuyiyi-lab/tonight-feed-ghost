import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

function generateSWPrecachePlugin() {
  return {
    name: 'generate-sw-precache',
    closeBundle() {
      const distDir = path.resolve(import.meta.dirname || process.cwd(), 'dist');
      if (!fs.existsSync(distDir)) return;

      const assets: string[] = ['./', './index.html'];

      function scanDir(dir: string, prefix = './') {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'sw.js' || entry.name.endsWith('.map') || entry.name === '.git') continue;
          const fullPath = path.join(dir, entry.name);
          const relPath = prefix + entry.name;
          if (entry.isDirectory()) {
            scanDir(fullPath, relPath + '/');
          } else {
            assets.push(relPath);
          }
        }
      }

      scanDir(distDir);

      const swPath = path.join(distDir, 'sw.js');
      if (fs.existsSync(swPath)) {
        let swContent = fs.readFileSync(swPath, 'utf-8');
        const manifestDeclaration = `// Auto-generated precache list at build time\nself.__PRECACHE_ASSETS = ${JSON.stringify(Array.from(new Set(assets)), null, 2)};\n\n`;
        swContent = manifestDeclaration + swContent;
        fs.writeFileSync(swPath, swContent, 'utf-8');
        console.log(`[PWA SW] Precached ${assets.length} production assets into dist/sw.js`);
      }
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 4096,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  plugins: [generateSWPrecachePlugin()],
});
