'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Headphones, Pause, Play, RotateCcw, ShieldAlert, Square } from 'lucide-react';
import manifestJson from '../../../public/assets/audio/candidates/AUDITION_MANIFEST.json';
import { AUDIO_STORAGE_KEY, DEFAULT_AUDIO_SETTINGS, normalizeAudioSettings, type AudioSettings } from '@/features/audio/audio-manager';
import styles from './audio-audition-lab.module.css';

interface Candidate {
  group: string;
  label: string;
  kind: 'music' | 'sfx';
  candidate: 'A' | 'B' | 'C';
  filename: string;
  author: string;
  license: string;
  sourceReference: string;
  modifications: string;
  productionSafe: 'YES';
  approval: 'PENDING';
  durationSeconds: number;
  codec: string;
  bitrate: number;
  sizeBytes: number;
}

const manifest = manifestJson as {
  status: string;
  productionMappingChanged: boolean;
  approvedGroupCount: number;
  pendingGroupCount: number;
  candidates: Candidate[];
};
const SHORTLIST_KEY = 'crown-coin-audio-audition-v1';

export function AudioAuditionLab() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tab] = useState<'sfx'>('sfx');
  const [playing, setPlaying] = useState<string | null>(null);
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [shortlist, setShortlist] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('Round 2 is ready. Use headphones and phone speakers before deciding.');

  useEffect(() => {
    try {
      setSettings(normalizeAudioSettings(JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY) ?? 'null')));
      setShortlist(JSON.parse(localStorage.getItem(SHORTLIST_KEY) ?? '{}'));
    } catch { /* keep safe defaults */ }
    return () => { audioRef.current?.pause(); };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const candidate = manifest.candidates.find((item) => item.filename === playing);
    const channelVolume = candidate?.kind === 'music' ? settings.musicVolume : settings.sfxVolume;
    const enabled = settings.masterEnabled && (candidate?.kind === 'music' ? settings.musicEnabled : settings.sfxEnabled);
    audio.volume = enabled ? settings.masterVolume * channelVolume : 0;
  }, [playing, settings]);

  const groups = useMemo(() => {
    const current = manifest.candidates.filter((candidate) => candidate.kind === tab);
    return [...new Set(current.map((candidate) => candidate.group))].map((id) => ({
      id,
      label: current.find((candidate) => candidate.group === id)?.label ?? id,
      candidates: current.filter((candidate) => candidate.group === id),
    }));
  }, [tab]);

  const stop = (): void => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    audioRef.current = null;
    setPlaying(null);
    setMessage('Stopped.');
  };

  const play = async (candidate: Candidate, restart = false): Promise<void> => {
    if (audioRef.current && playing === candidate.filename && !restart) {
      if (audioRef.current.paused) await audioRef.current.play(); else audioRef.current.pause();
      setMessage(audioRef.current.paused ? `Paused ${candidate.label} ${candidate.candidate}.` : `Playing ${candidate.label} ${candidate.candidate}.`);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(candidate.filename);
    audio.loop = candidate.kind === 'music';
    audio.preload = 'auto';
    const channelVolume = candidate.kind === 'music' ? settings.musicVolume : settings.sfxVolume;
    const enabled = settings.masterEnabled && (candidate.kind === 'music' ? settings.musicEnabled : settings.sfxEnabled);
    audio.volume = enabled ? settings.masterVolume * channelVolume : 0;
    audio.onended = () => { if (!audio.loop) setPlaying(null); };
    audio.onerror = () => setMessage(`FAILED to load ${candidate.filename}`);
    audioRef.current = audio;
    setPlaying(candidate.filename);
    try {
      await audio.play();
      setMessage(`Playing ${candidate.label} ${candidate.candidate}. Shortlisting stays local until you report your choice.`);
    } catch {
      setMessage(`Playback was blocked for ${candidate.label} ${candidate.candidate}. Tap Play again.`);
    }
  };

  const updateSettings = (next: AudioSettings): void => {
    const normalized = normalizeAudioSettings(next);
    setSettings(normalized);
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(normalized));
  };

  const chooseShortlist = (candidate: Candidate): void => {
    const next = { ...shortlist, [candidate.group]: candidate.candidate };
    setShortlist(next);
    localStorage.setItem(SHORTLIST_KEY, JSON.stringify(next));
    setMessage(`${candidate.label} ${candidate.candidate} shortlisted locally. Approval is still PENDING.`);
  };

  const playGroupPreview = (group: string): void => {
    const preferred = shortlist[group] ?? 'A';
    const candidate = manifest.candidates.find((item) => item.group === group && item.candidate === preferred)
      ?? manifest.candidates.find((item) => item.group === group);
    if (candidate) void play(candidate, true);
  };

  return (
    <main className={styles.lab} data-audio-lab="partial-human-approval">
      <div className={styles.grain} aria-hidden="true" />
      <header className={styles.hero}>
        <div className={styles.eyebrow}><span>DEV ONLY</span><i /> AUDIO DIRECTION ROOM</div>
        <h1>Crown &amp; Coin<br /><em>Audio Audition</em></h1>
        <p>Your approved choices are now in the game and removed from this page. Compare only the remaining licensed candidates.</p>
        <div className={styles.status}><ShieldAlert size={18} /><span>Audio selection</span><strong>{manifest.approvedGroupCount} MAPPED · {manifest.pendingGroupCount} GROUPS PENDING</strong></div>
      </header>

      <section className={styles.console} aria-label="Audition controls">
        <div className={styles.consoleTitle}><Headphones size={20} /><div><strong>Listening chain</strong><small>Shared with game settings</small></div><button data-audio-action="stop-all" onClick={stop} type="button"><Square size={15} /> Stop all</button></div>
        <div className={styles.mixer}>
          <Toggle label="Master" enabled={settings.masterEnabled} volume={settings.masterVolume} onEnabled={(value) => updateSettings({ ...settings, masterEnabled: value })} onVolume={(value) => updateSettings({ ...settings, masterVolume: value })} />
          <Toggle label="Music" enabled={settings.musicEnabled} volume={settings.musicVolume} onEnabled={(value) => updateSettings({ ...settings, musicEnabled: value })} onVolume={(value) => updateSettings({ ...settings, musicVolume: value })} />
          <Toggle label="SFX" enabled={settings.sfxEnabled} volume={settings.sfxVolume} onEnabled={(value) => updateSettings({ ...settings, sfxEnabled: value })} onVolume={(value) => updateSettings({ ...settings, sfxVolume: value })} />
        </div>
        <p className={styles.live} aria-live="polite">{message}</p>
      </section>

      <nav className={styles.tabs} aria-label="Candidate type">
        <button aria-pressed="true" type="button">Pending SFX <b>{manifest.candidates.length}</b></button>
      </nav>

      {tab === 'sfx' ? (
        <section className={styles.contextDeck} aria-label="Gameplay context quick tests">
          <header><small>NON-MUTATING PREVIEW</small><h2>Hear the shortlist in context</h2><p>Each control plays your local shortlist for that action, or Candidate A until you shortlist one.</p></header>
          <div className={styles.contextGrid}>
            <ContextTest title="Interface" groups={[['ui-tap', 'UI Tap'], ['panel-open', 'Panel Open']]} onPlay={playGroupPreview} />
            <ContextTest title="Battle impact" groups={[['arrow-impact', 'Arrow'], ['magic-impact', 'Magic'], ['shield-wall', 'Shield']]} onPlay={playGroupPreview} />
            <ContextTest title="Battle result" groups={[['hero-defeated', 'Hero Down'], ['defeat', 'Defeat']]} onPlay={playGroupPreview} />
            <ContextTest title="Alerts" groups={[['incoming-attack', 'Incoming'], ['revenge-available', 'Revenge']]} onPlay={playGroupPreview} />
          </div>
        </section>
      ) : null}

      <section className={styles.groups}>
        {groups.map((group, index) => (
          <article className={`${styles.group} ${group.id.includes('music') ? styles.musicGroup : ''}`} data-audio-group={group.id} key={group.id}>
            {group.id.includes('music') ? <div className={`${styles.contextArt} ${group.id.startsWith('battle') ? styles.battleArt : ''}`} aria-hidden="true" /> : null}
            <header><span>{String(index + 1).padStart(2, '0')}</span><div><small>{group.id.includes('music') ? 'CONTEXT PREVIEW' : 'ACTION GROUP'}</small><h2>{group.label}</h2></div><b>{group.candidates.length} candidates</b></header>
            <div className={styles.candidateGrid}>
              {group.candidates.map((candidate) => {
                const isPlaying = playing === candidate.filename && !audioRef.current?.paused;
                const selected = shortlist[group.id] === candidate.candidate;
                return (
                  <section className={`${styles.candidate} ${selected ? styles.shortlisted : ''}`} key={candidate.filename}>
                    <div className={styles.letter}>{candidate.candidate}</div>
                    <div className={styles.metadata}><strong>{candidate.filename.split('/').at(-1)}</strong><span>{formatDuration(candidate.durationSeconds)} · {formatSize(candidate.sizeBytes)} · {Math.round(candidate.bitrate / 1000)}kbps</span><span>{candidate.author} · {candidate.license}</span></div>
                    <div className={styles.transport}>
                      <button aria-label={`${isPlaying ? 'Pause' : 'Play'} ${candidate.label} ${candidate.candidate}`} data-audio-action="play" data-audio-file={candidate.filename} onClick={() => void play(candidate)} type="button">{isPlaying ? <Pause size={17} /> : <Play size={17} />}{isPlaying ? 'Pause' : 'Play'}</button>
                      <button aria-label={`Replay ${candidate.label} ${candidate.candidate}`} data-audio-action="replay" data-audio-file={candidate.filename} onClick={() => void play(candidate, true)} type="button"><RotateCcw size={16} /> Replay</button>
                    </div>
                    <button className={styles.shortlist} aria-pressed={selected} onClick={() => chooseShortlist(candidate)} type="button"><Check size={15} /> {selected ? 'Shortlisted' : 'Shortlist locally'}</button>
                    <a href={candidate.sourceReference} rel="noreferrer" target="_blank">Source &amp; license ↗</a>
                  </section>
                );
              })}
            </div>
          </article>
        ))}
      </section>

      <footer><strong>These remaining candidates are not approved automatically.</strong><span>Test headphones, desktop speakers, and a real phone. Then report one letter per group.</span></footer>
    </main>
  );
}

function ContextTest({ title, groups, onPlay }: { title: string; groups: Array<[string, string]>; onPlay(group: string): void }) {
  return <article><strong>{title}</strong><div>{groups.map(([group, label]) => <button data-audio-context={group} key={group} onClick={() => onPlay(group)} type="button"><Play size={14} /> {label}</button>)}</div></article>;
}

function Toggle({ label, enabled, volume, onEnabled, onVolume }: { label: string; enabled: boolean; volume: number; onEnabled(value: boolean): void; onVolume(value: number): void }) {
  return <div className={styles.channel}><label><input checked={enabled} onChange={(event) => onEnabled(event.target.checked)} type="checkbox" /><span>{label}</span><b>{enabled ? 'ON' : 'MUTED'}</b></label><input aria-label={`${label} volume`} max="1" min="0" onChange={(event) => onVolume(Number(event.target.value))} step="0.01" type="range" value={volume} /><small>{Math.round(volume * 100)}%</small></div>;
}

function formatDuration(seconds: number): string { const minutes = Math.floor(seconds / 60); return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, '0')}`; }
function formatSize(bytes: number): string { return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)}MB` : `${Math.round(bytes / 1000)}KB`; }
