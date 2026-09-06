'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Crosshair,
  Eye,
  Flame,
  Shield,
  UserCheck,
  X,
} from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import type {
  GuildMemberInfo,
  GuildWarCalloutItem,
  SetWarCalloutPayload,
  WarTacticalMarker,
} from '@crown-and-coin/shared';

interface WarRoomStrategyModalProps {
  isOpen: boolean;
  baseNumber: number;
  defenderPlayerId: string;
  defenderName: string;
  existingCallout?: GuildWarCalloutItem | null;
  members: GuildMemberInfo[];
  currentUserId?: string;
  canManageStrategy: boolean;
  pending: boolean;
  onSave(payload: SetWarCalloutPayload): Promise<any>;
  onClose(): void;
  dictionary: Dictionary;
}

export function WarRoomStrategyModal({
  isOpen,
  baseNumber,
  defenderPlayerId,
  defenderName,
  existingCallout,
  members,
  currentUserId,
  canManageStrategy,
  pending,
  onSave,
  onClose,
  dictionary: t,
}: WarRoomStrategyModalProps) {
  const [marker, setMarker] = useState<WarTacticalMarker>('TARGET_CALLOUT');
  const [claimedById, setClaimedById] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (existingCallout) {
      setMarker(existingCallout.marker);
      setClaimedById(existingCallout.claimedById ?? '');
      setNotes(existingCallout.notes ?? '');
    } else {
      setMarker('TARGET_CALLOUT');
      setClaimedById(currentUserId ?? '');
      setNotes('');
    }
  }, [existingCallout, currentUserId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      defenderPlayerId,
      baseNumber,
      marker,
      claimedById: claimedById ? claimedById : null,
      notes: notes ? notes.trim() : null,
    });
    onClose();
  };

  const MARKER_OPTIONS: Array<{
    key: WarTacticalMarker;
    label: string;
    icon: typeof Flame;
    officerOnly: boolean;
  }> = [
    { key: 'TARGET_CALLOUT', label: t.guildChatUi.markerTarget, icon: Crosshair, officerOnly: false },
    { key: 'ATTACK_PRIORITY', label: t.guildChatUi.markerPriority, icon: Flame, officerOnly: true },
    { key: 'SCOUT_FIRST', label: t.guildChatUi.markerScout, icon: Eye, officerOnly: true },
    { key: 'CLEARED', label: t.guildChatUi.markerCleared, icon: CheckCircle2, officerOnly: true },
  ];

  return (
    <div className="season-celebration-overlay" role="dialog" aria-modal="true">
      <div className="war-room-modal">
        <div className="war-room-modal__header">
          <div className="war-room-modal__title-box">
            <Shield size={20} className="war-room-modal__shield-icon" />
            <div>
              <h3>{t.guildChatUi.calloutModalTitle}</h3>
              <p>
                Base #{baseNumber}: <BidiValue>{defenderName}</BidiValue>
              </p>
            </div>
          </div>
          <button className="war-room-modal__close-btn" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="war-room-modal__form">
          {/* Tactical Marker Select */}
          <div className="war-room-modal__field">
            <label>{t.guildChatUi.warStrategyTitle}</label>
            <div className="war-room-modal__marker-chips">
              {MARKER_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const disabled = opt.officerOnly && !canManageStrategy;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={disabled}
                    className={`war-room-marker-btn ${marker === opt.key ? 'war-room-marker-btn--active' : ''}`}
                    onClick={() => setMarker(opt.key)}
                  >
                    <Icon size={14} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Assignment */}
          <div className="war-room-modal__field">
            <div className="war-room-modal__assign-header">
              <label>{t.guildChatUi.assignTo}</label>
              {currentUserId && claimedById !== currentUserId ? (
                <button
                  type="button"
                  className="war-room-self-claim-btn"
                  onClick={() => setClaimedById(currentUserId)}
                >
                  <UserCheck size={13} /> {t.guildChatUi.claimForSelf}
                </button>
              ) : null}
            </div>

            {canManageStrategy ? (
              <select
                value={claimedById}
                onChange={(e) => setClaimedById(e.target.value)}
                className="war-room-modal__select"
              >
                <option value="">-- {t.guildChatUi.unassigned} --</option>
                {members.map((m) => (
                  <option key={m.playerId} value={m.playerId}>
                    {m.displayName} ({m.role})
                  </option>
                ))}
              </select>
            ) : (
              <div className="war-room-modal__readonly-assign">
                {claimedById === currentUserId ? (
                  <strong className="war-room-claimed-self">
                    <UserCheck size={14} /> {t.guildChatUi.claimForSelf}
                  </strong>
                ) : (
                  <span>{t.guildChatUi.unassigned}</span>
                )}
              </div>
            )}
          </div>

          {/* Tactical Note Textarea */}
          <div className="war-room-modal__field">
            <label>{t.guildChatUi.tacticalNote}</label>
            <textarea
              rows={3}
              maxLength={160}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.guildChatUi.tacticalNotePlaceholder}
              className="war-room-modal__textarea"
            />
            <small className="war-room-modal__char-count">{notes.length} / 160</small>
          </div>

          {/* Action Row */}
          <div className="war-room-modal__actions">
            <button type="button" className="war-room-modal__cancel-btn" onClick={onClose} disabled={pending}>
              {t.close}
            </button>
            <button type="submit" className="war-room-modal__save-btn" disabled={pending}>
              {pending ? t.guildChatUi.savingCallout : t.guildChatUi.saveCallout}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
