/**
 * Lancement d'un scénario de test (`src/scenes/test-scenarios`) par le web : l'adaptateur de l'UNIQUE séquence
 * (`noyau/lancementDeScenario.ts`), jouée par le menu (`src/ui/TestScenariosScreen.tsx`) et par `__wfrp.scenario`
 * (`src/state/devtools.ts`), sur le lancement que construit `lancementDuScenario`.
 */
import { lancementDuScenario, type TestScenario } from '../scenes/test-scenarios/_shared';
import { lancerLeScenario, poserLeLancement, type LancementDeScenario } from '../noyau/lancementDeScenario';
import type { Get, Set } from '../noyau/flowTypes';

/** POSE du scénario (`poserLeLancement`) ; rend le lancement construit. */
export function poserScenario(get: Get, sc: TestScenario): LancementDeScenario {
  const lancement = lancementDuScenario(sc);
  poserLeLancement(get, lancement);
  return lancement;
}

/** Lancement complet (`lancerLeScenario`). */
export function lancerScenario(get: Get, set: Set, sc: TestScenario): void {
  lancerLeScenario(get, set, lancementDuScenario(sc));
}
