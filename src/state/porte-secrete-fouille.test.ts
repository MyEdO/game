import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import type { Scene } from '../noyau/monde/scene';
import { buildScene, type WallSpec } from '../noyau/mapSpec';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { fouilleOuverte } from '../noyau/interactionsDExploration';
import { bindingParId } from './clavier/keybindings';

/**
 * FOUILLER LA PIÈCE (#700) — second déclencheur de la découverte d'une porte secrète : `EDO 08 l.404`,
 * `LDB 12 l.189`, `LDB 12 l.200`, côté web : la touche R s'offre là où le verbe ouvre la fouille. Le verbe se joue au
 * banc du noyau (`src/noyau/porte-secrete-fouille.hors-store.test.ts`).
 */

/** 10×5 de plain-pied ; pièce intérieure `cave` = colonnes 0..5 ; cloison E de x=5.
 *   A = porte E de (5,2), face porteuse (dans la pièce), Complexe */
const PLAN = [
  '..........',
  '..........',
  '..........',
  '..........',
  '..........',
].join('\n');
type Porte = WallSpec & { secret: { difficulty: string; face: 'porteuse' | 'voisine' | 'les-deux' } };
const A: Porte = { x: 5, y: 2, side: 'E', door: true, secret: { difficulty: 'complexe', face: 'porteuse' } };

function plan(portes: Porte[]): Scene {
  const pleines: WallSpec[] = [0, 1, 2, 3, 4].filter((y) => !portes.some((p) => p.y === y)).map((y) => ({ x: 5, y, side: 'E' }));
  const s = buildScene({
    id: 'cave', label: 'Cave', size: [10, 5], terrain: 'pierre', ambiance: 'interieur', levels: { z0: PLAN },
    walls: [...pleines, ...portes] as WallSpec[],
  });
  s.effectZones = [{ id: 'cave', label: 'Cave', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 6, h: 5 }, z: 0 }];
  return s;
}

/** Deux héros formés en Perception (le Soutien l'exige, `LDB 12 l.195`). */
const heros = () => ['A', 'B'].map((label, i) => {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: i + 1 });
  return { ...h, skills: [...h.skills.filter((s) => s.id !== 'perception'), { id: 'perception', characteristic: 'initiative' as const, advances: 5 }] };
});

function explorer(scene: Scene, pos: { x: number; y: number }) {
  useGame.setState({ party: heros() });
  useGame.getState().lancerLaScene(scene);
  useGame.setState({ partyPos: pos, lightLevel: 1, dialogue: null });
}

describe('Fouiller la pièce — le second déclencheur de la découverte', () => {
  it('la touche R s’offre exactement là où le verbe ouvre la fouille (`fouilleOuverte`)', () => {
    const touche = bindingParId('fouiller-piece')!;
    explorer(plan([A]), { x: 1, y: 2 });
    useGame.setState({ screen: 'campaign' });
    expect(fouilleOuverte(useGame.getState())).toMatchObject({ piece: { id: 'cave' } });
    expect(touche.when(useGame.getState()), 'dans la pièce').toBe(true);
    useGame.setState({ partyPos: { x: 8, y: 2 } });
    expect(fouilleOuverte(useGame.getState())).toEqual({ refus: 'fouille.refus.horsPiece', vars: {} });
    expect(touche.when(useGame.getState()), 'hors de toute pièce').toBe(false);
    useGame.setState({ partyPos: { x: 1, y: 2 }, dialogue: { entityId: 'x', nodeId: 'n' } as never });
    expect(fouilleOuverte(useGame.getState())).toMatchObject({ refus: 'geste.refus.dialogue' });
    expect(touche.when(useGame.getState()), 'en dialogue').toBe(false);
  });
});
