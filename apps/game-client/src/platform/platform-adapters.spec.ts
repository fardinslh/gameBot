import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  BaleClientPlatformAdapter,
  BrowserClientPlatformAdapter,
  createClientPlatformAdapter,
  EitaaClientPlatformAdapter,
  TelegramClientPlatformAdapter,
} from './client-platform';

describe('ClientPlatformAdapters', () => {
  let mockWindow: any;
  let mockNavigator: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockWindow = {
      location: new URL('https://game.crownandcoin.io/'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matchMedia: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
      }),
      open: vi.fn(),
      close: vi.fn(),
    };

    mockNavigator = {
      vibrate: vi.fn(),
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      share: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(globalThis, 'window', {
      value: mockWindow,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: mockNavigator,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: {
        documentElement: {
          requestFullscreen: vi.fn().mockResolvedValue(undefined),
        },
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    delete (mockWindow as any).BaleApp;
    delete (mockWindow as any).Bale;
    delete (mockWindow as any).Eitaa;
    delete (mockWindow as any).EitaaApp;
    delete (mockWindow as any).Telegram;
  });

  describe('createClientPlatformAdapter resolution priority', () => {
    it('resolves forced platform argument when specified', () => {
      const adapterBale = createClientPlatformAdapter('bale');
      expect(adapterBale.platform).toBe('bale');
      expect(adapterBale instanceof BaleClientPlatformAdapter).toBe(true);

      const adapterEitaa = createClientPlatformAdapter('eitaa');
      expect(adapterEitaa.platform).toBe('eitaa');
      expect(adapterEitaa instanceof EitaaClientPlatformAdapter).toBe(true);

      const adapterTelegram = createClientPlatformAdapter('telegram');
      expect(adapterTelegram.platform).toBe('telegram');
      expect(adapterTelegram instanceof TelegramClientPlatformAdapter).toBe(true);

      const adapterWeb = createClientPlatformAdapter('web');
      expect(adapterWeb.platform).toBe('web');
      expect(adapterWeb instanceof BrowserClientPlatformAdapter).toBe(true);
    });

    it('resolves platform from URL query parameter ?platform=bale', () => {
      mockWindow.location = new URL('https://game.crownandcoin.io/?platform=bale');

      const adapter = createClientPlatformAdapter();
      expect(adapter.platform).toBe('bale');
      expect(adapter instanceof BaleClientPlatformAdapter).toBe(true);
    });

    it('resolves platform from URL query parameter ?platform=eitaa', () => {
      mockWindow.location = new URL('https://game.crownandcoin.io/?platform=eitaa');

      const adapter = createClientPlatformAdapter();
      expect(adapter.platform).toBe('eitaa');
      expect(adapter instanceof EitaaClientPlatformAdapter).toBe(true);
    });

    it('resolves platform from URL query parameter ?platform=telegram', () => {
      mockWindow.location = new URL('https://game.crownandcoin.io/?platform=telegram');

      const adapter = createClientPlatformAdapter();
      expect(adapter.platform).toBe('telegram');
      expect(adapter instanceof TelegramClientPlatformAdapter).toBe(true);
    });

    it('falls back to BrowserClientPlatformAdapter when no platform detected', () => {
      mockWindow.location = new URL('https://game.crownandcoin.io/');

      const adapter = createClientPlatformAdapter();
      expect(adapter.platform).toBe('web');
      expect(adapter instanceof BrowserClientPlatformAdapter).toBe(true);
    });
  });

  describe('BaleClientPlatformAdapter', () => {
    it('uses bridge HapticFeedback if available', () => {
      const impactOccurred = vi.fn();
      const notificationOccurred = vi.fn();
      const selectionChanged = vi.fn();

      mockWindow.BaleApp = {
        HapticFeedback: {
          impactOccurred,
          notificationOccurred,
          selectionChanged,
        },
      };

      const adapter = new BaleClientPlatformAdapter();
      adapter.hapticImpact('medium');
      expect(impactOccurred).toHaveBeenCalledWith('medium');

      adapter.hapticNotification('success');
      expect(notificationOccurred).toHaveBeenCalledWith('success');

      adapter.hapticSelection();
      expect(selectionChanged).toHaveBeenCalled();
    });

    it('falls back to navigator.vibrate when bridge is absent', () => {
      const adapter = new BaleClientPlatformAdapter();
      adapter.hapticImpact('heavy');
      expect(mockNavigator.vibrate).toHaveBeenCalledWith(45);

      adapter.hapticNotification('error');
      expect(mockNavigator.vibrate).toHaveBeenCalledWith([50, 60, 50, 60, 50]);

      adapter.hapticSelection();
      expect(mockNavigator.vibrate).toHaveBeenCalledWith(8);
    });

    it('manages native BackButton visibility and callback', () => {
      const show = vi.fn();
      const hide = vi.fn();
      const onClickBridge = vi.fn();

      mockWindow.BaleApp = {
        BackButton: {
          show,
          hide,
          onClick: onClickBridge,
        },
      };

      const adapter = new BaleClientPlatformAdapter();
      const backCallback = vi.fn();

      adapter.showBackButton(backCallback);
      expect(show).toHaveBeenCalled();
      expect(onClickBridge).toHaveBeenCalledWith(backCallback);

      adapter.hideBackButton();
      expect(hide).toHaveBeenCalled();
    });

    it('provides Bale emerald branding in theme', () => {
      const adapter = new BaleClientPlatformAdapter();
      const theme = adapter.getTheme();
      expect(theme.accentColor).toBe('#00a389');
    });
  });

  describe('EitaaClientPlatformAdapter', () => {
    it('uses navigator.vibrate for tactile mobile feedback', () => {
      const adapter = new EitaaClientPlatformAdapter();
      adapter.hapticImpact('light');
      expect(mockNavigator.vibrate).toHaveBeenCalledWith(10);

      adapter.hapticNotification('success');
      expect(mockNavigator.vibrate).toHaveBeenCalledWith([20, 50, 30]);

      adapter.hapticSelection();
      expect(mockNavigator.vibrate).toHaveBeenCalledWith(8);
    });

    it('provides Eitaa orange accent in theme', () => {
      const adapter = new EitaaClientPlatformAdapter();
      const theme = adapter.getTheme();
      expect(theme.accentColor).toBe('#e67e22');
    });
  });

  describe('TelegramClientPlatformAdapter', () => {
    it('delegates haptics directly to Telegram WebApp API', () => {
      const impactOccurred = vi.fn();
      const notificationOccurred = vi.fn();
      const selectionChanged = vi.fn();

      mockWindow.Telegram = {
        WebApp: {
          HapticFeedback: {
            impactOccurred,
            notificationOccurred,
            selectionChanged,
          },
          initData: 'query_id=AAF&user=%7B%22id%22%3A123%7D',
        },
      };

      const adapter = new TelegramClientPlatformAdapter();
      adapter.hapticImpact('rigid');
      expect(impactOccurred).toHaveBeenCalledWith('rigid');

      adapter.hapticNotification('warning');
      expect(notificationOccurred).toHaveBeenCalledWith('warning');

      adapter.hapticSelection();
      expect(selectionChanged).toHaveBeenCalled();

      expect(adapter.getInitDataRaw()).toBe('query_id=AAF&user=%7B%22id%22%3A123%7D');
    });
  });

  describe('BrowserClientPlatformAdapter', () => {
    it('handles haptics without throwing when navigator.vibrate is unavailable', () => {
      delete mockNavigator.vibrate;
      const adapter = new BrowserClientPlatformAdapter();
      expect(() => {
        adapter.hapticImpact('light');
        adapter.hapticNotification('success');
        adapter.hapticSelection();
      }).not.toThrow();
    });

    it('supports subscription events via on() and emit', () => {
      const adapter = new BrowserClientPlatformAdapter();
      const callback = vi.fn();
      const unsubscribe = adapter.on('viewportChanged', callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });
});
