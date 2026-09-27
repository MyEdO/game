/**
 * ANÉANTISSEMENT DU GROUPE HORS COMBAT — invariant global de non-viabilité.
 *
 * En combat, la défaite est constatée par `checkBattleOver` (`!heroesAlive` → `battle.over='defeat'`).
 * Hors combat (entretien/faim, exposition, maladie, cascade de nuit, damnation, effets de scène), rien
 * ne constatait la non-viabilité du groupe : un groupe entier mort de faim en mer laissait le voyage
 * continuer. `checkPartyWiped` est le pendant hors-combat, appelé aux carrefours de mort hors combat
 * (`advanceTime` après l'entretien, la fin de cascade de nuit/voyage, la damnation) — il présente le
 * MÊME écran de défaite (drapeau `partyWiped`, lu par `CampaignView`) et purge les flux SUSPENDUS.
 *
 * Prédicat IDENTIQUE à la victoire de combat : « aucun héros hors d'action » (`isOutOfAction` couvre
 * mort, Inconscient, sorti de rencontre) — un groupe entièrement à terre est non-viable, qu'il soit
 * mort ou inconscient de faim.
 */
import { isOutOfAction } from '../engine/conditions';
import type { Get, Set } from './flowTypes';

/** Le groupe est-il anéanti HORS COMBAT ? Si oui, présente la défaite (drapeau `partyWiped`) et purge
 *  les flux suspendus (voyage, repos, cascades, Tests d'équipage) — jamais un écran de défaite SOUS une
 *  modale de campement/voyage. Renvoie true si la défaite est (déjà) posée. No-op en combat. */
export function checkPartyWiped(get: Get, set: Set): boolean {
  if (get().battle) return false; // en combat : `checkBattleOver` gère la défaite
  if (get().partyWiped) return true;
  const party = get().party;
  if (!party.length) return false;
  if (party.some((h) => !isOutOfAction(h))) return false; // au moins un héros ENCORE EN ACTION (même prédicat que la fin de bataille)
  set({
    partyWiped: true,
    mode: 'exploration',
    // Purge des flux SUSPENDUS (comme la fin de bataille remet le terrain à plat). Une CONTINUATION en
    // vol (#1508 : le reste d'un lot que le dé d'une chute faisait attendre) part avec eux, et c'est
    // l'issue juste : le groupe est anéanti, il n'y a plus personne à qui appliquer une suite. La
    // VICTOIRE, elle, ne purge pas — elle reprend par la couture universelle (`resumeSuspendedCascade`,
    // `store.dismissVictory`).
    pendingRest: null,
    pendingCascade: null,
    suspendedCascades: [],
    sequence: null,
    travelPlan: null,
    travelRecap: null,
    pendingCrewTest: null,
    pendingSteamSave: null,
    pendingSeaActivities: null,
    pendingShoreLeave: null,
    pendingManannPriest: null,
  });
  return true;
}
