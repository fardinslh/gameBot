'use client';

import { useState } from 'react';
import {
  ArrowUpCircle,
  CheckCircle2,
  Coins,
  Flame,
  History,
  Lock,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import type {
  DonateToTreasuryResponse,
  GuildPerkStatus,
  GuildPerkType,
  GuildTreasuryOverviewResponse,
  UpgradeGuildPerkResponse,
} from '@crown-and-coin/shared';

interface GuildPerksViewProps {
  dictionary: Dictionary;
  treasury: GuildTreasuryOverviewResponse | null;
  loading: boolean;
  pending: boolean;
  lastDonationResult: DonateToTreasuryResponse | null;
  lastUpgradeResult: UpgradeGuildPerkResponse | null;
  onDonate(amount: string): Promise<any>;
  onUpgrade(perkType: GuildPerkType): Promise<any>;
  onClearDonationResult(): void;
  onClearUpgradeResult(): void;
}

const QUICK_DONATION_AMOUNTS = ['1000', '5000', '25000', '50000'];

export function GuildPerksView({
  dictionary: t,
  treasury,
  loading,
  pending,
  lastDonationResult,
  lastUpgradeResult,
  onDonate,
  onUpgrade,
  onClearDonationResult,
  onClearUpgradeResult,
}: GuildPerksViewProps) {
  const [customAmount, setCustomAmount] = useState('5000');
  const [selectedQuickAmount, setSelectedQuickAmount] = useState('5000');

  if (loading || !treasury) {
    return (
      <div className="guild-loading">
        <div className="leaderboard-spinner" />
        <p>{t.guildUi.loadingGuild}</p>
      </div>
    );
  }

  const handleQuickSelect = (amt: string) => {
    setSelectedQuickAmount(amt);
    setCustomAmount(amt);
  };

  const handleDeposit = async () => {
    if (!customAmount || parseInt(customAmount, 10) < 100) return;
    try {
      await onDonate(customAmount);
    } catch {
      // Handled by hook error state
    }
  };

  const getPerkIcon = (type: GuildPerkType) => {
    switch (type) {
      case 'GOLD_BOOST':
        return <Coins size={22} className="guild-perk-card__icon--gold" />;
      case 'DONATION_CAPACITY':
        return <Users size={22} className="guild-perk-card__icon--troops" />;
      case 'WAR_LOOT_BONUS':
        return <Flame size={22} className="guild-perk-card__icon--war" />;
      case 'TROOP_TRAINING_SPEED':
        return <Zap size={22} className="guild-perk-card__icon--speed" />;
    }
  };

  const getLockReasonText = (perk: GuildPerkStatus) => {
    switch (perk.lockReason) {
      case 'MAX_LEVEL':
        return t.guildTreasuryUi.maxLevelReached;
      case 'OFFICER_OR_LEADER_REQUIRED':
        return t.guildTreasuryUi.officerRequired;
      case 'INSUFFICIENT_LEVEL':
        return `${t.guildTreasuryUi.insufficientLevel} (${perk.nextLevel?.requiredGuildLevel ?? ''})`;
      case 'INSUFFICIENT_TREASURY':
        return t.guildTreasuryUi.insufficientTreasury;
      default:
        return t.guildTreasuryUi.locked;
    }
  };

  return (
    <div className="guild-perks-container">
      {/* 1. Clan Level & XP Progression Hero Banner */}
      <section className="guild-perks-hero">
        <div className="guild-perks-hero__badge">
          <Sparkles size={20} />
          <div>
            <span className="guild-perks-hero__label">{t.guildTreasuryUi.clanLevel}</span>
            <strong className="guild-perks-hero__level">
              <BidiValue direction="ltr">{treasury.guildLevel}</BidiValue>
            </strong>
          </div>
        </div>

        <div className="guild-perks-hero__progress-wrap">
          <div className="guild-perks-hero__progress-meta">
            <span>{t.guildTreasuryUi.levelProgress}</span>
            <span>
              <BidiValue direction="ltr">{treasury.guildXp.toLocaleString()}</BidiValue> /{' '}
              <BidiValue direction="ltr">{treasury.nextLevelXp.toLocaleString()}</BidiValue> XP
            </span>
          </div>
          <div className="guild-perks-hero__bar-track">
            <div
              className="guild-perks-hero__bar-fill"
              style={{ width: `${Math.min(100, treasury.xpProgressPct)}%` }}
            />
          </div>
        </div>
      </section>

      {/* 2. Shared Treasury Vault Card */}
      <section className="guild-treasury-card">
        <div className="guild-treasury-card__header">
          <div className="guild-treasury-card__balance-box">
            <div className="guild-treasury-card__icon-wrap">
              <Coins size={28} />
            </div>
            <div>
              <span className="guild-treasury-card__subtitle">{t.guildTreasuryUi.treasuryBalance}</span>
              <h2 className="guild-treasury-card__amount">
                <BidiValue direction="ltr">
                  {BigInt(treasury.treasuryGold).toLocaleString()}
                </BidiValue>{' '}
                <small>{t.resourceShort.GOLD}</small>
              </h2>
            </div>
          </div>

          <div className="guild-treasury-card__contrib-box">
            <span className="guild-treasury-card__subtitle">{t.guildTreasuryUi.yourContribution}</span>
            <strong>
              <BidiValue direction="ltr">
                {BigInt(treasury.playerContributionTotal).toLocaleString()}
              </BidiValue>{' '}
              {t.resourceShort.GOLD}
            </strong>
          </div>
        </div>

        {/* Deposit Action Row */}
        <div className="guild-treasury-card__deposit-row">
          <div className="guild-treasury-card__quick-chips">
            {QUICK_DONATION_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                className={`guild-chip-btn ${selectedQuickAmount === amt ? 'guild-chip-btn--active' : ''}`}
                onClick={() => handleQuickSelect(amt)}
                disabled={pending}
              >
                +{parseInt(amt, 10).toLocaleString()}
              </button>
            ))}
          </div>

          <div className="guild-treasury-card__input-group">
            <input
              type="number"
              min="100"
              step="100"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedQuickAmount('');
              }}
              className="guild-treasury-input"
              placeholder={t.guildTreasuryUi.customAmount}
              disabled={pending}
            />
            <button
              type="button"
              className="guild-treasury-deposit-btn"
              onClick={handleDeposit}
              disabled={pending || !customAmount || parseInt(customAmount, 10) < 100}
            >
              {pending ? t.guildTreasuryUi.depositing : t.guildTreasuryUi.depositBtn}
            </button>
          </div>
        </div>
      </section>

      {/* 3. Alliance Perks & Tech Tree */}
      <section className="guild-perks-section">
        <div className="guild-section-title">
          <TrendingUp size={18} />
          <h3>{t.guildTreasuryUi.perksTitle}</h3>
        </div>
        <p className="guild-section-desc">{t.guildTreasuryUi.perksSubtitle}</p>

        <div className="guild-perks-grid">
          {treasury.perks.map((perk) => (
            <div
              key={perk.type}
              className={`guild-perk-card ${perk.currentLevel > 0 ? 'guild-perk-card--unlocked' : 'guild-perk-card--locked'}`}
            >
              <div className="guild-perk-card__header">
                <div className="guild-perk-card__icon-box">
                  {getPerkIcon(perk.type)}
                </div>
                <div className="guild-perk-card__title-wrap">
                  <h4 className="guild-perk-card__name">{perk.name}</h4>
                  <span className="guild-perk-card__tier-badge">
                    {perk.currentLevel > 0
                      ? `${t.guildTreasuryUi.tier} ${perk.currentLevel} / ${perk.maxLevel}`
                      : t.guildTreasuryUi.locked}
                  </span>
                </div>
              </div>

              {/* Current Active Bonus */}
              <div className="guild-perk-card__bonus">
                <div className="guild-perk-card__bonus-row">
                  {perk.currentLevel > 0 ? (
                    <CheckCircle2 size={16} className="guild-perk-card__check" />
                  ) : (
                    <Lock size={16} className="guild-perk-card__lock" />
                  )}
                  <span>{perk.currentBonusDescription}</span>
                </div>
              </div>

              {/* Next Tier & Upgrade Controls */}
              {perk.nextLevel ? (
                <div className="guild-perk-card__upgrade-box">
                  <div className="guild-perk-card__next-meta">
                    <div>
                      <small>{t.guildTreasuryUi.reqClanLevel}</small>
                      <strong>
                        <Shield size={12} /> <BidiValue direction="ltr">{perk.nextLevel.requiredGuildLevel}</BidiValue>
                      </strong>
                    </div>
                    <div>
                      <small>{t.guildTreasuryUi.upgradeCost}</small>
                      <strong>
                        <Coins size={12} />{' '}
                        <BidiValue direction="ltr">
                          {BigInt(perk.nextLevel.costTreasuryGold).toLocaleString()}
                        </BidiValue>
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`guild-perk-upgrade-btn ${perk.canUpgrade ? 'guild-perk-upgrade-btn--available' : 'guild-perk-upgrade-btn--disabled'}`}
                    disabled={!perk.canUpgrade || pending}
                    onClick={() => onUpgrade(perk.type)}
                  >
                    <ArrowUpCircle size={15} />
                    {perk.canUpgrade
                      ? `${t.guildTreasuryUi.upgradeBtn} (Tier ${perk.nextLevel.level})`
                      : getLockReasonText(perk)}
                  </button>
                </div>
              ) : (
                <div className="guild-perk-card__max-badge">
                  <CheckCircle2 size={16} />
                  <span>{t.guildTreasuryUi.maxLevelReached}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 4. Recent Vault Ledger Audit Log */}
      <section className="guild-vault-log-section">
        <div className="guild-section-title">
          <History size={17} />
          <h3>{t.guildTreasuryUi.recentDonationsTitle}</h3>
        </div>

        {treasury.recentDonations.length === 0 ? (
          <p className="guild-vault-log-empty">{t.guildTreasuryUi.noDonations}</p>
        ) : (
          <div className="guild-vault-log-list">
            {treasury.recentDonations.map((item) => (
              <div key={item.id} className="guild-vault-log-row">
                <div className="guild-vault-log-row__user">
                  <span className="guild-vault-log-row__bullet" />
                  <strong><BidiValue>{item.donorName}</BidiValue></strong>
                  <span>{t.guildTreasuryUi.donatedBy}</span>
                </div>
                <div className="guild-vault-log-row__amount">
                  <strong>+<BidiValue direction="ltr">{BigInt(item.amount).toLocaleString()}</BidiValue></strong>{' '}
                  <Coins size={13} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Donation Celebration Toast */}
      {lastDonationResult ? (
        <div className="guild-reward-toast" role="status">
          <div className="guild-reward-toast__content">
            <strong>{t.guildTreasuryUi.donationSuccess}</strong>
            <p>{t.guildTreasuryUi.donationSuccessDesc}</p>
            <div className="guild-reward-toast__pills">
              <span>
                <Coins size={13} />{' '}
                +<BidiValue direction="ltr">{BigInt(lastDonationResult.donatedAmount).toLocaleString()}</BidiValue>{' '}
                {t.resourceShort.GOLD}
              </span>
              <span>
                <Sparkles size={13} /> +<BidiValue direction="ltr">{lastDonationResult.xpAwarded}</BidiValue> Clan XP
              </span>
            </div>
          </div>
          <button onClick={onClearDonationResult} type="button">
            {t.close}
          </button>
        </div>
      ) : null}

      {/* 6. Perk Upgrade Celebration Modal */}
      {lastUpgradeResult ? (
        <div className="season-celebration-overlay">
          <div className="season-celebration-modal" role="dialog" aria-modal="true">
            <div className="season-celebration-modal__crown">
              <Sparkles size={36} />
            </div>
            <h2>{t.guildTreasuryUi.upgradeSuccess}</h2>
            <p>{t.guildTreasuryUi.upgradeSuccessDesc}</p>

            <div className="guild-perk-upgraded-card">
              <div className="guild-perk-card__header">
                {getPerkIcon(lastUpgradeResult.perk.type)}
                <div>
                  <h4>{lastUpgradeResult.perk.name}</h4>
                  <span className="guild-perk-card__tier-badge">
                    {t.guildTreasuryUi.tier} {lastUpgradeResult.perk.currentLevel}
                  </span>
                </div>
              </div>
              <p className="guild-perk-upgraded-benefit">
                <CheckCircle2 size={16} /> {lastUpgradeResult.perk.currentBonusDescription}
              </p>
            </div>

            <button
              className="season-celebration-modal__cta"
              onClick={onClearUpgradeResult}
              type="button"
            >
              {t.close}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
