import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';

/**
 * Moves the HTML output from its mirrored source path to the dist root.
 * Vite mirrors the source tree for HTML entries; Chrome MV3 expects popup.html at dist root.
 */
function flattenHtmlPlugin(): Plugin {
  return {
    name: 'flatten-html',
    closeBundle() {
      const nested = resolve(__dirname, `${outDir}/src/popup/popup.html`);
      const flat = resolve(__dirname, `${outDir}/popup.html`);
      if (existsSync(nested)) {
        renameSync(nested, flat);
      }
    },
  };
}

/**
 * Generates browser-specific manifest.json based on the BROWSER env var.
 *
 *   BROWSER=chrome  → Chrome MV3 manifest (+ externally_connectable)
 *   BROWSER=edge    → Edge (Chromium, same as Chrome)
 *   BROWSER=opera   → Opera (Chromium, same as Chrome)
 *   BROWSER=brave   → Brave (Chromium, same as Chrome)
 *
 * Defaults to Chrome if BROWSER is unset.
 *
 * Firefox and Safari are not supported: the page↔extension bridge
 * (frontend ExtensionService) talks to `window.chrome.runtime` directly,
 * which those browsers don't expose to web pages, so the extension's
 * core mapping feature cannot work there regardless of manifest shape.
 */
function generateManifestPlugin(): Plugin {
  type Manifest = Record<string, unknown>;

  interface BrowserPatch {
    patch: Partial<Manifest>;
    remove: string[];
  }

  const patches: Record<string, BrowserPatch> = {
    chrome: {
      patch: {
        background: { service_worker: 'background.js', type: 'module' },
        externally_connectable: {
          matches: [
            'http://localhost:8080/*',
            'http://localhost:4200/*',
            'https://bi.dihm-muertos.site/*',
          ],
        },
        minimum_chrome_version: '112',
      },
      remove: [],
    },
  };

  // Chromium-based browsers share Chrome config
  for (const name of ['edge', 'opera', 'brave', 'chromium']) {
    patches[name] = patches.chrome;
  }

  return {
    name: 'generate-manifest',
    closeBundle() {
      const browser = (process.env.BROWSER || 'chrome').toLowerCase();
      const basePath = resolve(__dirname, 'manifest.json');
      const distDir = resolve(__dirname, outDir);

      const base = JSON.parse(readFileSync(basePath, 'utf-8')) as Manifest;
      const config = patches[browser] ?? patches.chrome;

      // Merge patches
      const manifest: Manifest = { ...base, ...config.patch };
      // Remove keys that don't apply
      for (const key of config.remove) {
        delete manifest[key];
      }

      if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
      writeFileSync(
        resolve(distDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n',
      );
      console.log(`  ✅ manifest.json generated for ${browser}`);
    },
  };
}

const outDir = process.env.EXTENSION_DIST || 'dist';

export default defineConfig({
  publicDir: 'public',
  plugins: [flattenHtmlPlugin(), generateManifestPlugin()],
  build: {
    outDir,
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
