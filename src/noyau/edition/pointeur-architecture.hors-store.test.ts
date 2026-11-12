/**
 * L'appui de l'outil de sélection en mode ARCHITECTURE (`selectionner`, `pointeur.ts`) : contrat déclaré, un pan de
 * façade sous le point se désigne ; en action « façade », l'arête visée reçoit un pan neuf, d'un cran ; les deux
 * finissent le geste d'architecture. Scène FABRIQUÉE.
 */
import { describe, it, expect } from 'vitest';
import { appuyer, type ContexteDuPointeur, type PointDeCarte } from './pointeur';
import { addArchitectureBody, addFacadeSection } from '../sceneEdit';
import { emptyScene } from '../monde/scene';
import type { Layers } from '../sceneEditLecture';

const TOUT: Layers = { triggers: true, spawns: true, roofs: true, entries: true, rest: true, zones: true };
const ctx = (architecture: ContexteDuPointeur['architecture']): ContexteDuPointeur => ({
  tool: { mode: 'selection' }, z: 0, brush: 1, encId: '', encRef: 'mutant', layers: TOUT, sel: null, terrainRect: false, architecture,
});
const au = (x: number, y: number, f: { x: number; y: number }): PointDeCarte => ({ case: { x, y }, f });

const corps = () => addArchitectureBody(emptyScene('archi', 8, 8), undefined, { x: 2, y: 2, w: 3, h: 3 });

describe('pointeur — sélection en mode architecture', () => {
  it('un pan de façade sous le point se désigne, sans écrire la scène', () => {
    const c = corps();
    const f = addFacadeSection(c.scene, c.id, { x: 2, y: 2, side: 'N' })!;
    const e = appuyer(f.scene, ctx({ z: 0, action: 'selection', bodyId: c.id }), au(2, 2, { x: 2, y: 1.6 }));
    expect(e).toEqual({ geste: null, sel: { type: 'facadeSection', bodyId: c.id, id: f.id }, architectureFinie: true });
  });

  it('action « façade » sur une arête nue : un pan neuf y naît, d’un cran, et se désigne', () => {
    const c = corps();
    const e = appuyer(c.scene, ctx({ z: 0, action: 'facade', bodyId: c.id }), au(3, 2, { x: 3, y: 1.6 }));
    expect(e.cran).toBe(true);
    expect(e.architectureFinie).toBe(true);
    const pans = e.scene!.architecture!.find((b) => b.id === c.id)!.facades;
    expect(pans).toHaveLength(1);
    expect(e.sel).toEqual({ type: 'facadeSection', bodyId: c.id, id: pans[0].id });
  });
});
