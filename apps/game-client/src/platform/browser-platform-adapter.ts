import type {
  ClientPlatformAdapter,
  ClientPlatformTheme,
  ClientPlatformType,
  ClientPlatformUser,
  HapticImpactStyle,
  HapticNotificationType,
  PlatformEventType,
  ShareOptions,
} from './client-platform-adapter';

export class BrowserClientPlatformAdapter implements ClientPlatformAdapter {
  readonly platform: ClientPlatformType = 'web';

  private backButtonCallback: (() => void) | null = null;
  private readonly listeners = new Map<PlatformEventType, Set<() => void>>();

  async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;

    window.addEventListener('resize', () => this.emit('viewportChanged'));
    window.addEventListener('focus', () => this.emit('appResumed'));
    window.addEventListener('blur', () => this.emit('appPaused'));

    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
      this.emit('themeChanged');
    });

    window.addEventListener('popstate', () => {
      this.emit('backButtonClicked');
      if (this.backButtonCallback) {
        this.backButtonCallback();
      }
    });
  }

  ready(): void {
    // Browser is ready immediately
  }

  getUser(): ClientPlatformUser | null {
    return null;
  }

  getInitDataRaw(): string {
    if (typeof window !== 'undefined' && window.location?.search) {
      return window.location.search.slice(1);
    }
    return '';
  }

  getTheme(): ClientPlatformTheme {
    const isDark = typeof window !== 'undefined'
      ? window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
      : true;

    return {
      bgColor: isDark ? '#12100d' : '#f5efe6',
      textColor: isDark ? '#f8fafc' : '#1c1917',
      accentColor: '#d4af37', // Crown & Coin classic royal gold
      surfaceColor: isDark ? '#1d1915' : '#ffffff',
      buttonColor: '#d4af37',
      buttonTextColor: '#12100d',
      isDark,
    };
  }

  hapticImpact(style: HapticImpactStyle): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        const durations: Record<HapticImpactStyle, number> = {
          light: 10,
          medium: 22,
          heavy: 45,
          rigid: 15,
          soft: 30,
        };
        navigator.vibrate(durations[style] || 15);
      } catch {
        // Ignore vibration errors
      }
    }
  }

  hapticNotification(type: HapticNotificationType): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        const patterns: Record<HapticNotificationType, number[]> = {
          success: [15, 60, 25],
          warning: [30, 80, 30],
          error: [50, 60, 50, 60, 50],
        };
        navigator.vibrate(patterns[type] || [15, 60, 25]);
      } catch {
        // Ignore vibration errors
      }
    }
  }

  hapticSelection(): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        // Ignore vibration errors
      }
    }
  }

  expand(): void {
    // Browser viewport is managed by window/CSS
  }

  async requestFullscreen(): Promise<boolean> {
    if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          return true;
        }
      } catch {
        return false;
      }
    }
    return false;
  }

  showBackButton(onClick: () => void): void {
    this.backButtonCallback = onClick;
  }

  hideBackButton(): void {
    this.backButtonCallback = null;
  }

  openLink(url: string): void {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  async share(options: ShareOptions): Promise<boolean> {
    const fullText = options.url ? `${options.text}\n${options.url}` : options.text;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Crown & Coin',
          text: options.text,
          url: options.url,
        });
        return true;
      } catch {
        // Ignore user cancellation or error
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(fullText);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  on(event: PlatformEventType, callback: () => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);

    return () => {
      set?.delete(callback);
    };
  }

  close(): void {
    if (typeof window !== 'undefined') {
      window.close();
    }
  }

  private emit(event: PlatformEventType): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb();
        } catch (err) {
          console.error(`[Platform:browser] Error in '${event}' callback:`, err);
        }
      }
    }
  }
}
