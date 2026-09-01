'use client';

import { createContext, type CSSProperties, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AdvisorTipKey, OnboardingStateResponse } from '@crown-and-coin/shared';
import { BookOpen, Volume2, X } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import { trackClientEvent } from '@/features/analytics/analytics-client';
import { useGameAudio } from '@/features/audio/audio-provider';
import { dismissAdvisorTip, fetchAdvisorTips } from './advisor-api';
import { calculateAdvisorPlacement, toRect, type AdvisorPlacement } from './advisor-positioning';
import { fetchOnboarding, skipOnboarding, startOnboarding } from './onboarding-api';

export type GuideTarget = 'collect' | 'upgrade' | 'raid-tab' | 'find-enemy' | 'attack' | 'result-return';

interface ExperienceContextValue {
  dictionary: Dictionary;
  onboarding: OnboardingStateResponse | null;
  refreshOnboarding(): Promise<void>;
  openGuide(): void;
  openAudioSettings(): void;
  requestAdvisorTip(tip: AdvisorTipKey): void;
}

const ExperienceContext = createContext<ExperienceContextValue | null>(null);
const AREN_PORTRAIT = '/assets/advisor/aren-current-candidate.webp';

export function PlayerExperienceProvider({ children, dictionary: t }: { children: ReactNode; dictionary: Dictionary }) {
  const [onboarding, setOnboarding] = useState<OnboardingStateResponse | null>(null);
  const [seenTips, setSeenTips] = useState<Set<AdvisorTipKey>>(new Set());
  const [tipsLoaded, setTipsLoaded] = useState(false);
  const [tipQueue, setTipQueue] = useState<AdvisorTipKey[]>([]);
  const activeTip = tipQueue[0] ?? null;
  const [panel, setPanel] = useState<'guide' | 'audio' | null>(null);
  const [error, setError] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const seenSteps = useRef(new Set<string>());
  const sessionTips = useRef(new Set<AdvisorTipKey>());
  const audio = useGameAudio();

  const refreshOnboarding = useCallback(async () => {
    try {
      const next = await fetchOnboarding();
      setOnboarding((current) => {
        if (current?.status === 'IN_PROGRESS' && next.status === 'COMPLETED') setShowCompletion(true);
        return next;
      });
      setError(false);
    } catch { setError(true); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchOnboarding(controller.signal).then(setOnboarding).catch((reason) => {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setError(true);
    });
    void fetchAdvisorTips(controller.signal)
      .then((tips) => setSeenTips(new Set(tips.seen)))
      .catch(() => undefined)
      .finally(() => setTipsLoaded(true));
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
      const next = await startOnboarding(); setOnboarding(next);
      trackClientEvent('onboarding_started', { step: next.currentStep }); audio.playSfx('panel_open'); setError(false);
    } catch { setError(true); }
  };
  const skip = async (): Promise<void> => {
    try { setOnboarding(await skipOnboarding()); setConfirmSkip(false); setError(false); audio.playSfx('back'); }
    catch { setError(true); }
  };
  const requestAdvisorTip = useCallback((tip: AdvisorTipKey) => {
    if (!tipsLoaded || panel || showCompletion || onboarding?.status === 'NOT_STARTED' || onboarding?.status === 'IN_PROGRESS') return;
    if (seenTips.has(tip) || sessionTips.current.has(tip)) return;
    sessionTips.current.add(tip); setTipQueue((current) => [...current, tip]);
  }, [onboarding?.status, panel, seenTips, showCompletion, tipsLoaded]);
  const dismissTip = async (): Promise<void> => {
    if (!activeTip) return;
    const tip = activeTip; setTipQueue((current) => current.slice(1)); audio.playSfx('ui_tap');
    setSeenTips((current) => new Set(current).add(tip));
    try { const response = await dismissAdvisorTip(tip); setSeenTips((current) => new Set([...current, ...response.seen])); } catch { /* presentation state never blocks play */ }
  };
  const openGuide = useCallback(() => { setPanel('guide'); audio.playSfx('panel_open'); }, [audio]);
  const openAudioSettings = useCallback(() => { setPanel('audio'); audio.playSfx('panel_open'); }, [audio]);
  const closePanel = (): void => { setPanel(null); audio.playSfx('back'); };
  const value = useMemo(() => ({ dictionary: t, onboarding, refreshOnboarding, openGuide, openAudioSettings, requestAdvisorTip }), [t, onboarding, refreshOnboarding, openGuide, openAudioSettings, requestAdvisorTip]);

  return (
    <ExperienceContext.Provider value={value}>
      {children}
      {onboarding?.status === 'NOT_STARTED' ? (
        <div className="experience-backdrop" role="presentation">
          <section className="experience-welcome experience-welcome--aren" role="dialog" aria-modal="true" aria-labelledby="welcome-title" data-onboarding-step="WELCOME">
            <AdvisorIdentity dictionary={t} large />
            <h2 id="welcome-title">{t.experience.welcomeTitle}</h2><p>{confirmSkip ? t.experience.skipConfirm : t.experience.advisor.welcome}</p>
            {confirmSkip ? <div className="experience-actions"><button onClick={() => void skip()} type="button">{t.experience.skip}</button><button className="experience-primary" onClick={() => setConfirmSkip(false)} type="button">{t.experience.continue}</button></div>
              : <div className="experience-actions"><button onClick={() => setConfirmSkip(true)} type="button">{t.experience.skip}</button><button className="experience-primary" onClick={() => void begin()} type="button">{t.experience.begin}</button></div>}
          </section>
        </div>
      ) : null}
      {showCompletion ? (
        <div className="experience-backdrop" role="presentation">
          <section className="experience-welcome experience-welcome--aren" role="dialog" aria-modal="true" aria-labelledby="complete-title" data-onboarding-step="COMPLETE">
            <AdvisorIdentity dictionary={t} large /><h2 id="complete-title">{t.experience.completeTitle}</h2><p>{t.experience.advisor.complete}</p>
            <button className="experience-primary experience-complete-button" onClick={() => { setShowCompletion(false); audio.playSfx('ui_tap'); }} type="button">{t.experience.dismiss}</button>
          </section>
        </div>
      ) : null}
      {activeTip && !panel && !showCompletion ? <ContextualAdvisorTip dictionary={t} onDismiss={() => void dismissTip()} tip={activeTip} /> : null}
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
  return <div className="experience-controls"><button aria-label={t.experience.help} onClick={experience.openGuide} title={t.experience.help} type="button"><BookOpen aria-hidden="true" size={15} /></button><button aria-label={t.experience.settings} onClick={experience.openAudioSettings} title={t.experience.settings} type="button"><Volume2 aria-hidden="true" size={15} /></button></div>;
}

export function AdvisorCoach({ title, body, target, durationMs }: { title: string; body: string; target?: GuideTarget; durationMs?: number }) {
  const { dictionary: t } = usePlayerExperience();
  const coachRef = useRef<HTMLElement>(null);
  const [placement, setPlacement] = useState<AdvisorPlacement | null>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => { setVisible(true); if (!durationMs) return; const timer = window.setTimeout(() => setVisible(false), durationMs); return () => clearTimeout(timer); }, [body, durationMs]);
  useEffect(() => {
    if (!visible) return;
    const coach = coachRef.current;
    if (!coach) return;
    const safeInsets = readSafeAreaInsets();
    let targetElement: HTMLElement | null = null;
    let observedTarget: HTMLElement | null = null;
    let frame = 0;
    let motionFrame = 0;
    let motionUntil = 0;
    let scrolled = false;
    const update = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        targetElement = target ? document.querySelector<HTMLElement>(`[data-guide-target="${target}"]`) : null;
        if (targetElement && targetElement !== observedTarget) {
          observedTarget?.removeAttribute('data-guide-active');
          observedTarget = targetElement;
          observedTarget.setAttribute('data-guide-active', 'true');
          observer.observe(observedTarget);
        }
        const viewport = window.visualViewport;
        const width = viewport?.width ?? window.innerWidth;
        const height = viewport?.height ?? window.innerHeight;
        const coachRect = coach.getBoundingClientRect();
        if (!targetElement) {
          setPlacement({ side: 'fallback', left: Math.max(8, (width - coachRect.width) / 2), top: (viewport?.offsetTop ?? 0) + 146 });
          return;
        }
        let targetRect = targetElement.getBoundingClientRect();
        if (!scrolled && (targetRect.bottom < 0 || targetRect.top > height)) {
          scrolled = true;
          targetElement.scrollIntoView({ block: 'nearest', behavior: 'auto' });
          targetRect = targetElement.getBoundingClientRect();
        }
        const hudBottom = [...document.querySelectorAll<HTMLElement>('.player-hud, .resource-hud')].reduce((bottom, element) => Math.max(bottom, element.getBoundingClientRect().bottom), 0);
        setPlacement(calculateAdvisorPlacement(toRect(targetRect), { width: coachRect.width, height: coachRect.height }, { width, height, offsetLeft: viewport?.offsetLeft, offsetTop: viewport?.offsetTop, safeTop: safeInsets.top, safeBottom: safeInsets.bottom, reservedTop: hudBottom ? hudBottom + 8 : undefined }));
      });
    };
    const followMotion = (): void => {
      motionUntil = performance.now() + 360;
      if (motionFrame) return;
      const tick = (): void => {
        update();
        if (performance.now() < motionUntil) motionFrame = requestAnimationFrame(tick);
        else motionFrame = 0;
      };
      tick();
    };
    const observer = new ResizeObserver(update); observer.observe(coach);
    const mutations = new MutationObserver(followMotion); mutations.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('transitionrun', followMotion, true);
    document.addEventListener('animationstart', followMotion, true);
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update); window.visualViewport?.addEventListener('scroll', update); followMotion();
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(motionFrame); observer.disconnect(); mutations.disconnect(); observedTarget?.removeAttribute('data-guide-active');
      document.removeEventListener('transitionrun', followMotion, true);
      document.removeEventListener('animationstart', followMotion, true);
      window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update); window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [target, visible]);
  if (!visible) return null;
  const style = placement ? ({ left: placement.left, top: placement.top, visibility: 'visible' } satisfies CSSProperties) : undefined;
  return <aside className="advisor-coach" data-placement={placement?.side} ref={coachRef} role="status" style={style}><img alt="" aria-hidden="true" src={AREN_PORTRAIT} /><div><small>{t.experience.advisor.name} · {t.experience.advisor.role}</small><strong>{title}</strong><span>{body}</span></div></aside>;
}

function readSafeAreaInsets(): { top: number; bottom: number } {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.append(probe);
  const style = getComputedStyle(probe);
  const result = { top: Number.parseFloat(style.paddingTop) || 0, bottom: Number.parseFloat(style.paddingBottom) || 0 };
  probe.remove();
  return result;
}

function AdvisorIdentity({ dictionary: t, large = false }: { dictionary: Dictionary; large?: boolean }) {
  return <div className={large ? 'advisor-identity advisor-identity--large' : 'advisor-identity'}><img alt="" aria-hidden="true" src={AREN_PORTRAIT} /><span><strong>{t.experience.advisor.name}</strong><small>{t.experience.advisor.role}</small></span></div>;
}

function ContextualAdvisorTip({ dictionary: t, tip, onDismiss }: { dictionary: Dictionary; tip: AdvisorTipKey; onDismiss(): void }) {
  const copy: Record<AdvisorTipKey, string> = { HEROES_INTRO: t.experience.advisor.heroes, CASTLE_PROGRESSION: t.experience.advisor.castle, NEW_KINGDOM_SHIELD: t.experience.advisor.shield, DEFENSE_INBOX: t.experience.advisor.defense, REVENGE: t.experience.advisor.revenge, CAMPAIGN_INTRO: t.experience.advisor.campaign };
  return <aside className="advisor-context-tip" role="dialog" aria-label={t.experience.advisor.name}><AdvisorIdentity dictionary={t} /><p>{copy[tip]}</p><button onClick={onDismiss} type="button">{t.experience.advisor.gotIt}</button></aside>;
}

function GuidePanel({ dictionary: t, onClose }: { dictionary: Dictionary; onClose(): void }) {
  return <div className="experience-backdrop experience-backdrop--panel"><section className="experience-panel experience-panel--advisor" role="dialog" aria-modal="true" aria-labelledby="guide-title" data-experience-panel="guide"><header><AdvisorIdentity dictionary={t} /><button aria-label={t.close} onClick={onClose} type="button"><X size={18} /></button></header><h2 id="guide-title">{t.experience.guideTitle}</h2><p className="advisor-guide-reminder">{t.experience.advisor.reminder}</p><div className="guide-sections">{Object.values(t.experience.sections).map((section) => <article key={section.title}><h3>{section.title}</h3><p>{section.body}</p></article>)}</div></section></div>;
}

function AudioSettingsPanel({ dictionary: t, onClose }: { dictionary: Dictionary; onClose(): void }) {
  const { settings, setSettings, playSfx } = useGameAudio();
  const toggle = (key: 'masterEnabled' | 'musicEnabled' | 'sfxEnabled'): void => { setSettings({ ...settings, [key]: !settings[key] }); if (key !== 'sfxEnabled' || !settings.sfxEnabled) playSfx('ui_tap'); };
  const slider = (key: 'masterVolume' | 'musicVolume' | 'sfxVolume', value: string): void => setSettings({ ...settings, [key]: Number(value) });
  return <div className="experience-backdrop experience-backdrop--panel"><section className="experience-panel audio-settings" role="dialog" aria-modal="true" aria-labelledby="audio-title" data-experience-panel="audio"><header><span><Volume2 size={20} /></span><div><h2 id="audio-title">{t.experience.audioTitle}</h2><small>{t.experience.audioSubtitle}</small></div><button aria-label={t.close} onClick={onClose} type="button"><X size={18} /></button></header><AudioSettingRow label={t.experience.master} enabled={settings.masterEnabled} volume={settings.masterVolume} onToggle={() => toggle('masterEnabled')} onVolume={(value) => slider('masterVolume', value)} /><AudioSettingRow label={t.experience.music} enabled={settings.musicEnabled} volume={settings.musicVolume} onToggle={() => toggle('musicEnabled')} onVolume={(value) => slider('musicVolume', value)} /><AudioSettingRow label={t.experience.sfx} enabled={settings.sfxEnabled} volume={settings.sfxVolume} onToggle={() => toggle('sfxEnabled')} onVolume={(value) => slider('sfxVolume', value)} /></section></div>;
}

function AudioSettingRow({ label, enabled, volume, onToggle, onVolume }: { label: string; enabled: boolean; volume: number; onToggle(): void; onVolume(value: string): void }) {
  return <div className="audio-setting-row"><label><span>{label}</span><input checked={enabled} onChange={onToggle} type="checkbox" /></label><input aria-label={`${label} volume`} disabled={!enabled} max="1" min="0" onChange={(event) => onVolume(event.target.value)} step="0.05" type="range" value={volume} /></div>;
}
