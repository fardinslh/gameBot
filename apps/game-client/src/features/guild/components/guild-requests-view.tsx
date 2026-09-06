'use client';

import { useState } from 'react';
import { Check, Clock, Coins, Plus, Shield, Sparkles, Swords } from 'lucide-react';
import {
  TROOP_TYPES,
  type GuildTroopRequestItem,
  type TroopType,
} from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';

interface GuildRequestsViewProps {
  requests: GuildTroopRequestItem[];
  canRequestTroops: boolean;
  nextRequestAvailableAt: string | null;
  currentUserId?: string;
  dictionary: Dictionary;
  onRequestTroops(troopType: TroopType): Promise<boolean>;
  onDonate(requestId: string, amount?: number): Promise<boolean>;
  pending: boolean;
}

const TROOP_REWARDS: Record<TroopType, { gold: string; xp: number }> = {
  INFANTRY: { gold: '100', xp: 5 },
  ARCHER: { gold: '120', xp: 6 },
  CAVALRY: { gold: '250', xp: 12 },
};

export function GuildRequestsView({
  requests,
  canRequestTroops,
  nextRequestAvailableAt,
  currentUserId,
  dictionary: t,
  onRequestTroops,
  onDonate,
  pending,
}: GuildRequestsViewProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="guild-requests-view">
      {/* Top Banner / Request Action */}
      <div className="guild-request-banner">
        <div className="guild-request-banner__copy">
          <div className="guild-request-banner__icon">
            <Swords size={20} />
          </div>
          <div>
            <strong>{t.guildUi.reinforcementsTitle}</strong>
            <small>{t.guildUi.reinforcementsSubtitle}</small>
          </div>
        </div>

        {canRequestTroops ? (
          <button
            className="guild-btn guild-btn--primary guild-request-btn"
            disabled={pending}
            onClick={() => setPickerOpen(true)}
            type="button"
          >
            <Plus size={16} /> {t.guildUi.requestAction}
          </button>
        ) : (
          <div className="guild-cooldown-pill">
            <Clock size={14} />
            <span>{t.guildUi.cooldown}</span>
          </div>
        )}
      </div>

      {/* Unit Type Picker Modal */}
      {pickerOpen ? (
        <div className="guild-picker-modal">
          <div className="guild-picker-content">
            <h3>{t.guildUi.selectTroopToRequest}</h3>
            <div className="guild-troop-options">
              {TROOP_TYPES.map((type) => (
                <button
                  key={type}
                  className="guild-troop-btn"
                  disabled={pending}
                  onClick={async () => {
                    const success = await onRequestTroops(type);
                    if (success) setPickerOpen(false);
                  }}
                  type="button"
                >
                  <Shield size={22} />
                  <strong>{t.armyUi.troopNames[type]}</strong>
                  <small>Max 10</small>
                </button>
              ))}
            </div>
            <button
              className="guild-picker-cancel"
              onClick={() => setPickerOpen(false)}
              type="button"
            >
              {t.close}
            </button>
          </div>
        </div>
      ) : null}

      {/* Requests Feed */}
      <div className="guild-requests-feed">
        {requests.length === 0 ? (
          <div className="guild-empty-requests">
            <Shield size={36} />
            <p>{t.guildUi.noActiveRequests}</p>
            <small>{t.guildUi.noActiveRequestsHint}</small>
          </div>
        ) : (
          requests.map((req) => {
            const isSelf = req.requesterId === currentUserId;
            const progressPct = Math.min(100, Math.round((req.currentDonations / req.maxDonations) * 100));
            const reward = TROOP_REWARDS[req.troopType];

            return (
              <div key={req.id} className={`guild-request-card ${isSelf ? 'guild-request-card--self' : ''}`}>
                <div className="guild-request-card__header">
                  <div className="guild-request-card__user">
                    <strong><BidiValue>{req.requesterName}</BidiValue></strong>
                    {isSelf ? <span className="guild-self-tag">{t.guildUi.you}</span> : null}
                  </div>
                  <span className="guild-request-card__time">
                    <Clock size={11} /> {t.guildUi.activeRequest}
                  </span>
                </div>

                <div className="guild-request-card__body">
                  <div className="guild-request-card__troop">
                    <span className="guild-troop-icon">
                      <Swords size={18} />
                    </span>
                    <div>
                      <h4>{t.armyUi.troopNames[req.troopType]}</h4>
                      <small>
                        <BidiValue direction="ltr">{req.currentDonations}</BidiValue> /{' '}
                        <BidiValue direction="ltr">{req.maxDonations}</BidiValue>
                      </small>
                    </div>
                  </div>

                  {/* Donate Button */}
                  {!isSelf ? (
                    <button
                      className="guild-donate-btn"
                      disabled={pending || req.currentDonations >= req.maxDonations}
                      onClick={() => void onDonate(req.id, 1)}
                      type="button"
                    >
                      <span>{t.guildUi.donate} +1</span>
                      <div className="guild-donate-reward-preview">
                        <span><Coins size={10} /> +{reward.gold}</span>
                        <span><Sparkles size={10} /> +{reward.xp} XP</span>
                      </div>
                    </button>
                  ) : (
                    <div className="guild-own-request-badge">
                      <Check size={14} /> {t.guildUi.waitingForClan}
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="guild-request-progress">
                  <div
                    className="guild-request-progress__bar"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Donors list */}
                {req.donors.length > 0 ? (
                  <div className="guild-request-donors">
                    <small>{t.guildUi.donors}:</small>
                    <span>
                      {req.donors.map((d, i) => (
                        <span key={d.playerId}>
                          {i ? ', ' : ''}
                          <BidiValue>{d.displayName}</BidiValue> (×{d.amount})
                        </span>
                      ))}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
