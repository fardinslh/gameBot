'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { OnboardingStateResponse } from '@crown-and-coin/shared';
import { BookOpen, Crown, Volume2, X } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import { trackClientEvent } from '@/features/analytics/analytics-client';
import { useGameAudio } from '@/features/audio/audio-provider';
import { fetchOnboarding, skipOnboarding, startOnboarding } from './onboarding-api';

interface ExperienceContextValue {
  onboarding: OnboardingStateResponse | null;
  refreshOnboarding(): Promise<void>;
  openGuide(): void;
  openAudioSettings(): void;
}

const ExperienceContext = createContext<ExperienceContextValue | null>(null);

export function PlayerExperienceProvider({ children, dictionary: t }: { children: ReactNode; dictionary: Dictionary }) {
  const [onboarding, setOnboarding] = useState<OnboardingStateResponse | null>(null);
  const [panel, setPanel] = useState<'guide' | 'audio' | null>(null);
  const [error, setError] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const seenSteps = useRef(new Set<string>());
  const audio = useGameAudio();

  const refreshOnboarding = useCallback(async () => {
    try {
      const next = await fetchOnboarding();
      setOnboarding((current) => {
        if (current?.status === 'IN_PROGRESS' && next.status === 'COMPLETED') setShowCompletion(true);
        return next;
      });
      setError(false);
    }
    catch { setError(true); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchOnboarding(controller.signal).then(setOnboarding).catch((reason) => {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(true);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!onboarding || onboarding.status !== 'IN_PROGRESS' || seenSteps.current.has(onboarding.currentStep)) return;
    seenSteps.current.add(onboarding.currentStep);
    trackClientEvent('onboarding_step_seen', { step: onboarding.currentStep });
  }, [onboarding]);

  const begin = async (): Promise<void> => {
    audio.unlock();
    try {
      const next = await startOnboarding();
      setOnboarding(next);
      trackClientEvent('onboarding_started', { step: next.currentStep });
      audio.playSfx('panel_open');
      setError(false);
    } catch { setError(true); }
  };
  const skip = async (): Promise<void> => {
    try { setOnboarding(await skipOnboarding()); setConfirmSkip(false); setError(false); audio.playSfx('back'); }
    catch { setError(true); }
  };
  const openGuide = useCallback(() => { setPanel('guide'); audio.playSfx('panel_open'); }, [audio]);
  const openAudioSettings = useCallback(() => { setPanel('audio'); audio.playSfx('panel_open'); }, [audio]);
  const closePanel = (): void => { setPanel(null); audio.playSfx('back'); };
  const value = useMemo(() => ({ onboarding, refreshOnboarding, openGuide, openAudioSettings }), [onboarding, refreshOnboarding, openGuide, openAudioSettings]);

  return (
    <ExperienceContext.Provider value={value}>
      {children}
      {onboarding?.status === 'NOT_STARTED' ? (
        <div className="experience-backdrop" role="presentation">
          <section className="experience-welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" data-onboarding-step="WELCOME">
            <span className="experience-welcome__crest"><Crown aria-hidden="true" size={32} /></span>
            <h2 id="welcome-title">{t.experience.welcomeTitle}</h2>
            <p>{confirmSkip ? t.experience.skipConfirm : t.experience.welcomeBody}</p>
            {confirmSkip ? (
              <div className="experience-actions"><button onClick={() => void skip()} type="button">{t.experience.skip}</button><button className="experience-primary" onClick={() => setConfirmSkip(false)} type="button">{t.experience.continue}</button></div>
            ) : (
              <div className="experience-actions"><button onClick={() => setConfirmSkip(true)} type="button">{t.experience.skip}</button><button className="experience-primary" onClick={() => void begin()} type="button">{t.experience.begin}</button></div>
            )}
          </section>
        </div>
      ) : null}
      {showCompletion ? (
        <div className="experience-backdrop" role="presentation">
          <section className="experience-welcome" role="dialog" aria-modal="true" aria-labelledby="complete-title" data-onboarding-step="COMPLETE">
            <span className="experience-welcome__crest"><Crown aria-hidden="true" size={32} /></span>
            <h2 id="complete-title">{t.experience.completeTitle}</h2><p>{t.experience.completeBody}</p>
            <button className="experience-primary experience-complete-button" onClick={() => { setShowCompletion(false); audio.playSfx('ui_tap'); }} type="button">{t.experience.dismiss}</button>
          </section>
        </div>
      ) : null}
      {error ? <div className="experience-sync-error" role="status">{t.experience.unavailable}<button onClick={() => void refreshOnboarding()} type="button">{t.retry}</button></div> : null}
      {panel === 'guide' ? <GuidePanel dictionary={t} onClose={closePanel} /> : null}
      {panel === 'audio' ? <AudioSettingsPanel dictionary={t} onClose={closePanel} /> : null}
    </ExperienceContext.Provider>
  );
}

export function usePlayerExperience(): ExperienceContextValue {
  const value = useContext(ExperienceContext);
  if (!value) throw new Error('usePlayerExperience must be used inside PlayerExperienceProvider.');
  return value;
}

export function ExperienceControls({ dictionary: t }: { dictionary: Dictionary }) {
  const experience = usePlayerExperience();
  return (
    <div className="experience-controls">
      <button aria-label={t.experience.help} onClick={experience.openGuide} title={t.experience.help} type="button"><BookOpen aria-hidden="true" size={15} /></button>
      <button aria-label={t.experience.settings} onClick={experience.openAudioSettings} title={t.experience.settings} type="button"><Volume2 aria-hidden="true" size={15} /></button>
    </div>
  );
}

export function OnboardingCoach({ title, body, placement = 'top' }: { title: string; body: string; placement?: 'top' | 'bottom' }) {
  return <aside className={`onboarding-coach onboarding-coach--${placement}`} role="status"><strong>{title}</strong><span>{body}</span></aside>;
}

function GuidePanel({ dictionary: t, onClose }: { dictionary: Dictionary; onClose(): void }) {
  return (
    <div className="experience-backdrop experience-backdrop--panel">
      <section className="experience-panel" role="dialog" aria-modal="true" aria-labelledby="guide-title" data-experience-panel="guide">
        <header><span><BookOpen size={20} /></span><div><h2 id="guide-title">{t.experience.guideTitle}</h2><small>{t.experience.guideSubtitle}</small></div><button aria-label={t.close} onClick={onClose} type="button"><X size={18} /></button></header>
        <div className="guide-sections">{Object.values(t.experience.sections).map((section) => <article key={section.title}><h3>{section.title}</h3><p>{section.body}</p></article>)}</div>
      </section>
    </div>
  );
}

function AudioSettingsPanel({ dictionary: t, onClose }: { dictionary: Dictionary; onClose(): void }) {
  const { settings, setSettings, playSfx } = useGameAudio();
  const toggle = (key: 'masterEnabled' | 'musicEnabled' | 'sfxEnabled'): void => {
    setSettings({ ...settings, [key]: !settings[key] });
    if (key !== 'sfxEnabled' || !settings.sfxEnabled) playSfx('ui_tap');
  };
  const slider = (key: 'masterVolume' | 'musicVolume' | 'sfxVolume', value: string): void => setSettings({ ...settings, [key]: Number(value) });
  return (
    <div className="experience-backdrop experience-backdrop--panel">
      <section className="experience-panel audio-settings" role="dialog" aria-modal="true" aria-labelledby="audio-title" data-experience-panel="audio">
        <header><span><Volume2 size={20} /></span><div><h2 id="audio-title">{t.experience.audioTitle}</h2><small>{t.experience.audioSubtitle}</small></div><button aria-label={t.close} onClick={onClose} type="button"><X size={18} /></button></header>
        <AudioSettingRow label={t.experience.master} enabled={settings.masterEnabled} volume={settings.masterVolume} onToggle={() => toggle('masterEnabled')} onVolume={(value) => slider('masterVolume', value)} />
        <AudioSettingRow label={t.experience.music} enabled={settings.musicEnabled} volume={settings.musicVolume} onToggle={() => toggle('musicEnabled')} onVolume={(value) => slider('musicVolume', value)} />
        <AudioSettingRow label={t.experience.sfx} enabled={settings.sfxEnabled} volume={settings.sfxVolume} onToggle={() => toggle('sfxEnabled')} onVolume={(value) => slider('sfxVolume', value)} />
      </section>
    </div>
  );
}

function AudioSettingRow({ label, enabled, volume, onToggle, onVolume }: { label: string; enabled: boolean; volume: number; onToggle(): void; onVolume(value: string): void }) {
  return <div className="audio-setting-row"><label><span>{label}</span><input checked={enabled} onChange={onToggle} type="checkbox" /></label><input aria-label={`${label} volume`} disabled={!enabled} max="1" min="0" onChange={(event) => onVolume(event.target.value)} step="0.05" type="range" value={volume} /></div>;
}
