import Image from 'next/image';
import { Coins, Heart, Shield, Sword, WandSparkles, X, Zap } from 'lucide-react';
import type { HeroState } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { formatAmount } from '@/features/kingdom/components/resource-hud';
import { HeroClassIcon } from './hero-class-icon';

interface HeroDetailSheetProps {
  dictionary: Dictionary;
  hero: HeroState | null;
  upgrading: boolean;
  onClose(): void;
  onUpgrade(heroId: string): void;
}

export function HeroDetailSheet({ dictionary: t, hero, upgrading, onClose, onUpgrade }: HeroDetailSheetProps) {
  const name = hero ? t.heroNames[hero.key] : '';
  const skill = hero ? t.heroSkills[hero.skill.key] : null;
  return (
    <aside aria-hidden={!hero} className={hero ? 'hero-sheet hero-sheet--open' : 'hero-sheet'} data-hero-sheet={hero?.key}>
      {hero ? (
        <div className="hero-sheet__scroll">
          <button aria-label={t.heroUi.closeDetails} className="hero-sheet__close" onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button>
          <div className={`hero-sheet__portrait hero-sheet__portrait--${hero.key.toLowerCase()}`}>
            <Image alt={t.heroUi.portraitAlt.replace('{hero}', name)} fill sizes="(max-width: 480px) 100vw, 480px" src={hero.portraitAsset} />
            <div><small><HeroClassIcon combatClass={hero.class} size={14} />{t.heroClasses[hero.class]}</small><h2>{name}</h2><span>{t.heroUi.level} {hero.level}</span></div>
          </div>
          <div className="hero-sheet__power"><span><Zap aria-hidden="true" size={17} />{t.heroUi.power}</span><strong>{hero.power.toLocaleString('en-US')}</strong></div>
          <div className="hero-sheet__stats">
            <span><Heart aria-hidden="true" size={16} /><small>{t.heroUi.health}</small><strong>{hero.hp.toLocaleString('en-US')}</strong></span>
            <span><Sword aria-hidden="true" size={16} /><small>{t.heroUi.attack}</small><strong>{hero.atk.toLocaleString('en-US')}</strong></span>
            <span><Shield aria-hidden="true" size={16} /><small>{t.heroUi.defense}</small><strong>{hero.def.toLocaleString('en-US')}</strong></span>
          </div>
          <div className="hero-sheet__skill"><WandSparkles aria-hidden="true" size={19} /><span><small>{t.heroUi.skill}</small><strong>{skill?.name}</strong><p>{skill?.description}</p></span></div>
          <button className="hero-upgrade-button" disabled={!hero.canUpgrade || upgrading} onClick={() => onUpgrade(hero.id)} type="button">
            <span>{upgrading ? t.heroUi.upgrading : hero.upgradeCost ? t.heroUi.upgrade : t.heroUi.maximumLevel}</span>
            {hero.upgradeCost ? <strong><Coins aria-hidden="true" size={15} />{t.heroUi.goldCost.replace('{amount}', formatAmount(hero.upgradeCost.gold))}</strong> : null}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
