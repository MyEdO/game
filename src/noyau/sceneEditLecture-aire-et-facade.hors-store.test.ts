/**
 * Deux lectures de l'éditeur (`sceneEditLecture.ts`), contrats déclarés : `effectZoneArea` (un disque prend le centre de
 * la boîte et le rayon qui y tient ; aller-retour réversible sur une boîte carrée impaire) et `pickArchitectureEdge` (le
 * pan de façade posé sur l'arête la plus proche du point, à l'étage visé). Scène FABRIQUÉE.
 */
import { describe, it, expect } from 'vitest';
import { effectZoneArea, pickArchitectureEdge } from './sceneEditLecture';
import { addArchitectureBody, addFacadeSection } from './sceneEdit';
import { emptyScene } from './monde/scene';

describe('effectZoneArea', () => {
  it('rect : la boîte telle quelle', () => {
    expect(effectZoneArea('rect', { x: 1, y: 2, w: 3, h: 4 })).toEqual({ kind: 'rect', x: 1, y: 2, w: 3, h: 4 });
  });

  it('disque : le centre de la boîte et le rayon qui y tient', () => {
    expect(effectZoneArea('disc', { x: 2, y: 2, w: 5, h: 5 })).toEqual({ kind: 'disc', cx: 4, cy: 4, radius: 2 });
    expect(effectZoneArea('disc', { x: 0, y: 0, w: 4, h: 2 })).toEqual({ kind: 'disc', cx: 2, cy: 1, radius: 1 });
    expect(effectZoneArea('disc', { x: 3, y: 3, w: 1, h: 1 })).toEqual({ kind: 'disc', cx: 3, cy: 3, radius: 0 });
  });

  it('aller-retour rect → disque → rect réversible sur une boîte carrée impaire', () => {
    const boite = { x: 1, y: 1, w: 5, h: 5 };
    const d = effectZoneArea('disc', boite);
    if (d.kind !== 'disc') throw new Error('disque attendu');
    expect({ x: d.cx - d.radius, y: d.cy - d.radius, w: 2 * d.radius + 1, h: 2 * d.radius + 1 }).toEqual(boite);
  });
});

describe('pickArchitectureEdge', () => {
  const avecFacade = () => {
    const corps = addArchitectureBody(emptyScene('archi', 8, 8), undefined, { x: 2, y: 2, w: 3, h: 3 });
    const f = addFacadeSection(corps.scene, corps.id, { x: 2, y: 2, side: 'N' })!;
    return { scene: f.scene, bodyId: corps.id, id: f.id };
  };

  it('près de l’arête qui porte un pan : ce pan, et son corps', () => {
    const { scene, bodyId, id } = avecFacade();
    expect(pickArchitectureEdge(scene, 2, 1.6, 0)).toEqual({ type: 'facadeSection', bodyId, id });
  });

  it('loin de toute arête, sur une arête nue, ou à un autre étage : rien', () => {
    const { scene } = avecFacade();
    expect(pickArchitectureEdge(scene, 2, 2, 0)).toBeNull();
    expect(pickArchitectureEdge(scene, 3, 1.6, 0)).toBeNull();
    expect(pickArchitectureEdge(scene, 2, 1.6, 1)).toBeNull();
  });
});
