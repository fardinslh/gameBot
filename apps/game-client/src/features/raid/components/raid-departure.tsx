import type { ArmyPreview } from '@crown-and-coin/shared';
import { Swords } from 'lucide-react';
import type { Dictionary } from '@/i18n/config';
import { BidiValue } from '@/i18n/bidi';

const TROOP_ASSET = {
  INFANTRY: '/assets/troops/infantry.webp',
  ARCHER: '/assets/troops/archer.webp',
  CAVALRY: '/assets/troops/cavalry.webp',
} as const;

export function RaidDeparture({ army, dictionary: t }: { army: ArmyPreview; dictionary: Dictionary }) {
  return <div className="raid-departure" data-raid-departure-count={army.squads.length} role="status">
    <div className="raid-departure__gate" aria-hidden="true" />
    <small>{t.raidJourney.departureKicker}</small>
    <h1><Swords size={22} /> {t.raidJourney.departureTitle}</h1>
    <p>{t.raidJourney.departureBody}</p>
    <div className="raid-departure__formation" dir="ltr">
      {army.squads.map((squad, index) => <figure key={squad.slot} style={{ '--departure-order': index } as React.CSSProperties}>
        <span><img alt="" src={squad.commander.portraitAsset} /><img alt="" src={TROOP_ASSET[squad.troopType]} /></span>
        <figcaption>{t.heroNames[squad.commander.key]}<small>{t.armyUi.troopNames[squad.troopType]} × <BidiValue direction="ltr">{squad.unitCount}</BidiValue></small></figcaption>
      </figure>)}
    </div>
  </div>;
}
