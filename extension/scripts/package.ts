/**
 * Build + zip the extension for all supported browsers.
 *
 * Usage:
 *   pnpm package                         → outputs to ../../frontend/public/extensions/
 *   pnpm package --out ./my-zips         → outputs to ./my-zips/
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');
// Actually built via vite (distinct manifest patch).
const BROWSERS = ['chrome', 'edge'] as const;
// Same Chromium manifest/bridge as chrome — reuse chrome.zip under their own name
// so the setup page's per-browser download URL (`${browser}.zip`) resolves.
const ALIASES: Record<string, (typeof BROWSERS)[number]> = {
  opera: 'chrome',
  brave: 'chrome',
};
const ALL_BROWSERS = [...BROWSERS, ...Object.keys(ALIASES)];

const BROWSER_LABELS: Record<string, string> = {
  chrome: 'Chrome',
  edge:   'Edge',
  opera:  'Opera',
  brave:  'Brave',
};

function build(browser: string, outDir: string): void {
  console.log(`\n📦 Building for ${BROWSER_LABELS[browser] ?? browser}...`);

  execSync(`node_modules/.bin/vite build`, {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      BROWSER: browser,
      EXTENSION_DIST: outDir,
    },
  });
}

function zipDir(sourceDir: string, outputPath: string): void {
  // Remove existing zip first
  if (existsSync(outputPath)) {
    execSync(`rm "${outputPath}"`);
  }

  try {
    execSync(`cd "${sourceDir}" && zip -qr "${outputPath}" .`, { stdio: 'pipe' });
  } catch {
    execSync(`npx bestzip "${outputPath}" "${sourceDir}"`, { stdio: 'pipe' });
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const outDir = args.includes('--out')
    ? resolve(process.cwd(), args[args.indexOf('--out') + 1])
    : resolve(ROOT, '../frontend/public/extensions');

  mkdirSync(outDir, { recursive: true });

  const tmpDir = resolve(ROOT, 'tmp-dist');

  for (const browser of BROWSERS) {
    const browserOut = resolve(tmpDir, browser);
    if (existsSync(browserOut)) execSync(`rm -rf "${browserOut}"`);

    build(browser, browserOut);

    const zipPath = resolve(outDir, `${browser}.zip`);
    console.log(`  🗜️  Zipping → ${zipPath}`);
    zipDir(browserOut, zipPath);
  }

  for (const [alias, source] of Object.entries(ALIASES)) {
    const sourceZip = resolve(outDir, `${source}.zip`);
    const aliasZip = resolve(outDir, `${alias}.zip`);
    console.log(`  🔗 Aliasing ${source}.zip → ${alias}.zip`);
    execSync(`cp "${sourceZip}" "${aliasZip}"`);
  }

  // Cleanup tmp
  if (existsSync(tmpDir)) execSync(`rm -rf "${tmpDir}"`);

  // Summary
  console.log(`\n✅ All extensions packaged → ${outDir}\n`);
  for (const browser of ALL_BROWSERS) {
    const zipPath = resolve(outDir, `${browser}.zip`);
    const sizeBytes = readFileSync(zipPath).length;
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    console.log(`   ${BROWSER_LABELS[browser]}: ${zipPath} (${sizeMB} MB)`);
  }

  // index.json for the frontend
  const index = ALL_BROWSERS.map((b) => ({
    browser: b,
    label: BROWSER_LABELS[b],
    file: `${b}.zip`,
    size: (readFileSync(resolve(outDir, `${b}.zip`)).length / 1024).toFixed(0) + ' KB',
    configUrl: getConfigUrl(b),
    docsUrl: getDocsUrl(b),
  }));
  writeFileSync(resolve(outDir, 'index.json'), JSON.stringify(index, null, 2));

  console.log(`\n🌐 Open http://localhost:8080/setup to install`);
}

function getConfigUrl(browser: string): string {
  const urls: Record<string, string> = {
    chrome: 'chrome://extensions/',
    edge:   'edge://extensions/',
    opera:  'opera://extensions/',
    brave:  'brave://extensions/',
  };
  return urls[browser] ?? urls.chrome;
}

function getDocsUrl(browser: string): string {
  const urls: Record<string, string> = {
    chrome: 'https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked',
    edge:   'https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading',
    opera:  'https://help.opera.com/en/extensions/',
    brave:  'https://support.brave.com/hc/en-us/articles/360039229992-How-do-I-load-an-extension-in-Brave',
  };
  return urls[browser] ?? urls.chrome;
}

main();
