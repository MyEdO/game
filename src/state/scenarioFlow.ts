/**
 * Lancement d'un scénario de test (`src/scenes/test-scenarios`) : l'UNIQUE séquence, jouée par le menu
 * (`src/ui/TestScenariosScreen.tsx`) et par `__wfrp.scenario` (`src/state/devtools.ts`).
 */
import { setRule } from '../engine/policy';
import type { ScenarioConstruit, TestScenario } from '../scenes/test-scenarios/_shared';
import { creditBourse } from './bourseFlow';
import type { Get, Set } from './flowTypes';

/** POSE du scénario : règles, `construire` sur les datasets vivants, groupe, projet ou scène. Rend le
 *  contenu construit. */
export function poserScenario(get: Get, sc: TestScenario): ScenarioConstruit {
  if (sc.rules) for (const [id, v] of Object.entries(sc.rules)) setRule(id, v);
  const c = sc.construire();
  get().setParty(c.party);
  if (c.extraScenes?.length || c.worldMap || c.narratif) get().loadProject([c.scene, ...(c.extraScenes ?? [])], c.scene.id, c.worldMap ?? null, c.narratif);
  else get().startScene(c.scene);
  return c;
}

/** DÉMARRAGE du scénario posé (`poserScenario`) : bourse, navire, combat direct, interlude (ADE II 8
 *  l.65) puis bataille de masse, sinon écran de campagne. */
export function demarrerScenario(get: Get, set: Set, sc: TestScenario, c: ScenarioConstruit): void {
  // Bourse et navire APRÈS le reset que pose le chargement de la scène.
  const lead = get().party[0];
  if (sc.money && lead) creditBourse(get, set, lead.id, sc.money);
  if (c.vessel) set({ vessel: c.vessel });
  if (sc.autoCombat) get().startCombat(sc.autoCombat);
  if (c.massBattle) {
    if (sc.interludeWeeks) get().startInterlude(sc.interludeWeeks);
    get().startMassBattle(c.massBattle);
  } else get().setScreen('campaign');
}

/** Lancement complet : `poserScenario` puis `demarrerScenario`. */
export function lancerScenario(get: Get, set: Set, sc: TestScenario): void {
  demarrerScenario(get, set, sc, poserScenario(get, sc));
}
