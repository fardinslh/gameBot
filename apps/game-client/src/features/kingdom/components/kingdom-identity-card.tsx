'use client';

import { Crown, Feather, Leaf, Pencil, Shield, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  KingdomHeraldryKey,
  KingdomIdentityState,
  KingdomRulerTitle,
  KingdomTransformationState,
} from '@crown-and-coin/shared';
import type { Dictionary } from '@/i18n/config';
import { BidiTemplate } from '@/i18n/bidi';
import { BUILDING_TYPE_TO_ID } from '../data/building-layout';

const TITLES: readonly KingdomRulerTitle[] = ['LORD', 'LADY', 'WARDEN'];
const HERALDRY: readonly KingdomHeraldryKey[] = ['GOLDEN_LION', 'VERDANT_STAG', 'CRIMSON_FALCON'];

interface KingdomIdentityCardProps {
  dictionary: Dictionary;
  identity: KingdomIdentityState;
  playerName: string;
  saving: boolean;
  transformation: KingdomTransformationState;
  onSave(identity: KingdomIdentityState): Promise<boolean>;
}

export function KingdomIdentityCard({ dictionary: t, identity, onSave, playerName, saving, transformation }: KingdomIdentityCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(identity);
  useEffect(() => { setDraft(identity); }, [identity.name, identity.rulerTitle, identity.heraldry]);

  const save = async (): Promise<void> => {
    if (await onSave(draft)) setEditing(false);
  };
  const next = transformation.next;
  const future = transformation.future;

  return <section className="castle-identity" data-heraldry={identity.heraldry}>
    <header className="castle-identity__header">
      <HeraldryMark heraldry={identity.heraldry} />
      <div>
        <small>{t.kingdomIdentity.yourRealm}</small>
        <h3 dir="auto">{identity.name}</h3>
        <p><BidiTemplate template={t.kingdomIdentity.ruledBy} values={{ title: t.kingdomIdentity.titles[identity.rulerTitle], name: { direction: 'auto', value: playerName } }} /></p>
      </div>
      <button aria-label={editing ? t.close : t.kingdomIdentity.edit} data-identity-action="edit" onClick={() => setEditing((value) => !value)} type="button">{editing ? <X size={15} /> : <Pencil size={15} />}</button>
    </header>

    {editing ? <div className="castle-identity__editor">
      <label>{t.kingdomIdentity.kingdomName}<input data-identity-field="name" dir="auto" maxLength={24} minLength={2} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} value={draft.name} /></label>
      <fieldset><legend>{t.kingdomIdentity.rulerTitle}</legend><div>{TITLES.map((title) => <button aria-pressed={draft.rulerTitle === title} data-ruler-title={title} key={title} onClick={() => setDraft((current) => ({ ...current, rulerTitle: title }))} type="button">{t.kingdomIdentity.titles[title]}</button>)}</div></fieldset>
      <fieldset><legend>{t.kingdomIdentity.banner}</legend><div>{HERALDRY.map((heraldry) => <button aria-label={t.kingdomIdentity.heraldry[heraldry]} aria-pressed={draft.heraldry === heraldry} data-heraldry-choice={heraldry} key={heraldry} onClick={() => setDraft((current) => ({ ...current, heraldry }))} type="button"><HeraldryMark heraldry={heraldry} /><span>{t.kingdomIdentity.heraldry[heraldry]}</span></button>)}</div></fieldset>
      <button className="castle-identity__save" data-identity-action="save" disabled={saving || draft.name.trim().length < 2} onClick={() => void save()} type="button">{saving ? t.kingdomIdentity.saving : t.kingdomIdentity.save}</button>
    </div> : <>
      <div className="castle-realm-state">
        <small>{t.kingdomIdentity.currentRealmState}</small>
        <strong>{t.kingdomIdentity.realmStates[transformation.current.realmState]}</strong>
      </div>
      {next ? <div className="castle-transformation" data-next-transformation>
        <small>{t.kingdomIdentity.nextTransformation}</small>
        <strong><BidiTemplate template={t.kingdomIdentity.castleLevelRealm} values={{ level: { direction: 'ltr', value: next.requiredCastleLevel }, realm: t.kingdomIdentity.realmStates[next.realmState] }} /></strong>
        {next.unlockBuildingType ? <p>{t.kingdomIdentity.transformationArrival[next.unlockBuildingType]}</p> : null}
        <span>{t.kingdomIdentity.realmActivity[next.realmState]}</span>
      </div> : <div className="castle-transformation castle-transformation--complete"><Crown size={16} /><span><strong>{t.kingdomIdentity.realmEstablished}</strong><small>{t.kingdomIdentity.realmEstablishedHint}</small></span></div>}
      {future ? <p className="castle-future-preview"><span>{t.kingdomIdentity.futurePreview}</span><BidiTemplate template={future.unlockBuildingType ? t.kingdomIdentity.futureRealmWithBuilding : t.kingdomIdentity.futureRealm} values={{ realm: t.kingdomIdentity.realmStates[future.realmState], ...(future.unlockBuildingType ? { building: t.buildings[BUILDING_TYPE_TO_ID[future.unlockBuildingType]].name } : {}), level: { direction: 'ltr', value: future.requiredCastleLevel } }} /></p> : null}
    </>}
  </section>;
}

export function HeraldryMark({ heraldry }: { heraldry: KingdomHeraldryKey }) {
  const Icon = heraldry === 'GOLDEN_LION' ? Crown : heraldry === 'VERDANT_STAG' ? Leaf : Feather;
  return <span className="heraldry-mark" data-heraldry={heraldry} aria-hidden="true"><Shield size={31} strokeWidth={1.4} /><Icon size={14} strokeWidth={2.2} /></span>;
}
