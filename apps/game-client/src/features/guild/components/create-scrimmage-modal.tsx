'use client';

import { useState } from 'react';
import { Shield, Swords, X } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';

interface CreateScrimmageModalProps {
  isOpen: boolean;
  onClose(): void;
  onSubmit(message?: string): Promise<any>;
  pending: boolean;
  dictionary: Dictionary;
}

export function CreateScrimmageModal({
  isOpen,
  onClose,
  onSubmit,
  pending,
  dictionary: t,
}: CreateScrimmageModalProps) {
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    await onSubmit(message.trim() || undefined);
    setMessage('');
    onClose();
  };

  return (
    <div className="season-celebration-overlay" role="dialog" aria-modal="true">
      <div className="war-room-modal">
        <div className="war-room-modal__header">
          <div className="war-room-modal__title-box">
            <Swords size={20} className="text-amber" />
            <div>
              <h3>{t.guildScrimmageUi.modalTitle}</h3>
              <p>{t.guildScrimmageUi.modalSubtitle}</p>
            </div>
          </div>
          <button className="war-room-modal__close-btn" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="war-room-modal__form">
          <div className="war-room-modal__field">
            <label>{t.guildScrimmageUi.challengeNote}</label>
            <textarea
              rows={3}
              maxLength={120}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.guildScrimmageUi.challengeNotePlaceholder}
              className="war-room-modal__textarea"
            />
            <small className="war-room-modal__char-count">{message.length} / 120</small>
          </div>

          <div className="scrimmage-zero-loss-tip">
            <Shield size={14} />
            <span>{t.guildScrimmageUi.zeroRiskNotice}</span>
          </div>

          <div className="war-room-modal__actions">
            <button
              type="button"
              className="war-room-modal__cancel-btn"
              onClick={onClose}
              disabled={pending}
            >
              {t.close}
            </button>
            <button
              type="submit"
              className="war-room-modal__save-btn"
              disabled={pending}
            >
              {pending ? t.guildScrimmageUi.posting : t.guildScrimmageUi.confirmPost}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
