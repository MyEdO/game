/**
 * Setup de la suite du NOYAU (`vitest.noyau.config.ts`, #2817, #3058) : ce que l'ouverture d'un propriétaire du jeu
 * (`ouvrirLeProprietaire`, graine, règles, cadence, dés fixés, séquences) ne remet pas, une fois pour la suite. Le gel
 * du catalogue au chargement (#2097) ; avant chaque test, le drapeau de ré-entrance `onOwnTestFailed` ; après chaque
 * test, la garde de partage (#2097) sur l'état du propriétaire branché (`jeuBranche`), lue avant le vidage du registre
 * des scènes, puis ce vidage. Les `afterEach` jouent avant les `onTestFinished` : le banc qui ferme à la fin de son test
 * (`src/noyau/banc.testkit.ts`) est encore branché ici. Aucun module du store n'est chargé.
 */
import { afterEach, beforeEach } from 'vitest';
import './data/overrides';
import { jeuBranche } from './noyau/branchement';
import { resetSceneRegistry, scenesDuRegistre } from './noyau/monde/registreDesScenes';
import { resetOwnTestFailedGuard } from './noyau/triggeredEffects';
import { messagePartage, partagesDeLEtat } from './scenes/partage.testkit';

beforeEach(() => {
  resetOwnTestFailedGuard();
});

afterEach(() => {
  const jeu = jeuBranche();
  const partages = jeu ? partagesDeLEtat(jeu.get(), scenesDuRegistre()) : [];
  resetSceneRegistry();
  const verdict = messagePartage(partages);
  if (verdict) throw new Error(verdict);
});
