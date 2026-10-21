import { REFERENCES_NARRATIVES, type CleDeRegistreNarratif } from '../../data/schemas/defs-scenes/registres-narratifs';
import { etatDeclare, valeurDEtat, type EtatDeclare } from '../../data/schemas/defs-scenes/formes-d-etat';
import type { NarratifBlock } from '../../data/schemas/defs-scenes/narratif';
import { nomDePreset } from '../../noyau/monde/resolveursDuNarratif';

/** Clé d'une référence narrative (`REFERENCES_NARRATIVES`). */
export type CleDeReferenceNarrative = keyof typeof REFERENCES_NARRATIVES;

/** Libellé d'AFFICHAGE d'une entrée de chaque registre du narratif ; l'id reste la valeur manipulée.
 *  Un registre sans libellé ne compile pas. */
export const LIBELLE_NARRATIF: { readonly [R in CleDeRegistreNarratif]: (e: NarratifBlock[R][number]) => string } = {
  affaires: (a) => a.titre,
  indices: (i) => i.titre,
  presetsPnj: (p) => nomDePreset(p) ?? p.id,
  objets: (o) => o.label,
  documents: (d) => d.titre,
  etats: (e) => e.label,
};

/** Les stades de l'indice `indiceId`, chacun libellé par son RANG (« stade 2 », comme au formulaire de
 *  l'indice) ; l'id reste la valeur manipulée. */
export function entreesDeStades(narratif: NarratifBlock, indiceId: string | undefined): { id: string; label: string }[] {
  return (narratif.indices.find((i) => i.id === indiceId)?.stades ?? []).map((s, i) => ({ id: s.id, label: `stade ${i + 1}` }));
}

/** Libellé du stade `id` de l'indice `indiceId` — `undefined` s'il ne résout pas. */
export const libelleDeStade = (narratif: NarratifBlock, indiceId: string | undefined, id: string): string | undefined =>
  entreesDeStades(narratif, indiceId).find((e) => e.id === id)?.label;

/** Libellé d'AFFICHAGE de l'état `id` de `etats` — ou, `valeur` posée, de cette valeur déclarée ; l'id
 *  quand il ne résout pas. */
export const libelleDEtat = (etats: readonly EtatDeclare[] | undefined, id: string, valeur?: string): string =>
  valeur === undefined ? etatDeclare(etats, id)?.label ?? id : valeurDEtat(etats, id, valeur)?.label ?? valeur;

/** Les entrées (id + libellé) du registre que désigne `cle`, lu à `REFERENCES_NARRATIVES`. */
export function entreesNarratives(narratif: NarratifBlock, cle: CleDeReferenceNarrative): { id: string; label: string }[] {
  const registre = REFERENCES_NARRATIVES[cle];
  const libelle = LIBELLE_NARRATIF[registre] as (e: { id: string }) => string;
  return (narratif[registre] as readonly { id: string }[]).map((e) => ({ id: e.id, label: libelle(e) }));
}

/** Libellé de l'entrée `id` du registre que désigne `cle` — `undefined` si elle ne résout pas. */
export const libelleNarratif = (narratif: NarratifBlock, cle: CleDeReferenceNarrative, id: string): string | undefined =>
  entreesNarratives(narratif, cle).find((e) => e.id === id)?.label;
