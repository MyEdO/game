/**
 * LE CONTENU D'UN JEU (#4936) : ce que le point d'entrée d'un projet remet à l'affichage qui l'ouvre, à la création de
 * son pont ou de son hôte (plan `docs/plans/2026-11-24-restructuration-multi-projets.md`, H3) : ses campagnes, et ses
 * scénarios de test, joués avec le catalogue commun (`catalogueDeLaPartie`).
 */
import type { BuiltinCampaign } from '../noyau/index';
import type { TestScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios';

/** Les campagnes et les scénarios de test qu'un jeu remet à l'affichage. */
export interface ContenuDUnJeu {
  readonly campagnes: readonly BuiltinCampaign[];
  readonly scenarios: readonly TestScenario[];
}

/** Le catalogue des scénarios d'une partie : le catalogue commun (`testScenarios`), puis les scénarios `scenarios` que
 *  le jeu remet ; un id porté deux fois lève. */
export function catalogueDeLaPartie(scenarios: ContenuDUnJeu['scenarios']): readonly TestScenario[] {
  const catalogue = [...testScenarios, ...scenarios];
  const vus = new Set<string>();
  for (const { id } of catalogue) {
    if (vus.has(id)) throw new Error(`scénario remis : l’id ${id} est déjà au catalogue des scénarios`);
    vus.add(id);
  }
  return catalogue;
}
