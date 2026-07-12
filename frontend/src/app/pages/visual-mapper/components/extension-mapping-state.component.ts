import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-extension-mapping-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="vm-centered">
      <div class="vm-status-card">
        <div class="vm-pulse">
          <div class="vm-pulse-ring"></div>
          <div class="vm-pulse-dot"></div>
        </div>
        <p class="vm-status-title">Extension tab is open</p>
        <p class="vm-status-sub">Click elements on the page to assign fields, then click "Finish Mapping"</p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex: 1; }
    .vm-centered { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem; }
    .vm-status-card { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; max-width: 360px; }
    .vm-status-title { margin: 0; font-size: 1.125rem; font-weight: 600; color: var(--text-1); }
    .vm-status-sub { margin: 0; font-size: 0.875rem; color: var(--text-2); line-height: 1.5; }
    .vm-pulse { position: relative; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; }
    .vm-pulse-ring { position: absolute; width: 52px; height: 52px; border-radius: 50%; background: var(--accent-dim); animation: pulse-ring 1.5s ease-out infinite; }
    .vm-pulse-dot { width: 16px; height: 16px; border-radius: 50%; background: var(--accent); }
    @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
  `],
})
export class ExtensionMappingStateComponent {}