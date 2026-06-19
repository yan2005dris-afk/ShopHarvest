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
const BROWSERS = ['chrome', 'firefox', 'edge', 'safari'] as const;

const BROWSER_LABELS: Record<string, string> = {
  chrome:  'Chrome / Brave / Opera',
  firefox: 'Firefox',
  edge:    'Edge',
  safari:  'Safari',
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

  // Cleanup tmp
  if (existsSync(tmpDir)) execSync(`rm -rf "${tmpDir}"`);

  // Summary
  console.log(`\n✅ All extensions packaged → ${outDir}\n`);
  for (const browser of BROWSERS) {
    const zipPath = resolve(outDir, `${browser}.zip`);
    const sizeBytes = readFileSync(zipPath).length;
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    console.log(`   ${BROWSER_LABELS[browser]}: ${zipPath} (${sizeMB} MB)`);
  }

  // index.json for the frontend
  const index = BROWSERS.map((b) => ({
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
    chrome:  'chrome://extensions/',
    firefox: 'about:debugging#/runtime/this-firefox',
    edge:    'edge://extensions/',
    safari:  'x-apple.systempreferences:com.apple.Safari-Settings.extension',
  };
  return urls[browser] ?? urls.chrome;
}

function getDocsUrl(browser: string): string {
  const urls: Record<string, string> = {
    chrome:  'https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked',
    firefox: 'https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/',
    edge:    'https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading',
    safari:  'https://developer.apple.com/documentation/safariservices/safari_web_extensions/installing_and_managing_safari_extensions',
  };
  return urls[browser] ?? urls.chrome;
}

main();
