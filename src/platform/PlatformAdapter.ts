export interface PlatformAdapter {
  analytics(event: string, payload?: Record<string, unknown>): void;
  achievement(id: string): Promise<void>;
  fullscreen(): Promise<void>;
}

export class BrowserPlatformAdapter implements PlatformAdapter {
  analytics(event: string, payload: Record<string, unknown> = {}): void {
    console.info('[analytics]', event, payload);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gg-analytics', { detail: { event, payload } }));
    }
  }

  async achievement(_id: string): Promise<void> {
    return;
  }

  async fullscreen(): Promise<void> {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    }
  }
}
