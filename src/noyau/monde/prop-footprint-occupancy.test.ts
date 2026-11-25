import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { paquetDuJeu } from '../campagneLivree';
import { campagneDeTest } from '../../scenes/fixtures/contenuDuCommun';
import { testScenarios } from '../../scenes/test-scenarios';
import type { Scene } from './scene';
import { occupantsDansUnDecor } from './occupantsDansUnDecor.testkit';

/** Les scènes du commun : la campagne de test et les scénarios de test ; un projet balaie les siennes dans sa suite. */
const scenesDuCommun = (): { source: string; scene: Scene }[] => [
  ...paquetDuJeu(campagneDeTest).scenes.map((scene) => ({ source: campagneDeTest.id, scene })),
  ...testScenarios.map((s) => ({ source: `test-scenarios/${s.id}`, scene: s.construire(idsDeTest).scene })),
];

describe('empreinte de TYPE — aucun corps ne naît dans un décor (scènes du commun)', () => {
  const scenes = scenesDuCommun();

  it('le balayage porte sur la campagne de test et les scénarios de test', () => {
    expect(scenes.some((s) => s.source === campagneDeTest.id)).toBe(true);
    expect(scenes.some((s) => s.source === 'test-scenarios/embuscade')).toBe(true);
  });

  it('aucune entité NON-prop ne se tient sur une case couverte par l’empreinte d’un prop', () => {
    expect(scenes.flatMap(({ source, scene }) => occupantsDansUnDecor(source, scene))).toEqual([]);
  });

  it('le balayage MORD : un corps posé dans l’empreinte d’un décor est rapporté', () => {
    const scene = {
      id: 'sonde',
      entities: [
        { id: 'epave', kind: 'prop', pos: { x: 4, y: 4 }, decor: { id: 'epave-carrosse' } }, // 2×2 : (4,4)…(5,5)
        { id: 'garde', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 5, y: 5 } },
        { id: 'passant', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 6, y: 5 } },
      ],
    } as unknown as Scene;
    expect(occupantsDansUnDecor('sonde', scene)).toEqual(['sonde/sonde/garde sur (5,5,0) — epave-carrosse (epave)']);
  });
});
