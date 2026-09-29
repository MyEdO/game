import { describe, it, expect, beforeEach } from 'vitest';
import { scenario } from './opera-galerie';
import { scenario as plan } from './opera-plan';
import { useGame } from '../../state/store';
import { isWalkable, tileAt } from '../../state/scene';
import { walkNeighbors } from '../../state/path';
import { paintTiles } from '../../state/sceneEdit';
import { areteEntre } from '../../geometry/arete';

/** #1883 — le scénario lancé par le chemin de `TestScenariosScreen` (`setParty` puis `startScene`). */
describe('scénario opera-galerie — le groupe démarre sur la galerie, au bord du puits (#1883)', () => {
  beforeEach(() => {
    useGame.getState().setParty(scenario.makeParty());
    useGame.getState().startScene(scenario.scene);
  });

  it("startScene pose le groupe à l'étage : partyPos.z === 1", () => {
    expect(useGame.getState().partyPos.z).toBe(1);
  });

  it('le groupe est sur une case marchable de la galerie', () => {
    const { scene, partyPos } = useGame.getState();
    expect(isWalkable(scene!, partyPos.x, partyPos.y, 1)).toBe(true);
  });

  it('la case du groupe touche une arête de garde-corps', () => {
    const { scene, partyPos } = useGame.getState();
    const gardeCorps = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => {
      const e = areteEntre(partyPos.x, partyPos.y, partyPos.x + dx, partyPos.y + dy)!;
      return (scene!.walls ?? []).some((w) => w.x === e.x && w.y === e.y && w.side === e.side && w.z === 1 && w.structure === 'garde-corps');
    });
    expect(gardeCorps.length).toBeGreaterThan(0);
  });

  it("aucun pas depuis le départ ne mène dans le puits — ni sur son vide (z1), ni en descente au parterre (z0)", () => {
    const { scene, partyPos } = useGame.getState();
    const dansLePuits = (p: { x: number; y: number }) => tileAt(plan.scene, p.x, p.y, 1) === 'vide';
    expect(dansLePuits({ x: partyPos.x + 1, y: partyPos.y })).toBe(true);
    expect(walkNeighbors(scene!, partyPos).filter(dansLePuits)).toEqual([]);
  });

  it('le garde-corps ferme la rive : puits dallé au pied du départ, le pas reste barré', () => {
    const { scene, partyPos } = useGame.getState();
    const puits = { x: partyPos.x + 1, y: partyPos.y, z: 1 };
    const dalle = paintTiles(scene!, puits, 'dalle', 1, 1);
    expect(isWalkable(dalle, puits.x, puits.y, 1)).toBe(true);
    expect(walkNeighbors(dalle, partyPos)).not.toContainEqual(puits);
  });
});
