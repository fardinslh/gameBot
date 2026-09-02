import type { ArmyPreview } from '@crown-and-coin/shared';
import { Swords } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';
import { HERO_WORLD_ASSET } from '@/features/heroes/data/hero-world-assets';

const TROOP_ASSET = {
  INFANTRY: '/assets/troops/infantry.webp',
  ARCHER: '/assets/troops/archer.webp',
  CAVALRY: '/assets/troops/cavalry.webp',
} as const;

export function RaidDeparture({ army, dictionary: t }: { army: ArmyPreview; dictionary: Dictionary }) {
  return <div className="raid-departure" data-raid-departure-count={army.squads.length} role="status">
    <div className="raid-departure__origin" aria-hidden="true"><img alt="" src="/assets/kingdom/evolution/default/castle/tier-1.webp" /></div>
    <small>{t.raidJourney.departureKicker}</small>
    <h1><Swords size={22} /> {t.raidJourney.departureTitle}</h1>
    <p>{t.raidJourney.departureBody}</p>
    <div className="raid-departure__formation" dir="ltr">
      {army.squads.map((squad, index) => <figure key={squad.slot} style={{ '--departure-order': index } as React.CSSProperties}>
        <span><img className="raid-departure__troop" alt="" src={TROOP_ASSET[squad.troopType]} /><img className="raid-departure__hero" alt="" src={HERO_WORLD_ASSET[squad.commander.key]} /></span>
        <figcaption className="sr-only">{t.heroNames[squad.commander.key]} · {t.armyUi.troopNames[squad.troopType]} × <BidiValue direction="ltr">{squad.unitCount}</BidiValue></figcaption>
      </figure>)}
    </div>
  </div>;
}
