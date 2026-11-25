import { idsDeTest } from '../engine/idsDeTest.testkit';
import { it, expect } from 'vitest';
import { testScenarios } from './test-scenarios';
import { paquetDuJeu } from '../noyau/campagneLivree';
import { campagneDeTest } from './fixtures/contenuDuCommun';
import { partagesDesFiches, type LotDeScenes } from './fichesSansPartage.testkit';

// #2097 — les scénarios de test et la campagne de test du commun ; un projet joue ses campagnes dans sa suite.
const paquet = paquetDuJeu(campagneDeTest);
const lots: LotDeScenes[] = [
  ...testScenarios.map((s) => {
    const b = s.construire(idsDeTest);
    return { nom: `scénario ${s.id}`, scenes: [b.scene, ...(b.extraScenes ?? [])], narratif: b.narratif ?? null };
  }),
  { nom: `campagne ${campagneDeTest.id}`, scenes: paquet.scenes, narratif: paquet.narratif ?? null },
];

it('aucun combattant né d’une scène n’atteint la scène mémorisée ni le catalogue (#2097)', () => {
  const { fiches, fautes } = partagesDesFiches(lots);
  expect(fiches).toBeGreaterThan(0);
  expect(fautes).toEqual([]);
});
