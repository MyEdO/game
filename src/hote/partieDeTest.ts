/**
 * LA PARTIE D'UN SCÉNARIO DE TEST DU CATALOGUE (`testScenarios`), que l'hôte texte et le pont Godot ouvrent par l'id
 * du scénario : son en-tête et son ouverture sur `ouvrirLeLancement` (`partie.ts`). Le catalogue tire les projets de
 * campagne (`src/scenes/campaign.ts`) : un hôte qui lance ses propres combats n'importe que `partie.ts` (#4836).
 */
import { ErreurDeGeste, nouvellesEntrees, ouvrirLeLancement, type EntreesDeLEntete, type PartieOuverte } from './partie';
import type { EntreesDeLaPartie } from '../noyau/index';
import { lancementDuScenario, type TestScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';

/** Le scénario de test `id` du catalogue (`testScenarios`), ou l'erreur de validation qui le refuse. */
export function scenarioDeTest(id: string): TestScenario {
  const scenario = testScenarios.find((s) => s.id === id);
  if (!scenario) throw new ErreurDeGeste('validation', `scénario inconnu : ${id}`);
  return scenario;
}

/** L'en-tête d'une partie : le scénario lancé et les entrées de la partie (D8). */
export interface Entete extends EntreesDeLEntete {
  scenario: string;
}

/** L'en-tête d'une partie neuve, ou l'erreur de validation qui le refuse (`nouvellesEntrees`). */
export function nouvelEntete(scenario: string, options: Parameters<typeof nouvellesEntrees>[0]): Entete {
  scenarioDeTest(scenario);
  return { scenario, ...nouvellesEntrees(options) };
}

/** Ouvre la partie de l'en-tête : son scénario lancé par le constructeur unique du lancement (`lancementDuScenario`,
 *  `ouvrirLeLancement`). */
export function ouvrirLaPartie(entete: Entete, persisterLeHeros: EntreesDeLaPartie['persisterLeHeros'], premierJeton = 0): PartieOuverte {
  const scenario = scenarioDeTest(entete.scenario);
  return ouvrirLeLancement(entete, (idNeuf) => lancementDuScenario(scenario, idNeuf), persisterLeHeros, premierJeton);
}
