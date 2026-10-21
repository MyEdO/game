/**
 * IDENTITÉ d'un état `heros` à l'affichage d'une prose de paquet (EDO 02 l.112-127, #686) : la prose
 * STOCKÉE reste verbatim, seul le texte rendu nomme le héros désigné. Le couple espèce × sexe se FIGE
 * au choix du héros (`coupleDIdentite`, EDO 02 l.114) ; les textes restent dans `identite.lignes`.
 * Fonctions PURES ; le rendu les lit par `useIdentites` (`src/ui/useIdentites.ts`).
 */
import { findSpeciesById } from '../../data';
import { motifEnMot, type NarratifBlock } from '../../data/schemas/defs-scenes/narratif';
import type { RaceKey, Sexe } from '../../data/schemas/grammaire/valeurs';

/** Le couple figé d'un état `heros`. */
export interface CoupleDIdentite { readonly espece: RaceKey; readonly sexe: Sexe }

/** Les identités en vigueur : texte d'un repère → texte de sa valeur, et leur motif compilé une fois. */
export interface Identites { readonly table: ReadonlyMap<string, string>; readonly motif: RegExp }

/** Les identités d'une table repère → valeur. */
export function identitesDe(table: ReadonlyMap<string, string>): Identites {
  return { table, motif: motifEnMot([...table.keys()], 'gu') };
}

export const AUCUNE_IDENTITE: Identites = identitesDe(new Map());

/** Le couple à figer pour un héros : `undefined` sans espèce connue ou sans sexe d'apparence. */
export function coupleDIdentite(heros: { readonly species?: string; readonly appearance?: { readonly sex: Sexe } } | undefined): CoupleDIdentite | undefined {
  const espece = findSpeciesById(heros?.species)?.refChar;
  const sexe = heros?.appearance?.sex;
  return espece && sexe ? { espece, sexe } : undefined;
}

/** Ce que la résolution lit de l'état de jeu. */
export interface SourceDIdentites {
  readonly identitesFigees: Readonly<Record<string, CoupleDIdentite>>;
  readonly campaignNarratif: Pick<NarratifBlock, 'etats'> | null;
}

/** Pour chaque état `heros` à identité, la ligne du couple figé. Sans couple ou sans ligne, l'état ne nomme
 *  rien ; un repère déjà nommé par un état précédent garde ce nom. */
export function identitesResolues(s: SourceDIdentites): Identites {
  const table = new Map<string, string>();
  for (const etat of s.campaignNarratif?.etats ?? []) {
    if (etat.forme.kind !== 'heros' || !etat.forme.identite) continue;
    const couple = s.identitesFigees[etat.id];
    if (!couple) continue;
    const ligne = etat.forme.identite.lignes.find((l) => l.espece === couple.espece && l.sexe === couple.sexe);
    if (!ligne) continue;
    for (const r of etat.forme.identite.reperes) {
      const v = ligne.valeurs.find((x) => x.repere === r.id);
      if (v && !table.has(r.fragment)) table.set(r.fragment, v.valeur);
    }
  }
  return table.size ? identitesDe(table) : AUCUNE_IDENTITE;
}

/** Clé PRIMITIVE des couples figés (`etat:espece:sexe`, triés), et sa lecture inverse. */
export const cleDesIdentites = (figees: Readonly<Record<string, CoupleDIdentite>>): string =>
  JSON.stringify(Object.entries(figees).map(([etat, c]) => [etat, c.espece, c.sexe]).sort());
export const couplesDeLaCle = (cle: string): Record<string, CoupleDIdentite> =>
  Object.fromEntries((JSON.parse(cle) as [string, RaceKey, Sexe][]).map(([etat, espece, sexe]) => [etat, { espece, sexe }]));

/** `md` où chaque repère, en mot entier, devient sa valeur — en UNE passe : une valeur insérée n'est jamais relue. */
export function nommer(md: string, identites: Identites): string {
  if (identites.table.size === 0) return md;
  return md.replace(identites.motif, (m) => identites.table.get(m) ?? m);
}
