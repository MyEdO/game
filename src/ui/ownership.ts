/**
 * POSSESSION LOCALE VUE DE L'UI (#1262 L1) — les VUES de fenêtre (hooks, état
 * réseau en prop) du prédicat `noyau/netOwnership.ownsLocal`, couture unique du routage
 * siège→combattant (même table de vérité que la validation d'intent chez l'hôte — afficher et agir
 * ne peuvent pas répondre différemment). Aucune ne DÉCIDE : chacune DÉLÈGUE à la couture.
 *
 * Aucun terme `net.mode === 'local'` devant l'appel : `ownsLocal` rend déjà `true` en solo pour TOUT
 * combattant (`netOwnership.ts`, branche `mode === 'local'` ; asserté par `netOwnership.test.ts`).
 */
import { useGame } from '../state/store';
import type { GameState } from '../state/store';
import { ownsLocal, ownsGroupDecision } from '../noyau/netOwnership';

/**
 * Vue LIVE du prédicat pour une fenêtre : s'ABONNE au siège (`net` — prise/relâche du rôle MJ,
 * attribution d'un héros re-rendent la fenêtre) et lit l'état FRAIS à chaque appel (une rangée
 * interroge la possession pendant le rendu, après des `set` du même geste). Hook : à appeler
 * INCONDITIONNELLEMENT, avant tout retour anticipé.
 */
export function useOwns(): (combatantId: string | undefined) => boolean {
  useGame((s) => s.net);
  return (id) => ownsLocal(useGame.getState(), id);
}

/** Vue LIVE de `noyau/netOwnership.ownsGroupDecision` pour une fenêtre (même abonnement que `useOwns`). */
export function useOwnsGroupDecision(): boolean {
  useGame((s) => s.net);
  return ownsGroupDecision(useGame.getState());
}

/** Vue RÉSEAU minimale : ce que le prédicat consulte quand aucun combat n'est ouvert. */
export type NetView = Pick<GameState['net'], 'mode' | 'mySeat' | 'ownership'> & { gmSeat?: number };

/**
 * Même prédicat, pour un écran HORS COMBAT piloté par son état réseau EN PROP (Interlude : rendu en
 * SSR par un seam de test, sans store). L'état réduit couvre EXACTEMENT ce que le
 * routage lit alors : `seatOwns` (sieges) consulte `net.ownership`, `net.gmSeat` et `battle` —
 * et sa branche `gmSeat` ne concerne QUE les combattants `kind:'ennemi'` PRÉSENTS dans `battle`. Sans
 * combat il n'y en a aucun : le verdict d'un HÉROS est son siège d'attribution, MJ ou pas.
 */
export function ownsLocalNet(net: NetView, combatantId: string | undefined): boolean {
  return ownsLocal({ net, battle: null } as unknown as GameState, combatantId);
}
