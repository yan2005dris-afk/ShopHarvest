import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { renameSync, existsSync, mkdirSync } from 'fs';

/**
 * Moves the HTML output from its mirrored source path to the dist root.
 * Vite mirrors the source tree for HTML entries; Chrome MV3 expects popup.html at dist root.
 */
function flattenHtmlPlugin(): Plugin {
  return {
    name: 'flatten-html',
    closeBundle() {
      const nested = resolve(__dirname, 'dist/src/popup/popup.html');
      const flat = resolve(__dirname, 'dist/popup.html');
      if (existsSync(nested)) {
        renameSync(nested, flat);
      }
    },
  };
}

export default defineConfig({
  publicDir: 'public',
  plugins: [flattenHtmlPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content/mapper.ts'),
        popup: resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        entryFileNames: (chunk) => `${chunk.name}.js`,
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: '[name].[ext]',
        format: 'es',
      },
    },
    target: 'chrome112',
    minify: false,
  },
});
