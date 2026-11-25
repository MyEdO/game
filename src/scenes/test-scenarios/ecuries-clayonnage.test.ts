import { describe, it, expect } from 'vitest';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import type { Scene } from '../../noyau/monde/scene';
import { scenario } from './ecuries-clayonnage';
import { scenario as diligence } from './diligence';

const diligenceConstruit = diligence.construire(idsDeTest);
const scenarioConstruit = scenario.construire(idsDeTest);

/**
 * Le SCÉNARIO de recette, lui, ne se mesure que sur ce qu'il promet au menu : il arme son tireur, et
 * il travaille sur une COPIE de la carte de campagne (`structuredClone`) — aucune de ses retouches
 * ne remonte dans la scène partagée. Aucune case, aucun id de cette carte n'est nommé ici.
 */
describe('scénario de recette « écuries » — armement du tireur et non-contamination', () => {
  it('arme le tireur du groupe d’une arme à DISTANCE (l’arc en main, pas la fronde rangée)', () => {
    const tireur = scenario.construire(idsDeTest).party[0];
    expect(tireur.weapons.some((w) => w.type === 'distance')).toBe(true);
  });

  it('pose son groupe et ses ennemis SANS toucher la scène de campagne partagée', () => {
    const depart = (s: Scene) => s.entities.find((e) => e.kind === 'heroStart')!.pos;
    expect(scenarioConstruit.scene).not.toBe(diligenceConstruit.scene);
    expect(depart(scenarioConstruit.scene)).not.toEqual(depart(diligenceConstruit.scene));
    const posees = scenarioConstruit.scene.encounters.map((e) => e.id);
    expect(posees.length).toBeGreaterThan(0);
    expect(diligenceConstruit.scene.encounters.filter((e) => posees.includes(e.id))).toEqual([]);
  });
});
