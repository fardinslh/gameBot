import { ArrowLeft, Gift, Shield, Sparkles, Swords, Trophy } from 'lucide-react';
import type { BattleReplayResponse } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { formatAmount } from '@/features/kingdom/components/resource-hud';
import { BidiValue } from '@/i18n/bidi';
import { LeagueBadge } from '@/features/leaderboard/components/league-badge';

interface BattleDetailProps { battle: BattleReplayResponse; dictionary: Dictionary; onBack(): void; }

export function BattleDetail({ battle, dictionary: t, onBack }: BattleDetailProps) {
  const defenseWon = battle.result === 'DEFENDER_WIN';
  return (
    <section className="battle-detail" data-battle-detail={battle.id}>
      <header><button aria-label={t.inboxUi.back} onClick={onBack} type="button"><ArrowLeft size={19} /></button><span><Shield size={21} /></span><div><small>{battle.type === 'REVENGE' ? t.inboxUi.revenge : t.inboxUi.defense}</small><h1>{t.inboxUi.battleDetail}</h1></div></header>
      <div className="battle-detail__versus"><span><small>{t.inboxUi.attacker}</small><strong><BidiValue>{battle.attacker.displayName}</BidiValue></strong></span><Swords size={19} /><span><small>{t.inboxUi.defender}</small><strong><BidiValue>{battle.defender.displayName}</BidiValue></strong></span></div>
      <p className={defenseWon ? 'battle-detail__result battle-detail__result--win' : 'battle-detail__result'}>{defenseWon ? t.inboxUi.defenseVictory : t.inboxUi.defenseDefeat} <span><Trophy size={13} /> <BidiValue direction="ltr">{battle.defender.trophyDelta > 0 ? '+' : ''}{battle.defender.trophyDelta}</BidiValue></span></p>
      <div className="battle-detail__teams">{battle.rulesVersion === 1
        ? (['attacker', 'defender'] as const).map((side) => <div key={side}>{battle.teams[side].map((hero) => <figure key={`${side}-${hero.slot}`}><img alt={t.heroNames[hero.key]} src={hero.portraitAsset} /><figcaption>{t.heroNames[hero.key]} · {t.heroUi.level}<BidiValue direction="ltr">{hero.level}</BidiValue></figcaption></figure>)}</div>)
        : (['attacker', 'defender'] as const).map((side) => <div key={side}>{battle.armies[side].map((squad) => <figure key={`${side}-${squad.slot}`}><img alt={t.heroNames[squad.commanderKey]} src={squad.commanderPortraitAsset} /><figcaption>{t.armyUi.troopNames[squad.troopType]} × <BidiValue direction="ltr">{squad.initialUnitCount}</BidiValue></figcaption></figure>)}</div>)}</div>
      <div className="raid-loot-grid">{Object.entries(battle.loot).map(([resource, amount]) => <span key={resource}><b><BidiValue direction="ltr">{formatAmount(amount)}</BidiValue></b><small>{t.resourceShort[resource as keyof typeof t.resourceShort]}</small></span>)}</div>
      {battle.leagueBonus && battle.result === 'ATTACKER_WIN' ? (
        <div className="raid-league-bonus">
          <div className="raid-league-bonus__header">
            <span className="raid-league-bonus__title">
              <Gift size={15} /> {t.raidUi.leagueBonus}
            </span>
            {battle.attackerLeague ? (
              <LeagueBadge league={battle.attackerLeague} size="sm" dictionary={t} showName />
            ) : null}
          </div>
          <div className="leaderboard-reward-grid">
            {Object.entries(battle.leagueBonus).map(([resource, amount]) => {
              if (Number(amount) <= 0) return null;
              const isGems = resource === 'GEMS';
              return (
                <span
                  key={resource}
                  className={`leaderboard-reward-pill ${isGems ? 'leaderboard-reward-pill--premium' : ''}`}
                  data-resource={resource}
                >
                  {isGems ? <Sparkles size={11} /> : null}
                  <strong>+{formatAmount(amount)}</strong>
                  <small>{isGems ? t.resourceGems : t.resourceShort[resource as keyof typeof t.resourceShort]}</small>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
      <time><BidiValue direction="ltr">{new Date(battle.resolvedAt).toLocaleString()}</BidiValue></time>
      <button className="raid-secondary" onClick={onBack} type="button">{t.inboxUi.back}</button>
    </section>
  );
}
