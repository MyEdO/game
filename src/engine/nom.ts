/**
 * LE NOM D'UN COMBATTANT dans un texte du moteur (#4017) : ce que le groupe en connaît au moment où le texte se
 * compose. Le moteur ne connaît pas la vision du groupe (règle 3 d'AGENTS.md) : le noyau pose le nommeur
 * (`brancherLeJeu`, sur `nomEnVue`). Absent ⇒ le `label` (création de perso, tests purs).
 */
import type { Combatant } from './types';
import type { PlayerText } from '../i18n/playerText';

/** Le nom du combattant `id` tel que le groupe le connaît ; `null` quand il ne le porte pas. */
export type Nommeur = (id: string) => string | null;

let nommeur: Nommeur | undefined;

/** Pose le nommeur et REND le précédent, au patron de `setConditionGainedHook` (`engine/conditions.ts`). */
export function poserLeNommeur(fn: Nommeur | undefined): Nommeur | undefined {
  const precedent = nommeur;
  nommeur = fn;
  return precedent;
}

/** Le nom de `c` dans un texte joueur : la réponse du nommeur posé, sinon son `label`. */
export function nomDe(c: Combatant): PlayerText {
  // eslint-disable-next-line murs/marques -- #4017 : minteur de `PlayerText` — le nom d'un combattant que le groupe connaît, ou le nom neutre du catalogue que rend le nommeur.
  return (nommeur?.(c.id) ?? c.label) as PlayerText;
}
