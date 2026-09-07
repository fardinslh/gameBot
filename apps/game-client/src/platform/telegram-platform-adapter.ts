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
    Telegram?: {
      WebApp?: any;
    };
  }
}

export class TelegramClientPlatformAdapter implements ClientPlatformAdapter {
  readonly platform: ClientPlatformType = 'telegram';

  private tg: any = null;
  private user: ClientPlatformUser | null = null;
  private backButtonCallback: (() => void) | null = null;
  private readonly listeners = new Map<PlatformEventType, Set<() => void>>();

  constructor() {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      this.tg = window.Telegram.WebApp;
    }
    this.user = this.extractTelegramUser();
  }

  async initialize(): Promise<void> {
    if (!this.tg) return;

    try {
      this.tg.ready?.();
      this.tg.expand?.();

      this.tg.onEvent?.('viewportChanged', () => this.emit('viewportChanged'));
      this.tg.onEvent?.('themeChanged', () => this.emit('themeChanged'));
      this.tg.onEvent?.('backButtonClicked', () => {
        this.emit('backButtonClicked');
        if (this.backButtonCallback) {
          this.backButtonCallback();
        }
      });
    } catch (err) {
      console.warn('[Platform:telegram] Failed during initialization:', err);
    }
  }

  ready(): void {
    try {
      this.tg?.ready?.();
    } catch {
      // Ignored
    }
  }

  getUser(): ClientPlatformUser | null {
    return this.user;
  }

  getInitDataRaw(): string {
    if (this.tg?.initData) {
      return this.tg.initData;
    }
    if (typeof window !== 'undefined' && window.location?.search) {
      return window.location.search.slice(1);
    }
    return '';
  }

  getTheme(): ClientPlatformTheme {
    const params = this.tg?.themeParams || {};
    const isDark = this.tg?.colorScheme === 'dark';

    return {
      bgColor: params.bg_color || (isDark ? '#17212b' : '#ffffff'),
      textColor: params.text_color || (isDark ? '#f5f5f5' : '#000000'),
      accentColor: params.link_color || '#2481cc',
      surfaceColor: params.secondary_bg_color || (isDark ? '#232e3c' : '#f4f4f5'),
      buttonColor: params.button_color || '#2481cc',
      buttonTextColor: params.button_text_color || '#ffffff',
      isDark,
    };
  }

  hapticImpact(style: HapticImpactStyle): void {
    if (this.tg?.HapticFeedback?.impactOccurred) {
      try {
        this.tg.HapticFeedback.impactOccurred(style);
        return;
      } catch {
        // Fallback
      }
    }

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
    if (this.tg?.HapticFeedback?.notificationOccurred) {
      try {
        this.tg.HapticFeedback.notificationOccurred(type);
        return;
      } catch {
        // Fallback
      }
    }

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
    if (this.tg?.HapticFeedback?.selectionChanged) {
      try {
        this.tg.HapticFeedback.selectionChanged();
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
      this.tg?.expand?.();
    } catch {
      // Ignored
    }
  }

  async requestFullscreen(): Promise<boolean> {
    try {
      if (this.tg?.requestFullscreen) {
        await this.tg.requestFullscreen();
        return true;
      }
    } catch {
      // Fallback
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
    if (this.tg?.BackButton) {
      try {
        this.tg.BackButton.onClick?.(onClick);
        this.tg.BackButton.show?.();
      } catch (err) {
        console.warn('[Platform:telegram] Failed to show BackButton:', err);
      }
    }
  }

  hideBackButton(): void {
    this.backButtonCallback = null;
    if (this.tg?.BackButton) {
      try {
        this.tg.BackButton.hide?.();
      } catch {
        // Ignored
      }
    }
  }

  openLink(url: string): void {
    if (this.tg?.openLink) {
      this.tg.openLink(url);
    } else if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  async share(options: ShareOptions): Promise<boolean> {
    if (this.tg?.openTelegramLink) {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(options.url || '')}&text=${encodeURIComponent(options.text)}`;
      this.tg.openTelegramLink(shareUrl);
      return true;
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
      this.tg?.close?.();
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
          console.error(`[Platform:telegram] Error in '${event}' callback:`, err);
        }
      }
    }
  }

  private extractTelegramUser(): ClientPlatformUser | null {
    try {
      const user = this.tg?.initDataUnsafe?.user;
      if (user?.id) {
        return {
          id: String(user.id),
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          languageCode: user.language_code,
          photoUrl: user.photo_url,
          isPremium: Boolean(user.is_premium),
        };
      }
    } catch {
      // Ignored
    }

    return null;
  }
}
