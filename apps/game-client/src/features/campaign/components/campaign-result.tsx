import { Crown, Gift, Star } from 'lucide-react';
import type { CampaignBattleStartResponse } from '@crown-and-coin/shared';
import type { Dictionary, Locale } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { formatAmount } from '@/features/kingdom/components/resource-hud';

export function CampaignResult({ result, dictionary: t, locale, onContinue, onRetry, onEditArmy }: {
  result: CampaignBattleStartResponse;
  dictionary: Dictionary;
  locale: Locale;
  onContinue(): void;
  onRetry(): void;
  onEditArmy(): void;
}) {
  const stage = result.campaign.chapter.stages.find((item) => item.key === result.stageKey);
  const won = result.battle.result === 'ATTACKER_WIN';
  return <section className={`raid-result campaign-result raid-result--${won ? 'victory' : 'defeat'}`} data-campaign-result={won ? 'victory' : 'defeat'}>
    <span className="raid-result__crest"><Crown size={30} /></span>
    <small>{stage?.title[locale] ?? result.stageKey}</small>
    <h1>{won ? t.campaign.victory : t.campaign.defeat}</h1>
    <div className="campaign-result-stars" aria-label={t.campaign.attemptStars}>{[1, 2, 3].map((star) => <Star fill={star <= result.attemptStars ? 'currentColor' : 'none'} key={star} size={24} />)}</div>
    <p>{t.campaign.bestStars}: <BidiValue direction="ltr">{result.bestStars}/3</BidiValue></p>
    {result.firstClearRewardGranted ? <div className="campaign-result-reward"><strong><Gift size={14} />{t.campaign.firstClearGranted}</strong><div className="campaign-rewards">{result.firstClearRewards.map((reward) => <span key={reward.resource}><b><BidiValue direction="ltr">{formatAmount(reward.amount)}</BidiValue></b><small>{t.resourceShort[reward.resource]}</small></span>)}</div></div> : null}
    <button className="raid-primary" onClick={won ? onContinue : onRetry} type="button">{won ? t.campaign.continueMap : t.campaign.retryStage}</button>
    <button className="raid-secondary" onClick={onEditArmy} type="button">{t.campaign.editArmy}</button>
  </section>;
}
