import Image from 'next/image';
import { Check, Heart, Shield, Sword, Zap } from 'lucide-react';
import type { HeroState } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { HeroClassIcon } from './hero-class-icon';
import { BidiValue } from '@/i18n/bidi';

interface HeroCardProps {
  dictionary: Dictionary;
  hero: HeroState;
  teamSlot: number | null;
  targetSlot: number;
  onAssign(): void;
  onOpen(): void;
}

export function HeroCard({ dictionary: t, hero, teamSlot, targetSlot, onAssign, onOpen }: HeroCardProps) {
  const selected = teamSlot !== null;
  const name = t.heroNames[hero.key];
  return (
    <article
      className={`hero-card hero-card--${hero.key.toLowerCase()}${selected ? ' hero-card--selected' : ''}`}
      data-hero-id={hero.id}
      data-hero-key={hero.key}
      data-hero-level={hero.level}
    >
      <button className="hero-card__main" aria-label={`${t.heroUi.details}: ${name}`} onClick={onOpen} type="button">
        <span className="hero-card__portrait-wrap">
          <Image alt={t.heroUi.portraitAlt.replace('{hero}', name)} className="hero-card__portrait" height={150} src={hero.portraitAsset} width={150} />
          <span className="hero-card__level">{t.heroUi.level} <BidiValue direction="ltr">{hero.level}</BidiValue></span>
          {selected ? <span className="hero-card__team-badge"><Check aria-hidden="true" size={11} />{t.heroUi.selected} · <BidiValue direction="ltr">{teamSlot + 1}</BidiValue></span> : null}
        </span>
        <span className="hero-card__body">
          <span className="hero-card__identity"><span><strong>{name}</strong><small><HeroClassIcon combatClass={hero.class} size={13} />{t.heroClasses[hero.class]}</small></span><b><Zap aria-hidden="true" size={13} /><BidiValue direction="ltr">{hero.power.toLocaleString('en-US')}</BidiValue></b></span>
          <span className="hero-card__stats">
            <span><Heart aria-hidden="true" size={13} /><small>{t.heroUi.health}</small><strong><BidiValue direction="ltr">{hero.hp.toLocaleString('en-US')}</BidiValue></strong></span>
            <span><Sword aria-hidden="true" size={13} /><small>{t.heroUi.attack}</small><strong><BidiValue direction="ltr">{hero.atk.toLocaleString('en-US')}</BidiValue></strong></span>
            <span><Shield aria-hidden="true" size={13} /><small>{t.heroUi.defense}</small><strong><BidiValue direction="ltr">{hero.def.toLocaleString('en-US')}</BidiValue></strong></span>
          </span>
        </span>
      </button>
      <button className="hero-card__assign" onClick={onAssign} type="button">
        {selected && teamSlot === targetSlot ? <Check aria-hidden="true" size={13} /> : <HeroClassIcon combatClass={hero.class} size={13} />}
        {selected && teamSlot === targetSlot ? t.heroUi.selected : <>{t.heroUi.assign} <BidiValue direction="ltr">{targetSlot + 1}</BidiValue></>}
      </button>
    </article>
  );
}
