/**
 * LE CATALOGUE D'UNE PARTIE (`catalogueDeLaPartie`, #4936) : le catalogue commun, puis les scénarios que le jeu remet,
 * joués et listés comme les siens ; un id remis déjà au catalogue se refuse à la création.
 */
import { describe, expect, it } from 'vitest';
import { catalogueDeLaPartie } from './contenu';
import { nouvelEntete, ouvrirLaPartie, scenarioDeTest } from './partieDeTest';
import { zonesDesScenarios } from './scenarios';
import { ErreurDeGeste } from './partie';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import type { TestScenario } from '../scenes/test-scenarios/_shared';

const COMMUN = catalogueDeLaPartie([]);
const DOME = scenarioDeTest(COMMUN, 'dome');

/** Un scénario que le jeu remet : la fiche et la fabrique du dôme, sous un id et un titre propres. */
const REMIS: TestScenario = { ...DOME, id: 'remis-de-test', title: 'Scénario remis de test' };

describe('le catalogue d’une partie', () => {
  it('un id remis déjà au catalogue commun lève à la création', () => {
    expect(() => catalogueDeLaPartie([{ ...REMIS, id: DOME.id }])).toThrow(`l’id ${DOME.id} est déjà au catalogue`);
  });

  it('un scénario remis se joue par `ouvrirLaPartie`, absent du seul catalogue commun', () => {
    const catalogue = catalogueDeLaPartie([REMIS]);
    expect(() => nouvelEntete(COMMUN, REMIS.id, {})).toThrow(ErreurDeGeste);
    const { partie } = ouvrirLaPartie(catalogue, nouvelEntete(catalogue, REMIS.id, { graine: 7 }), () => {});
    try {
      expect(partie.etat().scene?.id, 'la scène du scénario remis').toBe(REMIS.construire(idsDeTest).scene.id);
      expect(partie.etat().battle, 'son combat d’entrée').toBeTruthy();
    } finally {
      partie.fermer();
    }
  });

  it('un scénario remis est listé par `zonesDesScenarios`, dans la section de sa catégorie', () => {
    const section = zonesDesScenarios(catalogueDeLaPartie([REMIS]))['scenarios.sections'].find((s) => s.id === `section/${REMIS.category}`);
    expect(section?.elements.map((e) => e.id)).toContain(REMIS.id);
  });
});
