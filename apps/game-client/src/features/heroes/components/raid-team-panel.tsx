import Image from 'next/image';
import { Check, Save, Swords } from 'lucide-react';
import type { HeroState } from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { HeroClassIcon } from './hero-class-icon';
import { BidiValue } from '@/i18n/bidi';

interface RaidTeamPanelProps {
  dictionary: Dictionary;
  heroes: HeroState[];
  heroIds: string[];
  teamPower: number;
  targetSlot: number;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onSelectSlot(slot: number): void;
  onSave(): void;
}

export function RaidTeamPanel({
  dictionary: t,
  heroes,
  heroIds,
  teamPower,
  targetSlot,
  dirty,
  saving,
  saved,
  onSelectSlot,
  onSave,
}: RaidTeamPanelProps) {
  return (
    <section className="raid-team-panel" aria-labelledby="raid-team-title">
      <div className="hero-section-heading">
        <div><Swords aria-hidden="true" size={16} /><h2 id="raid-team-title">{t.heroUi.raidTeam}</h2></div>
        <span><small>{t.heroUi.teamPower}</small><strong><BidiValue direction="ltr">{teamPower.toLocaleString('en-US')}</BidiValue></strong></span>
      </div>
      <div className="raid-team-slots">
        {[0, 1, 2].map((slotIndex) => {
          const hero = heroes.find((item) => item.id === heroIds[slotIndex]);
          const name = hero ? t.heroNames[hero.key] : `${t.heroUi.slot} ${slotIndex + 1}`;
          return (
            <button
              aria-label={`${t.heroUi.slot} ${slotIndex + 1}: ${name}`}
              aria-pressed={targetSlot === slotIndex}
              className={targetSlot === slotIndex ? 'raid-team-slot raid-team-slot--target' : 'raid-team-slot'}
              data-team-slot={slotIndex + 1}
              key={slotIndex}
              onClick={() => onSelectSlot(slotIndex)}
              type="button"
            >
              {hero ? <Image alt="" className="raid-team-slot__portrait" height={76} src={hero.portraitAsset} width={76} /> : null}
              <span className="raid-team-slot__shade" />
              <span className="raid-team-slot__number"><BidiValue direction="ltr">{slotIndex + 1}</BidiValue></span>
              {hero ? <span className="raid-team-slot__class"><HeroClassIcon combatClass={hero.class} size={12} /></span> : null}
              <span className="raid-team-slot__copy"><strong>{name}</strong>{hero ? <small>{t.heroUi.level} <BidiValue direction="ltr">{hero.level}</BidiValue></small> : null}</span>
            </button>
          );
        })}
      </div>
      <div className="raid-team-actions">
        <small>{t.heroUi.selectSlot}</small>
        <button className={saved ? 'save-team-button save-team-button--saved' : 'save-team-button'} disabled={!dirty || saving} onClick={onSave} type="button">
          {saved ? <Check aria-hidden="true" size={15} /> : <Save aria-hidden="true" size={15} />}
          {saved ? t.heroUi.teamSaved : saving ? t.heroUi.savingTeam : t.heroUi.saveTeam}
        </button>
      </div>
    </section>
  );
}
