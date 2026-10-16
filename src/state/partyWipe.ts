/**
 * ANÉANTISSEMENT DU GROUPE HORS COMBAT — invariant global de non-viabilité.
 *
 * En combat, la défaite est constatée par `checkBattleOver` (`!heroesAlive` → `battle.over='defeat'`).
 * Hors combat (entretien/faim, exposition, maladie, cascade de nuit, damnation, effets de scène), rien
 * ne constatait la non-viabilité du groupe : un groupe entier mort de faim en mer laissait le voyage
 * continuer. `checkPartyWiped` est le pendant hors-combat, appelé aux carrefours de mort hors combat
 * (`advanceTime` après l'entretien, la clôture de toute séquence hors combat — modale ou pilote
 * immédiat, `clotureHorsCombat` —, la damnation) — il présente le
 * MÊME écran de défaite (drapeau `partyWiped`, lu par `CampaignView`) et purge les flux SUSPENDUS.
 *
 * Prédicat IDENTIQUE à la victoire de combat : « aucun héros hors d'action » (`isOutOfAction` couvre
 * mort, Inconscient, sorti de rencontre) — un groupe entièrement à terre est non-viable, qu'il soit
 * mort ou inconscient de faim.
 */
import { isOutOfAction } from '../engine/conditions';
import type { Get, Set } from './flowTypes';
import type { PendingCascade } from './pendings';

/** Le groupe est-il anéanti HORS COMBAT ? Si oui, présente la défaite (drapeau `partyWiped`) et purge
 *  les flux suspendus (voyage, repos, cascades, Tests d'équipage) — jamais un écran de défaite SOUS une
 *  modale de campement/voyage. Renvoie true si la défaite est (déjà) posée. No-op en combat. */
export function checkPartyWiped(get: Get, set: Set): boolean {
  if (get().battle) return false; // en combat : `checkBattleOver` gère la défaite
  if (get().partyWiped) return true;
  if (!groupeNonViable(get)) return false; // au moins un héros ENCORE EN ACTION (même prédicat que la fin de bataille)
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

/** Prédicat de non-viabilité, SANS constat : « aucun héros encore en action ». */
function groupeNonViable(get: Get): boolean {
  const party = get().party;
  return party.length > 0 && !party.some((h) => !isOutOfAction(h));
}

/**
 * CLÔTURE D'UNE SÉQUENCE HORS COMBAT par le pilote IMMÉDIAT (`runCascadeImmediate`) — pendant de
 * `dispatchCascadeDone`, qui constate au slot déjà rendu. Vrai = la séquence n'a PAS de dénouement
 * à enchaîner : un combat ou un slot de cascade que CE pilote a écrit (`slotALEntree` différent) a pris
 * la main (la reprise appartient à leur clôture), ou le groupe est anéanti. Sous un slot vivant, la
 * défaite n'est pas constatée ici : purger sous lui laisserait sa réconciliation le ressusciter sous
 * l'écran de défaite — sa clôture la constate (`dispatchCascadeDone`) ; le pilote, lui, n'enchaîne pas.
 */
export function clotureHorsCombat(get: Get, set: Set, slotALEntree: PendingCascade | null): boolean {
  if (get().battle) return true;
  const slot = get().pendingCascade;
  if (slot && slot !== slotALEntree) return true;
  if (slot) return groupeNonViable(get);
  return checkPartyWiped(get, set);
}
