/**
 * Couture STORE ↔ salon coop (`hote/coop/salon.ts`) — module `(get,set)` comme combatFlow : les ports de la page
 * (`hote/coop/page.ts`) composés avec la minuterie tracée, la panne au journal de la console et l'abonnement zustand,
 * et l'application d'un instantané au store.
 */
import type { RemplacerLEtat } from './store';
import { remettreLAdaptateur, useGame } from './store';
import { appliquerLInstantane } from '../noyau/coop';
import { creerLeSalon } from '../hote/coop/salon';
import { portsDeLaPage } from '../hote/coop/page';
import { bus, EVT } from '../noyau/bus';
import { scheduleFlowTimer, clearTrackedTimer } from '../web/minuteries';

/** Le salon de l'hôte web, ses ports branchés. */
export const salon = creerLeSalon({
  ...portsDeLaPage(),
  minuterie: {
    programmer: (suite, delai) => {
      const id = scheduleFlowTimer(suite, delai);
      return () => clearTrackedTimer(id);
    },
  },
  panne: (erreur) => console.error(erreur),
  abonner: (ecouteur) => useGame.subscribe(ecouteur),
});

/** L'invité applique un snapshot (`appliquerLInstantane`). Son interface se remet comme chez l'hôte
 *  (`remettreLAdaptateur`) quand la scène ou la partie change. */
export function applyNetSnapshot(set: RemplacerLEtat, data: Record<string, unknown>): void {
  const mine = useGame.getState();
  const { etat, neuve, autreScene } = appliquerLInstantane(data, mine);
  if (neuve || autreScene) remettreLAdaptateur(neuve);
  set(etat);
  bus.emit(EVT.SCENE_DIRTY);
}
