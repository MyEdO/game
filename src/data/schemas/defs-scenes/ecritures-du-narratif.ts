/**
 * ÉCRITURES du bloc narratif qui ne lisent que le narratif (#3059) : l'id frais d'une entrée neuve, la
 * création, l'identité d'un état et ses repères, le couplage d'un stade à son document, et les recoupements d'indices (`indices[].refs`), qui ne sont pas une clé de
 * `REFERENCES_NARRATIVES` et que `renommeRef` (`./refs-narratives.ts`) ne suit donc pas. PURES.
 *
 * Les écritures qui lisent le projet (renommage propagé, retrait gardé par les références) vivent au
 * noyau : `src/noyau/narratifEdit.ts`.
 */
import { REGISTRES_NARRATIFS, type CleDeRegistreNarratif } from './registres-narratifs';
import type { EtatNarratif, Indice, IndiceStade, NarratifBlock } from './narratif';
import type { z } from 'zod';
import { raceKeySchema, sexeSchema } from '../grammaire/valeurs';
import type { identiteSchema } from '../grammaire/campagne';

/** L'identité d'un état `heros` (`identiteSchema`). */
export type Identite = z.infer<typeof identiteSchema>;

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

/** Les stades d'un indice ; d'un état, ses valeurs déclarées, son identité et ses repères. */
export const STADES = ['stades'] as const;
export const VALEURS_D_ETAT = ['forme', 'valeurs'] as const;
export const IDENTITE = ['forme', 'identite'] as const;
export const REPERES = [...IDENTITE, 'reperes'] as const;

/** Les registres du narratif dont une entrée déclare des sous-entrées à clé (`CibleNarrative.sous`), chacune de leurs
 *  familles, le chemin de sa sous-collection et son nom : les stades d'un indice ; les valeurs déclarées d'un état et les
 *  repères de son identité, que sa forme rend exclusifs (`renommeAuProjet`). #3606 B8 */
export const SOUS_ENTREES: { readonly [R in RegistreCreable]?: readonly { readonly chemin: readonly string[]; readonly famille: 'stade' | 'valeur' | 'repere' }[] } = {
  indices: [{ chemin: STADES, famille: 'stade' }],
  etats: [{ chemin: VALEURS_D_ETAT, famille: 'valeur' }, { chemin: REPERES, famille: 'repere' }],
};

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

/** Une identité neuve : une ancre, le repère qui la porte, aucune ligne. */
export const identiteNeuve = (): Identite => ({ ancres: ['Nom'], reperes: [{ id: 'repere-1', fragment: 'Nom' }], lignes: [] });

/** Le repère neuf de l'identité `identite` : d'identifiant frais (`idFrais`), à fragment vide. */
export const repereNeuf = (identite: Identite): Identite['reperes'][number] => ({ id: idFrais('repere', identite.reperes), fragment: '' });

/** L'identité `identite` où chaque ligne porte une valeur, vide, de chaque repère qu'elle ne couvre pas encore. */
export const identiteCouverte = (identite: Identite): Identite => ({
  ...identite,
  lignes: identite.lignes.map((l) => {
    const manquants = identite.reperes.filter((r) => !l.valeurs.some((v) => v.repere === r.id));
    return manquants.length ? { ...l, valeurs: [...l.valeurs, ...manquants.map((r) => ({ repere: r.id, valeur: '' }))] } : l;
  }),
});

/** Les lignes neuves de l'identité `identite` : une par espèce et sexe qu'aucune de ses lignes ne porte, sans valeur. */
export const lignesNeuves = (identite: Identite): Identite['lignes'] =>
  raceKeySchema.options.flatMap((espece) => sexeSchema.options.flatMap((sexe) => (identite.lignes.some((l) => l.espece === espece && l.sexe === sexe) ? [] : [{ espece, sexe, valeurs: [] }])));

/** L'identité `identite` où le repère `de` prend l'identifiant `vers`, dans chaque ligne aussi. */
export const repereRenomme = (identite: Identite, de: string, vers: string): Identite => ({
  ...identite,
  reperes: identite.reperes.map((r) => (r.id === de ? { ...r, id: vers } : r)),
  lignes: identite.lignes.map((l) => ({ ...l, valeurs: l.valeurs.map((v) => (v.repere === de ? { ...v, repere: vers } : v)) })),
});

/** L'identité `identite` sans le repère `id`, ni sa valeur dans chaque ligne. */
export const repereRetire = (identite: Identite, id: string): Identite => ({
  ...identite,
  reperes: identite.reperes.filter((r) => r.id !== id),
  lignes: identite.lignes.map((l) => ({ ...l, valeurs: l.valeurs.filter((v) => v.repere !== id) })),
});

/** L'état `etat` dont l'identité, s'il en porte une, est couverte (`identiteCouverte`). */
export const etatCouvert = (etat: EtatNarratif): EtatNarratif =>
  (etat.forme.kind === 'heros' && etat.forme.identite ? { ...etat, forme: { ...etat.forme, identite: identiteCouverte(etat.forme.identite) } } : etat);

/** Le stade `stade` couplé à son document (`raffineNarratif`, « ni prose ni document ») : sans document, sa prose
 *  absente devient vide ; avec lui, sa prose vide se retire. */
export function stadeCouple(stade: IndiceStade): IndiceStade {
  if (stade.documentId === undefined) return stade.prose === undefined ? { ...stade, prose: '' } : stade;
  if (stade.prose !== '') return stade;
  const { prose: _vide, ...sans } = stade;
  return sans;
}

/** L'indice `indice`, chacun de ses stades couplé à son document (`stadeCouple`). */
export const indiceCouple = (indice: Indice): Indice => ({ ...indice, stades: indice.stades.map(stadeCouple) });
