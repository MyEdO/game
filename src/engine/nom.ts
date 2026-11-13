/**
 * LE NOM D'UN COMBATTANT dans un texte du moteur (#4017) : ce que le groupe en connaît au moment où le texte se
 * compose. Le moteur ne connaît pas la vision du groupe (règle 3 d'AGENTS.md) : le noyau pose le nommeur
 * (`brancherLeJeu`, sur `nomEnVue`). Absent ⇒ le `label` (création de perso, tests purs).
 */
import type { Combatant } from './types';
import type { PlayerText } from '../i18n/playerText';
import { libelleOuAbsence, type NatureAbsente } from '../data';

/** Le nom du combattant `id` tel que le groupe le connaît ; `null` quand il ne le porte pas. */
export type Nommeur = (id: string) => PlayerText | null;

let nommeur: Nommeur | undefined;

/** Pose le nommeur et REND le précédent, au patron de `setConditionGainedHook` (`engine/conditions.ts`). */
export function poserLeNommeur(fn: Nommeur | undefined): Nommeur | undefined {
  const precedent = nommeur;
  nommeur = fn;
  return precedent;
}

/** Le nom de `c` dans un texte joueur : la réponse du nommeur posé, sinon son `label`. */
export function nomDe(c: Combatant): PlayerText {
  // eslint-disable-next-line murs/marques -- #4017 : minteur de `PlayerText` — sans nommeur posé, le `label` du combattant.
  return nommeur?.(c.id) ?? (c.label as PlayerText);
}

/** Le nom de `c` quand il est là, sinon l'absence du catalogue (`libelleOuAbsence`) pour l'`id` cherché. */
export function nomOuAbsence(c: Combatant | undefined, nature: NatureAbsente, id: string): PlayerText {
  return c ? nomDe(c) : libelleOuAbsence(undefined, nature, id);
}
