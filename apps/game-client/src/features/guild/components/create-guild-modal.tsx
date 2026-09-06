'use client';

import { useState } from 'react';
import { Coins, Shield, X } from 'lucide-react';
import {
  GUILD_CREST_EMBLEMS,
  GUILD_JOIN_POLICIES,
  type CreateGuildRequest,
  type GuildCrestEmblem,
  type GuildJoinPolicy,
} from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { GuildCrestBadge } from './guild-crest';

interface CreateGuildModalProps {
  isOpen: boolean;
  onClose(): void;
  onSubmit(payload: CreateGuildRequest): Promise<boolean>;
  dictionary: Dictionary;
  pending: boolean;
}

const COLOR_PRESETS = [
  { name: 'Royal Gold', primary: '#f59e0b', secondary: '#78350f' },
  { name: 'Crimson Blood', primary: '#ef4444', secondary: '#7f1d1d' },
  { name: 'Imperial Azure', primary: '#3b82f6', secondary: '#1e3a8a' },
  { name: 'Forest Emerald', primary: '#10b981', secondary: '#064e3b' },
  { name: 'Shadow Amethyst', primary: '#8b5cf6', secondary: '#4c1d95' },
  { name: 'Midnight Obsidian', primary: '#64748b', secondary: '#0f172a' },
];

const TROPHY_OPTIONS = [0, 400, 800, 1200, 1600, 2000, 2600];

export function CreateGuildModal({
  isOpen,
  onClose,
  onSubmit,
  dictionary: t,
  pending,
}: CreateGuildModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emblem, setEmblem] = useState<GuildCrestEmblem>('shield');
  const [colorPreset, setColorPreset] = useState(COLOR_PRESETS[0]);
  const [joinPolicy, setJoinPolicy] = useState<GuildJoinPolicy>('OPEN');
  const [minTrophies, setMinTrophies] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (name.trim().length < 3 || name.trim().length > 24) {
      setValidationError(t.guildUi.nameError);
      return;
    }
    const success = await onSubmit({
      name: name.trim(),
      description: description.trim(),
      emblem,
      primaryColor: colorPreset.primary,
      secondaryColor: colorPreset.secondary,
      joinPolicy,
      minTrophies,
    });
    if (success) {
      onClose();
    }
  };

  return (
    <div
      className="guild-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="guild-create-panel" role="dialog" aria-modal="true" aria-labelledby="create-guild-title">
        <header className="guild-modal-header">
          <div className="guild-modal-header__title">
            <Shield aria-hidden="true" size={20} />
            <h2 id="create-guild-title">{t.guildUi.createTitle}</h2>
          </div>
          <button aria-label={t.close} className="guild-modal-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="guild-create-form">
          {/* Crest Preview */}
          <div className="guild-create-crest-preview">
            <GuildCrestBadge
              crest={{
                emblem,
                primaryColor: colorPreset.primary,
                secondaryColor: colorPreset.secondary,
              }}
              size="lg"
            />
            <div className="guild-create-crest-picker">
              <label>{t.guildUi.chooseEmblem}</label>
              <div className="guild-emblem-options">
                {GUILD_CREST_EMBLEMS.map((emb) => (
                  <button
                    key={emb}
                    type="button"
                    className={`guild-emblem-btn ${emblem === emb ? 'guild-emblem-btn--active' : ''}`}
                    onClick={() => setEmblem(emb)}
                  >
                    <GuildCrestBadge
                      crest={{ emblem: emb, primaryColor: colorPreset.primary, secondaryColor: colorPreset.secondary }}
                      size="sm"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Color Presets */}
          <div className="guild-color-presets">
            <label>{t.guildUi.chooseColors}</label>
            <div className="guild-color-swatches">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className={`guild-swatch-btn ${colorPreset.name === p.name ? 'guild-swatch-btn--active' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }}
                  onClick={() => setColorPreset(p)}
                  title={p.name}
                />
              ))}
            </div>
          </div>

          {/* Name & Description */}
          <div className="guild-form-field">
            <label htmlFor="guild-name">{t.guildUi.guildName}</label>
            <input
              id="guild-name"
              maxLength={24}
              minLength={3}
              placeholder={t.guildUi.namePlaceholder}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="guild-form-field">
            <label htmlFor="guild-desc">{t.guildUi.guildMotto}</label>
            <input
              id="guild-desc"
              maxLength={160}
              placeholder={t.guildUi.mottoPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Policy & Min Trophies */}
          <div className="guild-form-row">
            <div className="guild-form-field">
              <label>{t.guildUi.joinPolicy}</label>
              <div className="guild-policy-selector">
                {GUILD_JOIN_POLICIES.filter((p) => p !== 'INVITE_ONLY').map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`guild-policy-btn ${joinPolicy === p ? 'guild-policy-btn--active' : ''}`}
                    onClick={() => setJoinPolicy(p)}
                  >
                    {t.guildUi.policies[p]}
                  </button>
                ))}
              </div>
            </div>

            <div className="guild-form-field">
              <label htmlFor="guild-trophies">{t.guildUi.requiredTrophies}</label>
              <select
                id="guild-trophies"
                value={minTrophies}
                onChange={(e) => setMinTrophies(Number(e.target.value))}
              >
                {TROPHY_OPTIONS.map((tr) => (
                  <option key={tr} value={tr}>
                    {tr} {t.leaderboard.trophies}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {validationError ? <div className="guild-form-error">{validationError}</div> : null}

          {/* Cost & Submit */}
          <footer className="guild-create-footer">
            <div className="guild-create-cost">
              <Coins size={16} />
              <span>
                {t.guildUi.cost}: <strong><BidiValue direction="ltr">2,500</BidiValue></strong> {t.resourceShort.GOLD}
              </span>
            </div>
            <button className="guild-btn guild-btn--primary" disabled={pending} type="submit">
              {pending ? t.guildUi.creating : t.guildUi.createAction}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
