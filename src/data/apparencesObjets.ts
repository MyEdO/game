import apparencesJson from './apparences.json';
import trappingsJson from './trappings.json';
import { indexParId } from './versionDataset';
import type { TrappingData } from './index';
import type { ApparenceData } from './schemas/defs/apparences';

export type TrappingResolver = (id: string) => TrappingData | undefined;

/** Catalogues et lecteurs partagés par le parse et la résolution d’apparence (#2948). */
export const trappings = trappingsJson as TrappingData[];
export const apparences = apparencesJson as ApparenceData[];
export const findTrappingById = indexParId('trappings', trappings);
export const findApparenceById = indexParId('apparences', apparences);

/** Candidats de l’objet résolu, hors silhouette imposée et attaque naturelle. */
export function candidatsDApparenceDObjet(trappingId?: string, id?: string, resolveTrapping: TrappingResolver = findTrappingById): string[] {
  const objet = trappingId ? resolveTrapping(trappingId) : undefined;
  const apparence = findApparenceById(id);
  const racine = apparence?.forme ?? apparence?.id;
  if (apparence && racine && (racine === objet?.shape || objet?.formChoices?.includes(racine)))
    return apparence.id === racine ? [racine] : [apparence.id, racine];
  return objet?.shape ? [objet.shape] : [];
}

/** Liste canonique admise, calculée par la résolution des candidats. */
export function apparencesAdmissiblesDObjet({ trappingId }: { trappingId?: string }, resolveTrapping: TrappingResolver = findTrappingById): ApparenceData[] {
  return apparences.filter((a) => candidatsDApparenceDObjet(trappingId, a.id, resolveTrapping)[0] === a.id);
}

/** Refus commun aux références d’auteur, avec les deux identités. */
export function messageDApparenceDObjet(trappingId: TrappingData['id'] | undefined, id: ApparenceData['id'], resolveTrapping: TrappingResolver = findTrappingById): string | undefined {
  if (apparencesAdmissiblesDObjet({ trappingId }, resolveTrapping).some((a) => a.id === id)) return;
  return `L’objet « ${trappingId ?? 'custom sans trappingId'} » n’admet pas l’apparence « ${id} ».`;
}
