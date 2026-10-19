/**
 * Tenue d'un porteur de dé par un siège, lue sur `s.net` (#1426).
 */
import type { GameState } from '../state/store';
import type { Combatant } from '../engine/types';
import { inBattleId, porteurParId } from './monde/combatants';
import { WORLD_STEP_OWNER } from './pendings';

/**
 * LE SIÈGE DU MONDE — celui qui tient l'environnement (météo, périls, marché, désertion) : le siège
 * MJ quand il existe (bac-à-sable), l'hôte (siège 0) sinon. Il existe TOUJOURS, et il est humain :
 * c'est ce qui rend un jet de monde surfaçable au même titre que celui d'un héros (`rollSeam.surfaceOf`).
 */
export function worldSeat(s: GameState): number {
  return s.net.gmSeat ?? 0;
}

/**
 * LE PORTEUR EST-IL CONDUIT PAR LE SIÈGE DU MONDE ? (#1479) — les deux routes que `seatOwns`
 * distingue depuis toujours, NOMMÉES : un porteur de l'ENVIRONNEMENT (sentinelle `WORLD_STEP_OWNER` :
 * désertion, Moral, météo) et un ennemi du bac-à-sable MJ reviennent au `worldSeat` ; tout autre
 * porteur est ATTRIBUÉ à un siège par `net.ownership` (réservé aux héros).
 *
 * Un seul site pour cette route : `seatOwns` la consomme pour dire QUI possède, `rollSeam` pour dire
 * qui VOIT (un héros dont le siège est aussi le siège MJ — hôte-MJ solo — reste tenu par SON joueur,
 * il n'est pas « conduit par le monde »).
 */
export function conduitParLeSiegeDuMonde(s: GameState, combatantId: string | undefined): boolean {
  if (combatantId === WORLD_STEP_OWNER) return true;
  if (!combatantId) return false;
  const c = inBattleId(s.battle, combatantId);
  return !!c && c.kind === 'enemy' && s.net.gmSeat != null;
}

/** Le siège possède-t-il ce combattant ? (héros non attribué → hôte, siège 0). */
export function seatOwns(s: GameState, seat: number, combatantId: string | undefined): boolean {
  if (conduitParLeSiegeDuMonde(s, combatantId)) return seat === worldSeat(s);
  if (!combatantId) return seat === 0;
  return (s.net.ownership[combatantId] ?? 0) === seat;
}

/**
 * Le JET de ce combattant doit-il être SURFACÉ (fenêtre influençable) plutôt que roulé en silence ?
 * INVARIANT : un jet se surface dès qu'un siège humain QUELCONQUE possède son porteur — le pilote de
 * l'ADVERSAIRE n'entre pas dans la condition ; un porteur surfacé n'est JAMAIS roulé en silence.
 * SEAT-AGNOSTIQUE (≠ `pilotedByHuman`, qui décide de l'AFFORDANCE LOCALE) : le héros d'un AUTRE siège
 * surface aussi — c'est SON joueur qui roulera. Les gardes RAW restent au site appelant (Défense :
 * portée de mêlée, `rangedDefenseModes` — un tir sans mode de défense RAW reste NON OPPOSÉ, LDB 13
 * l.125 ; Contre-sort : éligibilité `counterspellCandidates`, LDB 46 l.156).
 * SOURCE UNIQUE du surfaçage RÉACTIF : Défense (#989) et Contre-sort (#1028).
 */
export function jetSurfaced(s: GameState, c: Combatant): boolean {
  if (c.kind === 'hero') return !c.aiControlled;
  if (c.kind === 'enemy') return s.net.gmSeat != null;
  return false;
}

/**
 * UN SIÈGE HUMAIN TIENT-IL CE PORTEUR ? (#1426) — LE prédicat de possession HUMAINE, keyé par ID, pour
 * TOUT porteur de dé : héros (en combat COMME hors combat), ennemi, et le MONDE (`WORLD_STEP_OWNER`).
 * C'est `jetSurfaced` ci-dessus, atteint par id plutôt que par objet ; le surfaçage d'un jet
 * (`rollSeam.surfaceOf`) n'y ajoute que la cadence.
 *
 * « TENU PAR UN HUMAIN » N'EST PAS « POSSÉDÉ » : `seatOwns(s, 0, ennemi)` rend vrai par REPLI quand
 * aucun siège MJ n'existe — ce repli sert l'ACTION (l'hôte exécute pour l'automate qui conduit cet
 * ennemi), pas la TENUE du dé. Un ennemi sans siège MJ, un héros `aiControlled`, un porteur inconnu
 * ne tiennent donc aucune fenêtre : leur étape se résout d'office et se montre au bilan.
 * Le MONDE fait exception par construction : `worldSeat` existe TOUJOURS et est humain — la
 * résolution de ce siège reste ici (`seatOwns` route déjà la sentinelle vers lui), jamais recopiée
 * chez un appelant.
 */
export function tenuParUnHumain(s: GameState, porteurId: string | undefined): boolean {
  if (!porteurId) return false;
  if (porteurId === WORLD_STEP_OWNER) return seatOwns(s, worldSeat(s), porteurId);
  const c = porteurParId(s, porteurId);
  return !!c && jetSurfaced(s, c);
}
