/**
 * Setup de la suite du NOYAU (`vitest.noyau.config.ts`, #2817, #3058) : ce que l'ouverture d'un propriétaire du jeu
 * (`ouvrirLeProprietaire`, graine, règles, cadence, dés fixés, séquences) ne remet pas, une fois pour la suite. Le gel
 * du catalogue au chargement (#2097) ; avant chaque test, le drapeau de ré-entrance `onOwnTestFailed` ; après chaque
 * test, la garde de partage (#2097) sur l'état du propriétaire branché (`jeuBranche`), lue avant le vidage du registre
 * des scènes, puis ce vidage. Les `afterEach` jouent avant les `onTestFinished` : le banc qui ferme à la fin de son test
 * (`src/noyau/banc.testkit.ts`) est encore branché ici. Après chaque FICHIER, le propriétaire qu'il a laissé branché se
 * débranche : le graphe est partagé par worker (`isolate: false`, `vitest.noyau.config.ts`), et un fichier dont les
 * tests jouent une même partie (le pont, `hotes/godot/pont/`) la tient jusqu'à son dernier test. Aucun module du store
 * n'est chargé.
 */
import { afterAll, afterEach, beforeEach } from 'vitest';
import './data/overrides';
import { debrancherLeJeu, jeuBranche } from './noyau/branchement';
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

afterAll(debrancherLeJeu);
