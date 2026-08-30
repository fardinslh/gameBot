import { Crown, Gift, Lock, Map, Shield, Star, Swords, X } from 'lucide-react';
import type { CampaignStageState } from '@crown-and-coin/shared';
import type { Dictionary, Locale } from '@/i18n/config';
import { BidiTemplate, BidiValue } from '@/i18n/bidi';
import { formatAmount } from '@/features/kingdom/components/resource-hud';
import { useCampaignState } from '../hooks/use-campaign-state';

interface CampaignMapProps {
  campaign: ReturnType<typeof useCampaignState>;
  dictionary: Dictionary;
  locale: Locale;
  onEditArmy(): void;
}

export function CampaignMap({ campaign, dictionary: t, locale, onEditArmy }: CampaignMapProps) {
  const state = campaign.state;
  if (!state) return <div className="campaign-loading"><Map size={35} /><span>{t.campaign.loading}</span></div>;
  const chapter = state.chapter;
  return (
    <section className="campaign-map" data-campaign-chapter={chapter.key}>
      <header className="campaign-header">
        <span><Map size={21} /></span>
        <div><small>{t.campaign.chapterOne}</small><h1>{chapter.title[locale]}</h1></div>
        <b><Star size={14} fill="currentColor" /><BidiValue direction="ltr">{chapter.totalStars}/{chapter.maximumStars}</BidiValue></b>
      </header>
      <div className="campaign-milestones" aria-label={t.campaign.starRewards}>
        {chapter.starRewards.map((reward) => <button
          className={`campaign-chest campaign-chest--${reward.status.toLowerCase()}`}
          disabled={reward.status !== 'CLAIMABLE' || campaign.action !== 'idle'}
          key={reward.stars}
          onClick={() => void campaign.claim(reward.stars)}
          type="button"
        ><Gift size={15} /><span><BidiValue direction="ltr">{reward.stars}</BidiValue><Star size={8} fill="currentColor" /></span><small>{reward.status === 'CLAIMABLE' ? t.campaign.claim : reward.status === 'CLAIMED' ? t.campaign.claimed : t.campaign.locked}</small></button>)}
      </div>
      <div className="campaign-route" aria-label={t.campaign.stageMap}>
        {chapter.stages.map((stage) => <StageNode key={stage.key} stage={stage} title={stage.title[locale]} onSelect={() => campaign.selectStage(stage.key)} />)}
      </div>
      <div className="campaign-legend"><span><i className="campaign-dot campaign-dot--available" />{t.campaign.available}</span><span><i className="campaign-dot campaign-dot--cleared" />{t.campaign.cleared}</span><span><i className="campaign-dot campaign-dot--locked" />{t.campaign.locked}</span></div>
      {campaign.selectedStage ? <StageDetail stage={campaign.selectedStage} locale={locale} dictionary={t} onAttack={() => void campaign.attack()} onClose={campaign.closeStage} onEditArmy={onEditArmy} pending={campaign.action !== 'idle'} /> : null}
    </section>
  );
}

function StageNode({ stage, title, onSelect }: { stage: CampaignStageState; title: string; onSelect(): void }) {
  return <button className={`campaign-node campaign-node--${stage.status.toLowerCase()}${stage.isBoss ? ' campaign-node--boss' : ''}`} data-stage-key={stage.key} onClick={onSelect} type="button">
    <span>{stage.status === 'LOCKED' ? <Lock size={15} /> : stage.isBoss ? <Crown size={19} /> : <BidiValue direction="ltr">{stage.index}</BidiValue>}</span>
    <b>{title}</b>
    <small>{stage.status === 'CLEARED' ? <>{[1, 2, 3].map((star) => <Star fill={star <= stage.bestStars ? 'currentColor' : 'none'} key={star} size={9} />)}</> : <Shield size={9} />}</small>
  </button>;
}

function StageDetail({ stage, locale, dictionary: t, onAttack, onClose, onEditArmy, pending }: {
  stage: CampaignStageState;
  locale: Locale;
  dictionary: Dictionary;
  onAttack(): void;
  onClose(): void;
  onEditArmy(): void;
  pending: boolean;
}) {
  const locked = stage.status === 'LOCKED';
  return <div className="campaign-sheet-backdrop" onClick={onClose} role="presentation"><section className="campaign-stage-sheet" data-campaign-stage-detail={stage.key} onClick={(event) => event.stopPropagation()}>
    <header><span>{stage.isBoss ? <Crown size={22} /> : <Shield size={21} />}</span><div><small>{stage.isBoss ? t.campaign.bossStage : <BidiTemplate template={t.campaign.stageNumber} values={{ count: { direction: 'ltr', value: stage.index } }} />}</small><h2>{stage.title[locale]}</h2></div><button aria-label={t.close} onClick={onClose} type="button"><X size={18} /></button></header>
    <div className="campaign-enemy-heading"><span><strong>{stage.enemy.displayName[locale]}</strong><small><BidiTemplate template={t.campaign.enemyPower} values={{ count: { direction: 'ltr', value: stage.enemy.power } }} /></small></span><b><BidiTemplate template={t.campaign.castleGate} values={{ count: { direction: 'ltr', value: stage.requiredCastleLevel } }} /></b></div>
    <div className="campaign-enemy-army">{stage.enemy.army.map((squad) => <figure key={squad.slot}><img alt={t.heroNames[squad.commander.key]} src={squad.commander.portraitAsset} /><figcaption><strong>{t.armyUi.troopNames[squad.troopType]} × <BidiValue direction="ltr">{squad.unitCount}</BidiValue></strong><small>{t.heroNames[squad.commander.key]} · {t.heroUi.level}<BidiValue direction="ltr">{squad.commander.level}</BidiValue></small></figcaption></figure>)}</div>
    <h3><Gift size={14} />{t.campaign.firstClearReward}</h3>
    <div className="campaign-rewards">{stage.firstClearRewards.map((reward) => <span key={reward.resource}><b><BidiValue direction="ltr">{formatAmount(reward.amount)}</BidiValue></b><small>{t.resourceShort[reward.resource]}</small></span>)}</div>
    {stage.bestStars > 0 ? <p className="campaign-best"><Star size={13} fill="currentColor" />{t.campaign.bestStars}: <BidiValue direction="ltr">{stage.bestStars}/3</BidiValue></p> : null}
    {locked ? <p className="campaign-lock-reason"><Lock size={14} />{stage.lockReason === 'CASTLE' ? <BidiTemplate template={t.campaign.requiresCastle} values={{ count: { direction: 'ltr', value: stage.requiredCastleLevel } }} /> : t.campaign.clearPrevious}</p> : null}
    <button className="raid-primary" disabled={locked || pending} onClick={onAttack} type="button"><Swords size={16} />{pending ? t.campaign.marching : t.campaign.attack}</button>
    <button className="raid-secondary" onClick={onEditArmy} type="button">{t.campaign.editArmy}</button>
  </section></div>;
}
