import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ClientPlatformProvider, useSensoryFeedback, type SensoryFeedback } from './platform-provider';
import type { ClientPlatformAdapter } from './client-platform-adapter';

const mockPlaySfx = vi.fn();
vi.mock('@/features/audio/audio-provider', () => ({
  useGameAudio: () => ({
    playSfx: mockPlaySfx,
    setMusicContext: vi.fn(),
    unlock: vi.fn(),
    settings: { masterEnabled: true, musicEnabled: true, sfxEnabled: true, masterVolume: 1, musicVolume: 1, sfxVolume: 1 },
    setSettings: vi.fn(),
  }),
}));

describe('useSensoryFeedback hook', () => {
  let mockAdapter: ClientPlatformAdapter;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAdapter = {
      platform: 'web',
      initialize: vi.fn().mockResolvedValue(undefined),
      ready: vi.fn(),
      getUser: vi.fn().mockReturnValue(null),
      getInitDataRaw: vi.fn().mockReturnValue(''),
      getTheme: vi.fn().mockReturnValue({
        bgColor: '#000',
        textColor: '#fff',
        accentColor: '#d4af37',
        surfaceColor: '#111',
        buttonColor: '#d4af37',
        buttonTextColor: '#000',
        isDark: true,
      }),
      hapticImpact: vi.fn(),
      hapticNotification: vi.fn(),
      hapticSelection: vi.fn(),
      expand: vi.fn(),
      requestFullscreen: vi.fn().mockResolvedValue(true),
      showBackButton: vi.fn(),
      hideBackButton: vi.fn(),
      openLink: vi.fn(),
      share: vi.fn().mockResolvedValue(true),
      on: vi.fn().mockReturnValue(() => {}),
      close: vi.fn(),
    };
  });

  function captureSensory(): SensoryFeedback {
    let captured: SensoryFeedback | null = null;

    function TestConsumer() {
      captured = useSensoryFeedback();
      return null;
    }

    renderToStaticMarkup(
      <ClientPlatformProvider adapter={mockAdapter}>
        <TestConsumer />
      </ClientPlatformProvider>
    );

    if (!captured) throw new Error('SensoryFeedback was not captured');
    return captured;
  }

  it('triggers light haptic and ui_tap on tap()', () => {
    const sensory = captureSensory();
    sensory.tap();

    expect(mockAdapter.hapticImpact).toHaveBeenCalledWith('light');
    expect(mockPlaySfx).toHaveBeenCalledWith('ui_tap');
  });

  it('triggers selection haptic and building_select on select()', () => {
    const sensory = captureSensory();
    sensory.select();

    expect(mockAdapter.hapticSelection).toHaveBeenCalled();
    expect(mockPlaySfx).toHaveBeenCalledWith('building_select');
  });

  it('triggers medium haptic and collect sfx on collect()', () => {
    const sensory = captureSensory();
    sensory.collect();

    expect(mockAdapter.hapticImpact).toHaveBeenCalledWith('medium');
    expect(mockPlaySfx).toHaveBeenCalledWith('collect');
  });

  it('triggers medium haptic and upgrade_start on upgradeStart()', () => {
    const sensory = captureSensory();
    sensory.upgradeStart();

    expect(mockAdapter.hapticImpact).toHaveBeenCalledWith('medium');
    expect(mockPlaySfx).toHaveBeenCalledWith('upgrade_start');
  });

  it('triggers success notification and upgrade_complete on upgradeComplete()', () => {
    const sensory = captureSensory();
    sensory.upgradeComplete();

    expect(mockAdapter.hapticNotification).toHaveBeenCalledWith('success');
    expect(mockPlaySfx).toHaveBeenCalledWith('upgrade_complete');
  });

  it('triggers victory and defeat sensory outputs', () => {
    const sensory = captureSensory();

    sensory.victory();
    expect(mockAdapter.hapticNotification).toHaveBeenCalledWith('success');
    expect(mockPlaySfx).toHaveBeenCalledWith('victory');

    sensory.defeat();
    expect(mockAdapter.hapticNotification).toHaveBeenCalledWith('error');
    expect(mockPlaySfx).toHaveBeenCalledWith('defeat');
  });
});
