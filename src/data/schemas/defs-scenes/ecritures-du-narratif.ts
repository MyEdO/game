/**
 * ÉCRITURES du bloc narratif qui ne lisent que le narratif (#3059) : l'id frais d'une entrée neuve, la
 * création, et les recoupements d'indices (`indices[].refs`), qui ne sont pas une clé de
 * `REFERENCES_NARRATIVES` et que `renommeRef` (`./refs-narratives.ts`) ne suit donc pas. PURES.
 *
 * Les écritures qui lisent le projet (renommage propagé, retrait gardé par les références) vivent au
 * noyau : `src/noyau/narratifEdit.ts`.
 */
import { REGISTRES_NARRATIFS, type CleDeRegistreNarratif } from './registres-narratifs';
import type { NarratifBlock } from './narratif';

/** Id frais `<prefixe>-<n>` — `n` part de la taille de la liste `depuis` + 1 — qu'aucune entrée de `pris`
 *  ne porte. */
export function idFrais(prefixe: string, depuis: readonly { id?: string }[], pris: readonly { id?: string }[] = depuis): string {
  let n = depuis.length + 1;
  while (pris.some((e) => e.id === `${prefixe}-${n}`)) n++;
  return `${prefixe}-${n}`;
}

/** Les entrées de TOUS les registres du narratif (`REGISTRES_NARRATIFS`) : l'id frais d'un registre n'en
 *  recoupe aucune (unicité inter-registres de `narratifSchema`). */
const entreesDuNarratif = (narratif: NarratifBlock): readonly { id?: string }[] =>
  REGISTRES_NARRATIFS.flatMap((r) => narratif[r.cle] as readonly { id?: string }[]);

/** Les registres où l'auteur crée une entrée, et le préfixe de leur id frais. */
const PREFIXE_D_ID = { affaires: 'affaire', indices: 'indice', presetsPnj: 'pnj', documents: 'document', etats: 'etat' } as const satisfies Partial<Record<CleDeRegistreNarratif, string>>;
export type RegistreCreable = keyof typeof PREFIXE_D_ID;

/** Ajoute `entree` au `registre`, sous un id frais qu'aucune entrée du narratif ne porte. */
export function ajouteEntree<R extends RegistreCreable>(narratif: NarratifBlock, registre: R, entree: Omit<NarratifBlock[R][number], 'id'>): { narratif: NarratifBlock; id: string } {
  const liste = narratif[registre] as readonly { id: string }[];
  const id = idFrais(PREFIXE_D_ID[registre], liste, entreesDuNarratif(narratif));
  return { narratif: { ...narratif, [registre]: [...liste, { ...entree, id }] }, id };
}

/** Le narratif où aucun recoupement ne vise plus l'indice `id` ; une liste vidée se retire. */
export const recoupementsSans = (narratif: NarratifBlock, id: string): NarratifBlock => ({
  ...narratif,
  indices: narratif.indices.map((i) => {
    if (!i.refs?.includes(id)) return i;
    const refs = i.refs.filter((r) => r !== id);
    return { ...i, refs: refs.length ? refs : undefined };
  }),
});

/** Le narratif où chaque recoupement vers l'indice `id` vise `nouveau`. */
export const recoupementsVers = (narratif: NarratifBlock, id: string, nouveau: string): NarratifBlock => ({
  ...narratif,
  indices: narratif.indices.map((i) => (i.refs?.includes(id) ? { ...i, refs: i.refs.map((r) => (r === id ? nouveau : r)) } : i)),
});
