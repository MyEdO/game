import { useMemo } from 'react';
import { RefField } from '../compendium/refField/RefField';
import { giveTrappingSchema } from '../../data/schemas/defs-scenes/effets';
import { trappingDesObjetsPuisDuCatalogue, type TrappingData } from '../../data';
import { apparencesAdmissibles } from '../../engine/items';
import { MediaSelect } from '../MediaSelect';
import { useVersionDesDatasets } from '../useVersionDesDatasets';

export interface ObjetDonne {
  trappingId?: string;
  custom?: string;
  apparence?: { id: string };
}

/** Écrivain commun des objets donnés par effet ou op (#2948). */
export function ObjetDonneField<T extends ObjetDonne>({ objets = [], value, onChange }: {
  objets?: readonly TrappingData[];
  value: T;
  onChange: (next: T) => void;
}) {
  useVersionDesDatasets();
  const parId = useMemo(() => new Map(objets.map((o) => [o.id, o])), [objets]);
  const resolveTrapping = (id: string) => trappingDesObjetsPuisDuCatalogue(parId, id);
  const choices = apparencesAdmissibles(value, resolveTrapping);
  const poser = (patch: ObjetDonne) => {
    const next = { ...value, ...patch };
    for (const cle of ['trappingId', 'custom', 'apparence'] as const) if (next[cle] === undefined) delete next[cle];
    onChange(next);
  };
  return <>
    <RefField label="Objet" ariaLabel="Objet donné" cfg={{ ds: 'trappings', freeText: true }} noeud={giveTrappingSchema.shape.trappingId}
      entreesEnTete={objets} value={value.trappingId ?? value.custom}
      onChange={(v) => {
        const id = typeof v === 'string' ? v : undefined;
        const trappingId = id && trappingDesObjetsPuisDuCatalogue(parId, id) ? id : undefined;
        const apparence = value.apparence && apparencesAdmissibles({ trappingId }, resolveTrapping).some((a) => a.id === value.apparence?.id)
          && value.apparence.id !== (trappingId ? resolveTrapping(trappingId)?.shape?.id : undefined) ? value.apparence : undefined;
        poser({ trappingId, custom: trappingId ? undefined : id, apparence });
      }} />
    {choices.length > 0 && <div className="ed-field">
      <span>Apparence</span>
      <MediaSelect title="Apparence de l’objet donné" triggerClassName="btn"
        value={value.apparence?.id ?? (value.trappingId ? resolveTrapping(value.trappingId)?.shape?.id : undefined)}
        options={choices.map((a) => ({ key: a.id, label: a.label }))}
        onSelect={(id) => poser({ apparence: id === (value.trappingId ? resolveTrapping(value.trappingId)?.shape?.id : undefined) ? undefined : { id } })} />
    </div>}
  </>;
}
