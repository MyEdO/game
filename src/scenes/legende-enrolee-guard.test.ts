/**
 * GARDE — une entité ENRÔLÉE dans une rencontre porte un NOM, jamais une légende (#1882).
 *
 * QUESTION : le `label` d'un personnage membre d'une rencontre est-il le nom du combattant, ou une
 * légende d'authoring (« Gobelin de la stalle voisine », « Guetteur du corps de garde ») qui s'affiche en combat,
 * au journal et au jet comme si c'était son nom ? C'est son NOM : le label d'entité gagne sur la fiche
 * (`noyau/monde/sceneNpc.ts › fiche`). Une légende va dans un commentaire, jamais dans le `label`.
 * Détecteur : `legendeEnrolee.testkit.ts`. Ici, les scénarios de test et le contenu du commun ; un projet joue
 * ses paquets dans sa suite, avec ses exemptions au SITE.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { parseProject } from '../noyau/worldMap';
import paquetDeTest from './fixtures/paquet-de-test.json';
import { testScenarios } from './test-scenarios';
import { enroles, legendesPourNom, type PaquetDeScenes } from './legendeEnrolee.testkit';

const PAQUETS: PaquetDeScenes[] = [
  ...testScenarios.map((s) => s.construire(idsDeTest)).map((c) => ({ scenes: [c.scene, ...(c.extraScenes ?? [])], narratif: c.narratif })),
  parseProject(paquetDeTest),
];

describe('legende-enrolee-guard (#1882)', () => {
  const vus = enroles(PAQUETS);

  it('aucune entité enrôlée ne porte une légende pour nom', () => {
    expect(legendesPourNom(vus, new Map()), 'donner un NOM au label (la légende va en commentaire)').toEqual([]);
  });

  it('PEUPLEMENT : le scan lit des entités enrôlées nommées', () => {
    expect(vus.length).toBeGreaterThan(0);
  });
});
