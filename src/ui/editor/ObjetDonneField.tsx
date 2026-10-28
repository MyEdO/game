import { useMemo } from 'react';
import { RefField } from '../compendium/refField/RefField';
import { giveTrappingSchema } from '../../data/schemas/defs-scenes/effets';
import { trappingDesObjetsPuisDuCatalogue, type TrappingData } from '../../data';
import { apparencesAdmissiblesDObjet, candidatsDApparenceDObjet, referenceDApparenceDObjet } from '../../data/apparencesObjets';
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
  const choices = apparencesAdmissiblesDObjet(value, resolveTrapping);
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
        poser({ trappingId, custom: trappingId ? undefined : id, apparence: referenceDApparenceDObjet(trappingId, value.apparence?.id, resolveTrapping) });
      }} />
    {choices.length > 0 && <div className="ed-field">
      <span>Apparence</span>
      <MediaSelect title="Apparence de l’objet donné" triggerClassName="btn"
        value={candidatsDApparenceDObjet(value.trappingId, value.apparence?.id, resolveTrapping)[0]}
        options={choices.map((a) => ({ key: a.id, label: a.label }))}
        onSelect={(id) => poser({ apparence: referenceDApparenceDObjet(value.trappingId, id, resolveTrapping) })} />
    </div>}
  </>;
}
