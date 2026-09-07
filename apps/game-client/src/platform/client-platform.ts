import { BaleClientPlatformAdapter } from './bale-platform-adapter';
import { BrowserClientPlatformAdapter } from './browser-platform-adapter';
import type { ClientPlatformAdapter, ClientPlatformType } from './client-platform-adapter';
import { EitaaClientPlatformAdapter } from './eitaa-platform-adapter';
import { TelegramClientPlatformAdapter } from './telegram-platform-adapter';

export type ClientPlatform = ClientPlatformType;

export interface ClientPlatformContext {
  platform: ClientPlatform;
  launchPayload: string | null;
}

export function readPlatformContext(search: URLSearchParams): ClientPlatformContext {
  const requested = search.get('platform')?.toLowerCase();
  const platform: ClientPlatform =
    requested === 'bale' || requested === 'eitaa' || requested === 'telegram'
      ? requested
      : 'web';

  return {
    platform,
    launchPayload: search.get('launchPayload'),
  };
}

/**
 * Creates the appropriate platform adapter for the current runtime environment.
 * Priority hierarchy:
 * 1. URL search parameter `?platform=bale|eitaa|telegram|web`
 * 2. Window bridge objects (Bale -> Eitaa -> Telegram per Constitution)
 * 3. Browser fallback
 */
export function createClientPlatformAdapter(forcedPlatform?: ClientPlatformType): ClientPlatformAdapter {
  if (forcedPlatform) {
    switch (forcedPlatform) {
      case 'bale':
        return new BaleClientPlatformAdapter();
      case 'eitaa':
        return new EitaaClientPlatformAdapter();
      case 'telegram':
        return new TelegramClientPlatformAdapter();
      case 'web':
      default:
        return new BrowserClientPlatformAdapter();
    }
  }

  if (typeof window !== 'undefined') {
    // 1. Check explicit URL query param
    const params = new URLSearchParams(window.location.search);
    const paramPlatform = params.get('platform')?.toLowerCase();
    if (paramPlatform === 'bale') return new BaleClientPlatformAdapter();
    if (paramPlatform === 'eitaa') return new EitaaClientPlatformAdapter();
    if (paramPlatform === 'telegram') return new TelegramClientPlatformAdapter();
    if (paramPlatform === 'web') return new BrowserClientPlatformAdapter();

    // 2. Detect native messenger bridges (Bale -> Eitaa -> Telegram)
    if (window.BaleApp || window.Bale) {
      return new BaleClientPlatformAdapter();
    }
    if (window.EitaaApp || window.Eitaa) {
      return new EitaaClientPlatformAdapter();
    }
    if (window.Telegram?.WebApp && (window.Telegram.WebApp.initData || window.Telegram.WebApp.version)) {
      return new TelegramClientPlatformAdapter();
    }
  }

  // 3. Browser fallback
  return new BrowserClientPlatformAdapter();
}

export * from './client-platform-adapter';
export { BaleClientPlatformAdapter } from './bale-platform-adapter';
export { EitaaClientPlatformAdapter } from './eitaa-platform-adapter';
export { TelegramClientPlatformAdapter } from './telegram-platform-adapter';
export { BrowserClientPlatformAdapter } from './browser-platform-adapter';
