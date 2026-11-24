/**
 * LA PARTIE D'UN SCÉNARIO DE TEST du catalogue de la partie (`catalogueDeLaPartie`, `contenu.ts`), que l'hôte texte et
 * le pont Godot ouvrent par l'id du scénario : son en-tête et son ouverture sur `ouvrirLeLancement` (`partie.ts`). Un
 * hôte qui lance ses propres combats n'importe que `partie.ts` (#4836).
 */
import { ErreurDeGeste, nouvellesEntrees, ouvrirLeLancement, type EntreesDeLEntete, type PartieOuverte } from './partie';
import type { EntreesDeLaPartie } from '../noyau/index';
import { lancementDuScenario, type TestScenario } from '../scenes/test-scenarios/_shared';

/** Le scénario de test `id` du catalogue `catalogue`, ou l'erreur de validation qui le refuse. */
export function scenarioDeTest(catalogue: readonly TestScenario[], id: string): TestScenario {
  const scenario = catalogue.find((s) => s.id === id);
  if (!scenario) throw new ErreurDeGeste('validation', `scénario inconnu : ${id}`);
  return scenario;
}

/** L'en-tête d'une partie : le scénario lancé et les entrées de la partie (D8). */
export interface Entete extends EntreesDeLEntete {
  scenario: string;
}

/** L'en-tête d'une partie neuve sur un scénario du catalogue `catalogue`, ou l'erreur de validation qui le refuse
 *  (`nouvellesEntrees`). */
export function nouvelEntete(catalogue: readonly TestScenario[], scenario: string, options: Parameters<typeof nouvellesEntrees>[0]): Entete {
  scenarioDeTest(catalogue, scenario);
  return { scenario, ...nouvellesEntrees(options) };
}

/** Ouvre la partie de l'en-tête : son scénario, pris au catalogue `catalogue`, lancé par le constructeur unique du
 *  lancement (`lancementDuScenario`, `ouvrirLeLancement`). */
export function ouvrirLaPartie(catalogue: readonly TestScenario[], entete: Entete, persisterLeHeros: EntreesDeLaPartie['persisterLeHeros'], premierJeton = 0): PartieOuverte {
  const scenario = scenarioDeTest(catalogue, entete.scenario);
  return ouvrirLeLancement(entete, (idNeuf) => lancementDuScenario(scenario, idNeuf), persisterLeHeros, premierJeton);
}
