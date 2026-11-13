import apparencesJson from './apparences.json';
import trappingsJson from './trappings.json';
import { indexParId } from './versionDataset';
import type { TrappingData } from './index';
import { datasetDe, type EntreeDe } from './datasets';
import type * as apparencesDef from './schemas/defs/apparences';

export type TrappingResolver = (id: string) => TrappingData | undefined;

/** Catalogues et lecteurs partagés par le parse et la résolution d’apparence (#2948). */
export const trappings = trappingsJson as TrappingData[];
export type ApparenceData = EntreeDe<typeof apparencesDef>;
export const apparences = datasetDe<typeof apparencesDef>(apparencesJson);
export const findTrappingById = indexParId('trappings', trappings);
export const findApparenceById = indexParId('apparences', apparences);

/** Candidats de l’objet résolu, hors silhouette imposée et attaque naturelle. */
export function candidatsDApparenceDObjet(trappingId?: string, id?: string, resolveTrapping: TrappingResolver = findTrappingById): string[] {
  const objet = trappingId ? resolveTrapping(trappingId) : undefined;
  const apparence = findApparenceById(id);
  const racine = apparence?.forme?.id ?? apparence?.id;
  if (apparence && racine && (racine === objet?.shape?.id || objet?.formChoices?.includes(racine)))
    return apparence.id === racine ? [racine] : [apparence.id, racine];
  return objet?.shape ? [objet.shape.id] : [];
}

/** Liste canonique admise, calculée par la résolution des candidats. */
export function apparencesAdmissiblesDObjet({ trappingId }: { trappingId?: string }, resolveTrapping: TrappingResolver = findTrappingById): ApparenceData[] {
  return apparences.filter((a) => candidatsDApparenceDObjet(trappingId, a.id, resolveTrapping)[0] === a.id);
}

/** Apparences admissibles d’un objet autres que sa forme par défaut (`shape`) : celles qu’une référence d’auteur pose. */
export function apparencesChoisissablesDObjet(trappingId: string | undefined, resolveTrapping: TrappingResolver = findTrappingById): ApparenceData[] {
  const forme = trappingId ? resolveTrapping(trappingId)?.shape?.id : undefined;
  return apparencesAdmissiblesDObjet({ trappingId }, resolveTrapping).filter((a) => a.id !== forme);
}

/** Objets des armes `armes` dont l’apparence se choisit (`apparencesChoisissablesDObjet`), chacun une fois. */
export function objetsAApparenceChoisie(armes: readonly { trappingId?: string }[], resolveTrapping: TrappingResolver = findTrappingById): string[] {
  return [...new Set(armes.flatMap((w) => (w.trappingId ? [w.trappingId] : [])))].filter((id) => apparencesChoisissablesDObjet(id, resolveTrapping).length);
}

/** Référence d’auteur d’une apparence choisie pour un objet : absente pour la forme par défaut de
 *  l’objet (`shape`) comme pour une apparence qu’il n’admet pas. */
export function referenceDApparenceDObjet(trappingId: string | undefined, id: string | undefined, resolveTrapping: TrappingResolver = findTrappingById): { id: string } | undefined {
  return id !== undefined && apparencesChoisissablesDObjet(trappingId, resolveTrapping).some((a) => a.id === id) ? { id } : undefined;
}

/** Refus commun aux références d’auteur, avec les deux identités. */
export function messageDApparenceDObjet(trappingId: TrappingData['id'] | undefined, id: ApparenceData['id'], resolveTrapping: TrappingResolver = findTrappingById): string | undefined {
  if (apparencesAdmissiblesDObjet({ trappingId }, resolveTrapping).some((a) => a.id === id)) return;
  return `L’objet « ${trappingId ?? 'custom sans trappingId'} » n’admet pas l’apparence « ${id} ».`;
}
