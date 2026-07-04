import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ExtensionFieldMapping {
  canonicalField: string;
  selector: string;
  type: 'text' | 'attribute' | 'html';
  attribute?: string;
}

export interface MappingCompletePayload {
  fieldMappings: ExtensionFieldMapping[];
  containerSelector: string | null;
  domain: string;
  pageTitle: string;
  products: Record<string, string | number | null>[];
}

export type ExtensionEvent =
  | { type: 'FIELD_ASSIGNED'; payload: ExtensionFieldMapping }
  | { type: 'MAPPING_COMPLETE'; payload: MappingCompletePayload }
  | { type: 'MAPPING_CANCELLED' }
  | { type: 'MAPPING_ERROR'; payload: { message: string } };

interface HandshakeMessage {
  type: '__VS_READY__';
  extensionId: string;
}

@Injectable({ providedIn: 'root' })
export class ExtensionService {
  private extensionId: string | null = null;
  readonly available$ = new BehaviorSubject<boolean>(false);

  constructor() {
    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      const data = e.data as Partial<HandshakeMessage>;
      if (data?.type === '__VS_READY__' && data.extensionId) {
        const firstTime = this.extensionId === null;
        this.extensionId = data.extensionId;
        if (firstTime) this.available$.next(true);
      }
    });

    // Ping — triggers content script to respond if already loaded
    window.postMessage({ type: '__VS_PING__' }, '*');
  }

  isAvailable(): boolean {
    return this.extensionId !== null;
  }

  openMapper(url: string): Observable<ExtensionEvent> {
    return new Observable<ExtensionEvent>((subscriber) => {
      if (!this.extensionId) {
        subscriber.error(new Error('Extension not available'));
        return;
      }

      // Chrome runtime is only available in extension context at runtime
      const cr = (window as unknown as { chrome?: typeof chrome })?.chrome;
      if (!cr?.runtime?.connect) {
        subscriber.error(new Error('Chrome runtime not available'));
        return;
      }

      let port: chrome.runtime.Port;
      try {
        port = cr.runtime.connect(this.extensionId, { name: 'mapping-session' });
      } catch (err) {
        subscriber.error(new Error(`Cannot connect to extension: ${err}`));
        return;
      }

      const messageListener = (msg: ExtensionEvent) => {
        subscriber.next(msg);
        if (
          msg.type === 'MAPPING_COMPLETE' ||
          msg.type === 'MAPPING_CANCELLED' ||
          msg.type === 'MAPPING_ERROR'
        ) {
          subscriber.complete();
        }
      };

      const disconnectListener = () => {
        const runtimeError = cr.runtime?.lastError?.message;
        if (!subscriber.closed) {
          subscriber.error(new Error(runtimeError ?? 'Extension disconnected unexpectedly'));
        }
      };

      port.onMessage.addListener(messageListener);
      port.onDisconnect.addListener(disconnectListener);
      port.postMessage({ type: 'OPEN_MAPPER', payload: { url } });

      return () => {
        port.onMessage.removeListener(messageListener);
        port.onDisconnect.removeListener(disconnectListener);
        port.disconnect();
      };
    });
  }

  // ── Auto-replay scheduling (batch 5) ──────────────────────────────────────
  // The extension owns the chrome.alarms; Angular just tells it what to run.

  setSchedule(
    domain: string,
    intervalMinutes: number,
    enabled: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    return this.sendExternal({
      type: 'SET_SCHEDULE',
      payload: { domain, intervalMinutes, enabled },
    });
  }

  getSchedules(): Promise<{ ok: boolean; schedules?: Record<string, ScheduleEntry> }> {
    return this.sendExternal({ type: 'GET_SCHEDULES' });
  }

  /**
   * Hands the current JWT to the extension so its background scheduler can call
   * the (now authenticated) backend. Rejects if the extension is unavailable.
   */
  setAuthToken(token: string): Promise<{ ok: boolean }> {
    return this.sendExternal({ type: 'SET_AUTH_TOKEN', payload: { token } });
  }

  private sendExternal<T>(message: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.extensionId) {
        reject(new Error('Extension not available'));
        return;
      }
      const cr = (window as unknown as { chrome?: typeof chrome })?.chrome;
      if (!cr?.runtime?.sendMessage) {
        reject(new Error('Chrome runtime not available'));
        return;
      }
      cr.runtime.sendMessage(this.extensionId, message, (response: T) => {
        const err = cr.runtime?.lastError?.message;
        if (err) {
          reject(new Error(err));
          return;
        }
        resolve(response);
      });
    });
  }
}

export interface ScheduleEntry {
  intervalMinutes: number;
  enabled: boolean;
  lastRunAt: number | null;
}
