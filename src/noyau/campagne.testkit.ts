import type { CampagneLancee } from './persistance/bibliotheque';
import type { Get } from './flowTypes';
import { lancementDuProjet, poserLeLancement } from './lancementDeScenario';
import { refusDeLancer } from './partyFlow';

/** POSE la campagne lancée `lancee` (`campagneDuJeu`) par le groupe en place, sur les primitives que joue le pont d'un
 *  hôte (`lancer`) : le refus du groupe (`refusDeLancer`), puis le lancement du projet (`lancementDuProjet`) posé sans
 *  démarrage (`poserLeLancement`) ; `sceneId` remplace sa scène d'entrée. Rend le refus du groupe, `null` quand la
 *  campagne est posée. */
export function poserLaCampagne(get: Get, lancee: CampagneLancee, sceneId: string = lancee.startSceneId): string | null {
  const refus = refusDeLancer(get());
  if (refus) return refus;
  poserLeLancement(get, lancementDuProjet(lancee, get().party, sceneId, lancee.projet));
  return null;
}
