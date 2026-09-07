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

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Eitaa?: any;
    EitaaApp?: any;
  }
}

export class EitaaClientPlatformAdapter implements ClientPlatformAdapter {
  readonly platform: ClientPlatformType = 'eitaa';

  private bridge: any = null;
  private user: ClientPlatformUser | null = null;
  private backButtonCallback: (() => void) | null = null;
  private readonly listeners = new Map<PlatformEventType, Set<() => void>>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.bridge = window.EitaaApp || window.Eitaa || null;
    }
    this.user = this.extractEitaaUser();
  }

  async initialize(): Promise<void> {
    if (!this.bridge) return;

    try {
      this.bridge.ready?.();
      this.bridge.expand?.();

      this.bridge.onEvent?.('viewportChanged', () => this.emit('viewportChanged'));
      this.bridge.onEvent?.('themeChanged', () => this.emit('themeChanged'));
      this.bridge.onEvent?.('backButtonClicked', () => {
        this.emit('backButtonClicked');
        if (this.backButtonCallback) {
          this.backButtonCallback();
        }
      });
    } catch (err) {
      console.warn('[Platform:eitaa] Failed during initialization:', err);
    }
  }

  ready(): void {
    try {
      this.bridge?.ready?.();
    } catch {
      // Ignored
    }
  }

  getUser(): ClientPlatformUser | null {
    return this.user;
  }

  getInitDataRaw(): string {
    if (this.bridge?.initData) {
      return this.bridge.initData;
    }
    if (typeof window !== 'undefined' && window.location?.search) {
      return window.location.search.slice(1);
    }
    return '';
  }

  getTheme(): ClientPlatformTheme {
    const params = this.bridge?.themeParams || {};
    const isDark = this.bridge?.colorScheme === 'dark';

    return {
      bgColor: params.bg_color || (isDark ? '#0d1117' : '#ffffff'),
      textColor: params.text_color || (isDark ? '#f0f6fc' : '#0d1117'),
      accentColor: params.link_color || '#e67e22', // Eitaa warm orange brand color
      surfaceColor: params.secondary_bg_color || (isDark ? '#161b22' : '#fff8f0'),
      buttonColor: params.button_color || '#e67e22',
      buttonTextColor: params.button_text_color || '#ffffff',
      isDark,
    };
  }

  hapticImpact(style: HapticImpactStyle): void {
    if (this.bridge?.HapticFeedback?.impactOccurred) {
      try {
        this.bridge.HapticFeedback.impactOccurred(style);
        return;
      } catch {
        // Fallback
      }
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        const durations: Record<HapticImpactStyle, number> = {
          light: 10,
          medium: 25,
          heavy: 50,
          rigid: 15,
          soft: 35,
        };
        navigator.vibrate(durations[style] || 15);
      } catch {
        // Ignore vibration errors
      }
    }
  }

  hapticNotification(type: HapticNotificationType): void {
    if (this.bridge?.HapticFeedback?.notificationOccurred) {
      try {
        this.bridge.HapticFeedback.notificationOccurred(type);
        return;
      } catch {
        // Fallback
      }
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        const patterns: Record<HapticNotificationType, number[]> = {
          success: [20, 50, 30],
          warning: [30, 80, 30],
          error: [50, 70, 50, 70, 50],
        };
        navigator.vibrate(patterns[type] || [20, 50, 30]);
      } catch {
        // Ignore vibration errors
      }
    }
  }

  hapticSelection(): void {
    if (this.bridge?.HapticFeedback?.selectionChanged) {
      try {
        this.bridge.HapticFeedback.selectionChanged();
        return;
      } catch {
        // Fallback
      }
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        // Ignore vibration errors
      }
    }
  }

  expand(): void {
    try {
      this.bridge?.expand?.();
    } catch {
      // Ignored
    }
  }

  async requestFullscreen(): Promise<boolean> {
    try {
      if (this.bridge?.requestFullscreen) {
        await this.bridge.requestFullscreen();
        return true;
      }
    } catch {
      // Fallback to HTML5 fullscreen
    }

    if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  showBackButton(onClick: () => void): void {
    this.backButtonCallback = onClick;
    if (this.bridge?.BackButton) {
      try {
        this.bridge.BackButton.onClick?.(onClick);
        this.bridge.BackButton.show?.();
      } catch (err) {
        console.warn('[Platform:eitaa] Failed to show BackButton:', err);
      }
    }
  }

  hideBackButton(): void {
    this.backButtonCallback = null;
    if (this.bridge?.BackButton) {
      try {
        this.bridge.BackButton.hide?.();
      } catch {
        // Ignored
      }
    }
  }

  openLink(url: string): void {
    if (this.bridge?.openLink) {
      this.bridge.openLink(url);
    } else if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  async share(options: ShareOptions): Promise<boolean> {
    const fullText = options.url ? `${options.text}\n${options.url}` : options.text;

    if (this.bridge?.share) {
      try {
        await this.bridge.share({ text: options.text, url: options.url });
        return true;
      } catch {
        // Fallback
      }
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Crown & Coin',
          text: options.text,
          url: options.url,
        });
        return true;
      } catch {
        return false;
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
    try {
      this.bridge?.close?.();
    } catch {
      // Ignored
    }
  }

  private emit(event: PlatformEventType): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb();
        } catch (err) {
          console.error(`[Platform:eitaa] Error in '${event}' callback:`, err);
        }
      }
    }
  }

  private extractEitaaUser(): ClientPlatformUser | null {
    try {
      const user = this.bridge?.initDataUnsafe?.user || this.bridge?.user;
      if (user?.id) {
        return {
          id: String(user.id),
          username: user.username,
          firstName: user.first_name || user.name,
          lastName: user.last_name,
          languageCode: user.language_code || 'fa',
          photoUrl: user.photo_url || user.avatar,
          isPremium: Boolean(user.is_premium),
        };
      }
    } catch {
      // Ignored
    }

    return null;
  }
}
