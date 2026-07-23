import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Step {
  number: number;
  text: string;
}

interface BrowserConfig {
  browser: string;
  label: string;
  icon: string;
  pattern: RegExp;
  size: string;
  configUrl: string;
  docsUrl: string;
  backgroundType: string;
}

@Component({
  selector: 'app-extension-setup',
  imports: [RouterLink],
  templateUrl: './extension-setup.component.html',
  styleUrl: './extension-setup.component.css',
})
export class ExtensionSetupComponent implements OnInit {
  detected: BrowserConfig | null = null;
  selected: BrowserConfig | null = null;
  extensionBuilt = false;

  readonly browsers: BrowserConfig[] = [
    {
      browser: 'chrome',
      label: 'Chrome / Brave / Opera',
      icon: '🌐',
      pattern: /chrome/i,
      size: '11 KB',
      configUrl: 'chrome://extensions/',
      docsUrl:
        'https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked',
      backgroundType: 'service_worker',
    },
    {
      browser: 'edge',
      label: 'Edge',
      icon: '🔷',
      pattern: /edg/i,
      size: '11 KB',
      configUrl: 'edge://extensions/',
      docsUrl:
        'https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading',
      backgroundType: 'service_worker',
    },
    {
      browser: 'opera',
      label: 'Opera',
      icon: '🔴',
      pattern: /opr/i,
      size: '11 KB',
      configUrl: 'opera://extensions/',
      docsUrl: 'https://help.opera.com/en/extensions/',
      backgroundType: 'service_worker',
    },
    {
      browser: 'brave',
      label: 'Brave',
      icon: '🦁',
      pattern: /brave/i,
      size: '11 KB',
      configUrl: 'brave://extensions/',
      docsUrl:
        'https://support.brave.com/hc/en-us/articles/360039229992-How-do-I-load-an-extension-in-Brave',
      backgroundType: 'service_worker',
    },
  ];

  ngOnInit(): void {
    this.detectBrowser();
    this.checkBuilds();
  }

  private detectBrowser(): void {
    const ua = navigator.userAgent;

    for (const b of this.browsers) {
      // Edge must be checked before Chrome (Edg matches chrome too)
      if (b.browser === 'edge' && /edg/i.test(ua)) {
        this.detected = b;
        this.selected = b;
        return;
      }
      if (b.browser === 'opera' && /opr/i.test(ua)) {
        this.detected = b;
        this.selected = b;
        return;
      }
      if (b.browser === 'brave' && /brave/i.test(ua)) {
        this.detected = b;
        this.selected = b;
        return;
      }
      if (b.browser === 'chrome' && /chrome/i.test(ua)) {
        this.detected = b;
        this.selected = b;
        return;
      }
    }

    // Fallback
    this.detected = this.browsers[0];
    this.selected = this.browsers[0];
  }

  private async checkBuilds(): Promise<void> {
    try {
      const resp = await fetch('/extensions/index.json');
      const builds = (await resp.json()) as { browser: string; size: string }[];

      // Update sizes from built zips
      for (const build of builds) {
        const match = this.browsers.find((b) => b.browser === build.browser);
        if (match) match.size = build.size;
      }

      this.extensionBuilt = true;
    } catch {
      // No built zips yet — show manual instructions
      this.extensionBuilt = false;
    }
  }

  selectBrowser(browser: string): void {
    this.selected = this.browsers.find((b) => b.browser === browser) ?? this.detected;
  }

  openConfigUrl(): void {
    if (this.selected?.configUrl) {
      window.open(this.selected.configUrl, '_blank');
    }
  }

  downloadExtension(): void {
    if (!this.selected) return;

    const url = `${window.location.origin}/extensions/${this.selected.browser}.zip`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `visual-scraper-${this.selected.browser}.zip`;
    a.click();
  }

  getSteps(): Step[] {
    return [
      { number: 1, text: 'Abrí la página de extensiones (botón "Configurar" arriba)' },
      { number: 2, text: 'Activá "Developer mode" (esquina superior derecha)' },
      { number: 3, text: 'Click en "Load unpacked"' },
      { number: 4, text: 'Descomprimí el .zip y seleccioná la carpeta' },
      { number: 5, text: '✅ Listo, la extensión ya funciona' },
    ];
  }
}
