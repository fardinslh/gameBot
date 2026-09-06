'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  FastForward,
  Film,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Star,
  Swords,
  Users,
  X,
} from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import type { WarBattleReplay, WarReplayEvent } from '@crown-and-coin/shared';

interface ReplaySpectatorModalProps {
  replay: WarBattleReplay | null;
  onClose(): void;
  dictionary: Dictionary;
}

export function ReplaySpectatorModal({
  replay,
  onClose,
  dictionary: t,
}: ReplaySpectatorModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!replay) return;
    setCurrentTime(0);
    setIsPlaying(true);
  }, [replay?.id]);

  useEffect(() => {
    if (!replay || !isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = 1000 / playbackSpeed;
    timerRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= replay.durationSeconds) {
          setIsPlaying(false);
          return replay.durationSeconds;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, replay]);

  if (!replay) return null;

  // Active events up to current time
  const visibleEvents = replay.timelineEvents.filter((ev) => ev.timeSeconds <= currentTime);
  const currentEvent = visibleEvents.length > 0 ? visibleEvents[visibleEvents.length - 1] : null;
  const currentStars = currentEvent?.stars ?? 0;
  const currentDestruction = currentEvent?.destructionPct ?? 0;

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getEventBadge = (cat: WarReplayEvent['category']) => {
    switch (cat) {
      case 'STAR_SCORED':
        return <span className="replay-event-pill replay-event-pill--star"><Star size={10} /> Star</span>;
      case 'DAMAGE':
        return <span className="replay-event-pill replay-event-pill--damage"><Flame size={10} /> Strike</span>;
      case 'DESTRUCTION_BENCHMARK':
        return <span className="replay-event-pill replay-event-pill--benchmark"><Award size={10} /> 50%</span>;
      default:
        return <span className="replay-event-pill replay-event-pill--deploy"><Users size={10} /> Assault</span>;
    }
  };

  return (
    <div className="season-celebration-overlay" role="dialog" aria-modal="true">
      <div className="replay-spectator-modal">
        {/* Header */}
        <div className="replay-spectator-modal__header">
          <div className="replay-spectator-modal__title-row">
            <Film size={20} className="text-amber" />
            <div>
              <h3>{t.guildScrimmageUi.replayModalTitle}</h3>
              <p><BidiValue>{replay.title}</BidiValue></p>
            </div>
          </div>
          <button className="replay-spectator-modal__close-btn" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {/* Competitors Scoreboard Ribbon */}
        <div className="replay-scoreboard">
          <div className="replay-competitor replay-competitor--attacker">
            <span className="replay-role-tag">Attacker</span>
            <strong><BidiValue>{replay.attackerName}</BidiValue></strong>
            <small>{t.guildUi.castle} Lv. <BidiValue direction="ltr">{replay.attackerCastleLevel}</BidiValue></small>
          </div>

          <div className="replay-vs-stars">
            <div className="replay-stars-row">
              {[1, 2, 3].map((starIdx) => (
                <Star
                  key={starIdx}
                  size={24}
                  className={
                    starIdx <= currentStars
                      ? 'star-icon star-icon--filled star-icon--pop'
                      : 'star-icon star-icon--empty'
                  }
                />
              ))}
            </div>
            <div className="replay-destruct-text">
              <BidiValue direction="ltr">{currentDestruction.toFixed(0)}%</BidiValue>
            </div>
          </div>

          <div className="replay-competitor replay-competitor--defender">
            <span className="replay-role-tag">Defender</span>
            <strong><BidiValue>{replay.defenderName}</BidiValue></strong>
            <small>{t.guildUi.castle} Lv. <BidiValue direction="ltr">{replay.defenderCastleLevel}</BidiValue></small>
          </div>
        </div>

        {/* Destruction Progress Bar */}
        <div className="replay-progress-bar">
          <div
            className="replay-progress-bar__fill"
            style={{ width: `${Math.min(100, currentDestruction)}%` }}
          />
        </div>

        {/* Scrubber & Playback Controls Bar */}
        <div className="replay-controls-bar">
          <div className="replay-controls-left">
            <button
              type="button"
              className="replay-btn replay-btn--play"
              onClick={() => {
                if (currentTime >= replay.durationSeconds) {
                  setCurrentTime(0);
                  setIsPlaying(true);
                } else {
                  setIsPlaying(!isPlaying);
                }
              }}
            >
              {currentTime >= replay.durationSeconds ? (
                <RotateCcw size={15} />
              ) : isPlaying ? (
                <Pause size={15} />
              ) : (
                <Play size={15} />
              )}
            </button>

            <div className="replay-timer-readout">
              <span>{formatSeconds(currentTime)}</span>
              <small>/ {formatSeconds(replay.durationSeconds)}</small>
            </div>
          </div>

          {/* Time Scrubber Slider */}
          <input
            type="range"
            min={0}
            max={replay.durationSeconds}
            value={currentTime}
            onChange={(e) => setCurrentTime(Number(e.target.value))}
            className="replay-scrubber-slider"
          />

          {/* Speed Multiplier Toggle */}
          <div className="replay-speed-group">
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                className={`replay-speed-btn ${playbackSpeed === spd ? 'replay-speed-btn--active' : ''}`}
                onClick={() => setPlaybackSpeed(spd)}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Live Timeline Action Log */}
        <div className="replay-timeline-container">
          <div className="replay-timeline-header">
            <Sparkles size={13} />
            <span>{t.guildScrimmageUi.timeline}</span>
          </div>

          <div className="replay-timeline-scroll">
            {visibleEvents.length === 0 ? (
              <div className="replay-timeline-empty">Awaiting battle commencement…</div>
            ) : (
              visibleEvents.map((ev, i) => (
                <div key={i} className="replay-timeline-entry">
                  <span className="replay-timeline-entry__time">{formatSeconds(ev.timeSeconds)}</span>
                  {getEventBadge(ev.category)}
                  <p className="replay-timeline-entry__label">
                    <BidiValue>{ev.label}</BidiValue>
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Army Composition & Defenses Grid */}
        <div className="replay-details-grid">
          {/* Attacking Army Squads */}
          <div className="replay-section-card">
            <h4><Users size={13} /> {t.guildScrimmageUi.armyRoster}</h4>
            <div className="replay-squads-list">
              {replay.armyComposition.map((sq, i) => (
                <div key={i} className="replay-squad-chip">
                  <span>{sq.troopType}</span>
                  <strong>{sq.count}</strong>
                  <small>({sq.survived} {t.guildScrimmageUi.survived})</small>
                </div>
              ))}
            </div>
          </div>

          {/* Defenses Status */}
          <div className="replay-section-card">
            <h4><Shield size={13} /> {t.guildScrimmageUi.defensesDestroyed}</h4>
            <div className="replay-defenses-list">
              {replay.defenseBuildings.map((def, i) => (
                <div key={i} className={`replay-defense-chip ${def.destroyed ? 'replay-defense-chip--destroyed' : ''}`}>
                  <span>{def.type} (Lv. {def.level})</span>
                  <strong>
                    {def.destroyed ? t.guildScrimmageUi.destroyed : t.guildScrimmageUi.standing}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Close Action */}
        <div className="replay-spectator-modal__footer">
          {replay.source === 'SCRIMMAGE' ? (
            <div className="replay-zero-risk-notice">
              <CheckCircle2 size={13} />
              <span>{t.guildScrimmageUi.zeroRiskNotice}</span>
            </div>
          ) : null}
          <button className="replay-close-action-btn" onClick={onClose} type="button">
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
