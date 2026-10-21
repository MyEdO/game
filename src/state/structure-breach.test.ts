import { describe, it, expect } from 'vitest';
import {
  emptyScene,
  wallBetween,
  wallIsOpen,
  structureAt,
  structureIsDown,
  setStructureDown,
  setDoorOpen,
  type Scene,
  type WallSeg,
} from '../noyau/monde/scene';
import { reachable } from '../noyau/monde/path';
import { computeVisible, computeLightField } from '../noyau/monde/vision';
import { findStructureById } from '../data';

/** Id RÉEL du catalogue `structures.json` (porte de ville : BE 10 / B 30, Atout Impénétrable). */
const STRUCT_ID = 'porte-de-ville';

/** Scène 3×1 (cases (0,0)(1,0)(2,0)) avec une arête sur le E de (0,0) — séparant (0,0) de (1,0). Le
 *  contenu de l'arête (structure intacte / porte) est passé par l'appelant. */
function sceneWithEdge(seg: WallSeg): Scene {
  return { ...emptyScene('scene-test', 3, 1), walls: [seg] };
}

/** Un viewer à (0,0) voit-il (1,0) ? Scène pleinement éclairée (ambient 1) → seule l'occlusion d'arête
 *  peut couper la Ligne de Vue, ce que ce test isole. */
function sees(scene: Scene): boolean {
  const light = computeLightField(scene, 1, []);
  const vis = computeVisible(scene, [{ pos: { x: 0, y: 0 }, radiusTiles: 10, darkTiles: 0 }], light);
  return vis.has('1,0,0'); // computeVisible encode toujours z (≠ clés BFS qui omettent z=0)
}

/** (1,0) est-il atteignable au BFS depuis (0,0) ? (preuve observable du contenu de `wallEdges`). */
function bfsReaches(scene: Scene): boolean {
  return reachable(scene, { x: 0, y: 0 }, 5, { blocked: new Set() }).has('1,0');
}

describe('brèche de structure sur arête de mur', () => {
  it('utilise un id de structure réel du catalogue', () => {
    expect(findStructureById(STRUCT_ID)).toBeTruthy();
  });

  it('structure INTACTE : bloque passage, vue et planification BFS', () => {
    const scene = sceneWithEdge({ x: 0, y: 0, side: 'E', structure: STRUCT_ID });
    const seg = structureAt(scene, 0, 0, 'E', 0)!;
    expect(seg).toBeTruthy();
    expect(structureIsDown(scene, seg)).toBe(false); // neuve = intacte (aucun flag)
    expect(wallIsOpen(scene, seg)).toBe(false);
    expect(wallBetween(scene, 0, 0, 1, 0)).toBe(true); // passage bloqué
    expect(sees(scene)).toBe(false); // LdV coupée (arête opaque)
    expect(bfsReaches(scene)).toBe(false); // BFS bloqué (arête barrière)
  });

  it('structure ABATTUE : brèche franchissable et transparente', () => {
    const base = sceneWithEdge({ x: 0, y: 0, side: 'E', structure: STRUCT_ID });
    const scene = setStructureDown(base, 0, 0, 'E', 0, true);
    const seg = structureAt(scene, 0, 0, 'E', 0)!;
    expect(structureIsDown(scene, seg)).toBe(true);
    expect(wallIsOpen(scene, seg)).toBe(true);
    expect(wallBetween(scene, 0, 0, 1, 0)).toBe(false); // passage rouvert
    expect(sees(scene)).toBe(true); // vue rétablie à travers la brèche
    expect(bfsReaches(scene)).toBe(true); // BFS rouvert
  });

  it('setStructureDown est un no-op sur une arête sans structure', () => {
    const scene = sceneWithEdge({ x: 0, y: 0, side: 'E' }); // mur plein
    expect(setStructureDown(scene, 0, 0, 'E', 0, true)).toBe(scene); // même réf
  });

  it('porte pure : bloque le BFS fermée et le rouvre à son ouverture runtime', () => {
    const scene = sceneWithEdge({ x: 0, y: 0, side: 'E', door: true, closed: true });
    expect(bfsReaches(scene)).toBe(false);
    expect(wallBetween(scene, 0, 0, 1, 0)).toBe(true);
    const opened = setDoorOpen(scene, 0, 0, 'E', 0, true);
    expect(bfsReaches(opened)).toBe(true);
    expect(wallBetween(opened, 0, 0, 1, 0)).toBe(false);
  });

  it('porte portant une structure : bloque le BFS intacte et le rouvre une fois abattue', () => {
    const intact = sceneWithEdge({ x: 0, y: 0, side: 'E', door: true, closed: true, structure: STRUCT_ID });
    expect(bfsReaches(intact)).toBe(false);
    expect(wallBetween(intact, 0, 0, 1, 0)).toBe(true);
    const breached = setStructureDown(intact, 0, 0, 'E', 0, true);
    expect(bfsReaches(breached)).toBe(true);
    expect(wallBetween(breached, 0, 0, 1, 0)).toBe(false);
  });

  it('porte portant une structure INTACTE : ouverte (runtime), elle franchit le BFS SANS attendre la brèche (#830 régression)', () => {
    const scene = sceneWithEdge({ x: 0, y: 0, side: 'E', door: true, closed: true, structure: STRUCT_ID });
    const seg = structureAt(scene, 0, 0, 'E', 0)!;
    expect(structureIsDown(scene, seg)).toBe(false); // structure toujours intacte
    expect(bfsReaches(scene)).toBe(false); // fermée : bloque
    const opened = setDoorOpen(scene, 0, 0, 'E', 0, true);
    expect(structureIsDown(opened, seg)).toBe(false); // aucune brèche n'a été faite
    expect(wallIsOpen(opened, seg)).toBe(true); // la porte, pas la structure, tranche
    expect(bfsReaches(opened)).toBe(true); // franchissable en la poussant, matériau ou pas
    expect(wallBetween(opened, 0, 0, 1, 0)).toBe(false);
  });

  it('mur SANS porte portant une structure intacte : reste une barrière (mur/rempart destructible, non affecté)', () => {
    const scene = sceneWithEdge({ x: 0, y: 0, side: 'E', structure: STRUCT_ID });
    expect(bfsReaches(scene)).toBe(false);
  });
});
