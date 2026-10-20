/**
 * PROVENANCE d'une VALEUR d'auteur (billet, dé de péril, vitesse, distance d'une route) : la source
 * (`SourceRefField facultative`) OU la raison maison, posée à côté de la valeur qu'elle justifie.
 * Sans l'une ni l'autre, une valeur exigée porte son refus (`refuserSansProvenance`).
 */
import { SourceRefField } from '../SourceRefField';
import { ProseField } from '../ProseField';
import { ChipDeRefus } from '../ChipDeRefus';
import { Stack } from '../Layout';
import type { ProvenanceDeValeur as Provenance } from '../../noyau/worldMap';

export function ProvenanceDeValeur({ identite, sujet, value, onChange, exigee = true }: {
  /** IDENTITÉ du porteur (contrat de `SourceRefField`) : la changer repart de `value`. */
  identite: string;
  /** Ce que la provenance justifie (« du billet Diligence », « du dé de péril »). */
  sujet: string;
  value: Provenance | undefined;
  onChange: (patch: Provenance) => void;
  /** La valeur est refusée au chargement sans provenance. */
  exigee?: boolean;
}) {
  return (
    <Stack className="panel sunken" gap="sm">
      <SourceRefField
        identite={`${identite}/source`} label={`Source ${sujet}`} facultative sujet={sujet}
        value={value?.source} onChange={(source) => onChange({ ...value, source })}
      />
      <ProseField courte label={`Raison maison ${sujet} (sans source)`} value={value?.maison ?? ''} onChange={(maison) => onChange({ ...value, maison: maison || undefined })} />
      {exigee && !value?.source && !value?.maison && (
        <ChipDeRefus fixe refus={{ message: `Provenance exigée ${sujet} : sa source, ou sa raison maison ; sans elle le projet est refusé au chargement.` }} />
      )}
    </Stack>
  );
}
