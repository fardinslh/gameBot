export type ClientPlatformType = 'bale' | 'eitaa' | 'telegram' | 'web';

export type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
export type HapticNotificationType = 'success' | 'warning' | 'error';

export interface ClientPlatformUser {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  photoUrl?: string;
  isPremium?: boolean;
}

export interface ClientPlatformTheme {
  bgColor: string;
  textColor: string;
  accentColor: string;
  surfaceColor: string;
  buttonColor: string;
  buttonTextColor: string;
  isDark: boolean;
}

export interface ShareOptions {
  text: string;
  url?: string;
}

export type PlatformEventType = 'viewportChanged' | 'themeChanged' | 'backButtonClicked' | 'appResumed' | 'appPaused';

export interface ClientPlatformAdapter {
  readonly platform: ClientPlatformType;

  /** Initializes platform SDKs, viewport hooks, and authentication states */
  initialize(): Promise<void>;

  /** Signals the mini-app host that the game UI has completed loading */
  ready(): void;

  /** Returns current authenticated user metadata or null if guest/web */
  getUser(): ClientPlatformUser | null;

  /** Raw authentication payload (e.g., Telegram initData) for backend validation */
  getInitDataRaw(): string;

  /** Returns current platform UI theme parameters */
  getTheme(): ClientPlatformTheme;

  /** Triggers haptic impact vibration */
  hapticImpact(style: HapticImpactStyle): void;

  /** Triggers haptic notification pattern (success, warning, error) */
  hapticNotification(type: HapticNotificationType): void;

  /** Triggers light selection tick haptic */
  hapticSelection(): void;

  /** Requests expanding the viewport to full mini-app height */
  expand(): void;

  /** Requests device fullscreen mode if supported by the host */
  requestFullscreen(): Promise<boolean>;

  /** Controls native platform Back Button visibility and click callback */
  showBackButton(onClick: () => void): void;
  hideBackButton(): void;

  /** Opens an external link safely through the messenger client */
  openLink(url: string): void;

  /** Invokes native messenger sharing / referral invite link */
  share(options: ShareOptions): Promise<boolean>;

  /** Subscribes to platform lifecycle or viewport events */
  on(event: PlatformEventType, callback: () => void): () => void;

  /** Closes the mini app window */
  close(): void;
}
