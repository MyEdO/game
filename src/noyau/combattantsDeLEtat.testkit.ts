/**
 * Un combattant posé au bout d'un chemin de `CHEMINS_DES_COMBATTANTS` (`combattantsDeLEtat.generated.ts`),
 * et relu au même chemin : une écriture de l'état par champ de premier niveau, quel que soit le champ.
 * Un conteneur absent se crée réduit au seul chemin ; un tableau ne porte que le combattant posé.
 */
import type { Combatant } from '../engine/types';
import { CHEMINS_DES_COMBATTANTS } from './combattantsDeLEtat.generated';
import type { EtatDeJeu } from './etat';

export type CheminDeCombattant = (typeof CHEMINS_DES_COMBATTANTS)[number];

/** Chaque chemin, nommé (`battle.combatants.[]`) pour `it.each`. */
export const CHEMINS_NOMMES: readonly (readonly [nom: string, chemin: CheminDeCombattant])[] =
  CHEMINS_DES_COMBATTANTS.map((chemin) => [chemin.join('.'), chemin]);

function poser(courant: unknown, chemin: readonly string[], c: Combatant): unknown {
  if (!chemin.length) return c;
  const [pas, ...reste] = chemin;
  if (pas === '[]') return [poser(undefined, reste, c)];
  const objet = (courant ?? {}) as Record<string, unknown>;
  return { ...objet, [pas]: poser(objet[pas], reste, c) };
}

/** L'écriture qui pose `c` au bout de `chemin` dans `etat` : son seul champ de premier niveau, remplacé. */
export function poserAuChemin(etat: EtatDeJeu, [champ, ...chemin]: CheminDeCombattant, c: Combatant): Partial<EtatDeJeu> {
  return { [champ]: poser(etat[champ], chemin, c) } as Partial<EtatDeJeu>;
}

/** Le (premier) combattant au bout de `chemin` dans `etat`. */
export function lireAuChemin(etat: EtatDeJeu, chemin: CheminDeCombattant): Combatant {
  return chemin.reduce<unknown>((v, pas) => (v as Record<string, unknown>)[pas === '[]' ? 0 : pas], etat) as Combatant;
}
