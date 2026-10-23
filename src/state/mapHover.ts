/**
 * « La carte est-elle inerte ? » — SOURCE UNIQUE, consommée par tout ce qui vit sur la scène (survol,
 * piste de déplacement, réticule, intention).
 *
 * Deux verdicts, dans cet ordre :
 *  1. un INTERLUDE piloté par la carte est-il en cours ? La modale s'est effacée et le joueur désigne
 *     sa cible ou sa case sur le champ (2ᵉ frappe des Deux armes, Frappe Mortelle, cibles de
 *     Surincantation, pose de zone, bordée). Le verdict est DÉRIVÉ du registre d'actions
 *     (`surface: 'interlude'` × `mode` de l'aiguilleur de ciblage, `currentInterludeAction`) : une
 *     situation d'interlude de plus est une entrée d'`actions.json` de plus, et rien à toucher ici.
 *     Avant cette dérivation, une liste de `pending*` en dur ne nommait que le ciblage de
 *     Surincantation — pendant `pendingDualStrike` la carte restait MUETTE alors que le clic ouvrait
 *     bien la modale du jet (recette 2026-08-23, #1411 P2-D).
 *  2. sinon, une modale du registre tient-elle la fenêtre (`modalHolds`) ?
 *
 * `pendingRoundStart` (pause « Commencer le combat ») est HORS registre : le joueur arpente le champ
 * avant d'engager, le survol y RESTE actif.
 *
 * Vit hors de `modalArbiter`, module LÉGER (#1054) : la lecture du registre d'actions y monterait le
 * moteur de combat (`combatEffects`, `targetingModes`) dans sa chaîne d'imports.
 */
import { modalHolds } from '../noyau/modalArbiter';
import { currentInterludeAction } from '../noyau/actionRegistry';
import type { GameState } from './store';

export function modalBlocksMapHover(s: GameState): boolean {
  if (currentInterludeAction(() => s)) return false;
  return modalHolds(s);
}
