import { describe, it, expect } from 'vitest';
import { emptyScene, structureAt, type WallSeg } from '../../state/scene';
import { wallBetween } from '../../state/scene';
import { edgeWallState, toggleEdgeWall, toggleDiagonalWall, paintHeight, nearestEdge, pickWallEdge, patchWall, deleteSel } from './editorState';
import { areteCanonique } from '../../geometry/arete';

/**
 * Outils éditeur MURS (arêtes + portes + diagonales) et HAUTEUR métrique (surface surélevée / fosse).
 * Mutations PURES — câblées au canvas par EditorCanvas. Les arêtes sont canonicalisées N/E (le S d'une
 * case = le N de la suivante) pour ne stocker chaque cloison qu'une fois. La HAUTEUR s'écrit en MÈTRES
 * dans `Layer.height` (porteuse : marchabilité/combat/chute) — plus d'escalier ni d'« élévation » 0-1.
 */
describe('editorState — outil MURS (arêtes)', () => {
  it('areteCanonique : S→N de la case du dessous, O→E de la case de gauche, N/E inchangés', () => {
    expect(areteCanonique(2, 3, 'N')).toEqual({ x: 2, y: 3, side: 'N' });
    expect(areteCanonique(2, 3, 'E')).toEqual({ x: 2, y: 3, side: 'E' });
    expect(areteCanonique(2, 3, 'S')).toEqual({ x: 2, y: 4, side: 'N' });
    expect(areteCanonique(2, 3, 'O')).toEqual({ x: 1, y: 3, side: 'E' });
  });

  it('toggle pose un mur sur l’arête, re-toggle l’enlève', () => {
    const s0 = emptyScene(5, 5);
    const s1 = toggleEdgeWall(s0, 2, 2, 'E', 0, 'wall');
    expect(edgeWallState(s1, 2, 2, 'E')).toBe('wall');
    expect(wallBetween(s1, 2, 2, 3, 2)).toBe(true); // bloque le passage E
    const s2 = toggleEdgeWall(s1, 2, 2, 'E', 0, 'wall');
    expect(edgeWallState(s2, 2, 2, 'E')).toBe('none');
    expect(s2.walls ?? []).toHaveLength(0);
  });

  it('le S d’une case et le N de la suivante désignent LA MÊME cloison (pas de doublon)', () => {
    const s = toggleEdgeWall(emptyScene(5, 5), 2, 2, 'S', 0, 'wall');
    expect(edgeWallState(s, 2, 3, 'N')).toBe('wall'); // même arête vue de l'autre case
    expect(s.walls).toHaveLength(1);
    expect(s.walls![0]).toMatchObject({ x: 2, y: 3, side: 'N' });
  });

  it('porte : pose une arête franchissable ; passe de mur→porte→rien', () => {
    let s = toggleEdgeWall(emptyScene(5, 5), 1, 1, 'E', 0, 'door');
    expect(edgeWallState(s, 1, 1, 'E')).toBe('door');
    expect(wallBetween(s, 1, 1, 2, 1)).toBe(false); // une porte laisse passer
    s = toggleEdgeWall(s, 1, 1, 'E', 0, 'wall'); // bascule vers mur plein (≠ want → set)
    expect(edgeWallState(s, 1, 1, 'E')).toBe('wall');
    s = toggleEdgeWall(s, 1, 1, 'E', 0, 'door'); // re-porte
    expect(edgeWallState(s, 1, 1, 'E')).toBe('door');
  });

  it('z>0 conservé sur la cloison ; z=0 omis (convention)', () => {
    const s = toggleEdgeWall(emptyScene(5, 5), 0, 0, 'E', 2, 'wall');
    expect(s.walls![0]).toEqual({ x: 0, y: 0, side: 'E', z: 2 });
    const g = toggleEdgeWall(emptyScene(5, 5), 0, 0, 'E', 0, 'wall');
    expect(g.walls![0]).toEqual({ x: 0, y: 0, side: 'E' }); // pas de z:0
  });
});

describe('editorState — outil MURS (diagonales)', () => {
  it('pose une diagonale \\ dans la case, re-toggle l’enlève', () => {
    const s = toggleDiagonalWall(emptyScene(5, 5), 3, 3, '\\', 0);
    expect(s.walls![0]).toMatchObject({ x: 3, y: 3, side: '\\' });
    expect(toggleDiagonalWall(s, 3, 3, '\\', 0).walls ?? []).toHaveLength(0);
  });
  it('basculer \\ → / remplace (une seule diagonale par case)', () => {
    let s = toggleDiagonalWall(emptyScene(5, 5), 3, 3, '\\', 0);
    s = toggleDiagonalWall(s, 3, 3, '/', 0);
    expect(s.walls).toHaveLength(1);
    expect(s.walls![0].side).toBe('/');
  });
});

describe('editorState — sélection + structure d’une arête-mur', () => {
  /** Scène 5×5 avec une cloison pleine sur l’arête E de (2,2). */
  const withWall = () => toggleEdgeWall(emptyScene(5, 5), 2, 2, 'E', 0, 'wall');

  it('pickWallEdge : renvoie l’arête canonique quand le pointeur est près d’un segment posé', () => {
    const s = withWall();
    expect(pickWallEdge(s, 2.4, 2.0, 0)).toEqual({ x: 2, y: 2, side: 'E' }); // près de l’arête E
    expect(pickWallEdge(s, 2.0, 2.0, 0)).toBeNull(); // plein centre → repli sur le picking de tuile
    expect(pickWallEdge(emptyScene(5, 5), 2.4, 2.0, 0)).toBeNull(); // aucune cloison ici
  });

  it('patchWall : assigne une structure (id réel du catalogue), puis la retire', () => {
    let s = patchWall(withWall(), 2, 2, 'E', 0, { structure: 'mur-en-pierre' });
    expect(structureAt(s, 2, 2, 'E', 0)?.structure).toBe('mur-en-pierre');
    s = patchWall(s, 2, 2, 'E', 0, { structure: undefined }); // « aucune »
    expect(structureAt(s, 2, 2, 'E', 0)).toBeUndefined();
    expect(s.walls![0]).toEqual({ x: 2, y: 2, side: 'E' }); // forme compacte restaurée (pas de structure vide)
  });

  it('patchWall : l’override visuel survit à la normalisation sans changer la structure', () => {
    const patch: Partial<WallSeg> = { appearance: 'cloison-basse-a-ossature-en-bois' };
    const s = patchWall(
      patchWall(withWall(), 2, 2, 'E', 0, { structure: 'mur-a-ossature-en-bois' }),
      2, 2, 'E', 0, patch,
    );
    expect(s.walls![0]).toEqual({
      x: 2, y: 2, side: 'E',
      structure: 'mur-a-ossature-en-bois',
      appearance: 'cloison-basse-a-ossature-en-bois',
    });
    expect(JSON.parse(JSON.stringify(s)).walls[0].appearance).toBe('cloison-basse-a-ossature-en-bois');
  });

  it('patchWall : Cloison ↔ Porte + closed, forme canonique compacte (pas de door:false / closed sans porte)', () => {
    let s = patchWall(withWall(), 2, 2, 'E', 0, { door: true, closed: true });
    expect(s.walls![0]).toEqual({ x: 2, y: 2, side: 'E', door: true, closed: true });
    s = patchWall(s, 2, 2, 'E', 0, { door: undefined, closed: undefined }); // retour cloison pleine
    expect(s.walls![0]).toEqual({ x: 2, y: 2, side: 'E' });
  });

  it('patchWall : assigne un climb (LDB 15 l.53-57), survit à la normalisation (#505)', () => {
    let s = patchWall(withWall(), 2, 2, 'E', 0, { climb: { kind: 'surface', difficulty: 'difficile' } });
    expect(s.walls![0]).toEqual({ x: 2, y: 2, side: 'E', climb: { kind: 'surface', difficulty: 'difficile' } });
    s = patchWall(s, 2, 2, 'E', 0, { climb: undefined });
    expect(s.walls![0]).toEqual({ x: 2, y: 2, side: 'E' });
  });

  it('deleteSel : retire l’arête-mur sélectionnée', () => {
    const s = deleteSel(withWall(), { type: 'wall', x: 2, y: 2, side: 'E', z: 0 });
    expect(s.walls ?? []).toHaveLength(0);
  });
});

describe('editorState — outil HAUTEUR (paintHeight, métrique)', () => {
  it('peint la hauteur métrique de la case (crée le tableau height au besoin)', () => {
    const s = paintHeight(emptyScene(4, 4), { x: 1, y: 1 }, 1, 1, 0); // +1 m (estrade)
    expect(s.layers[0].height).toBeDefined();
    expect(s.layers[0].height![1 * 4 + 1]).toBe(1); // exactement les mètres peints
    expect(s.layers[0].height![0]).toBe(0); // ailleurs = 0 m
  });
  it('pinceau 3×3 peint un carré ; fosse = mètres négatifs', () => {
    const s = paintHeight(emptyScene(5, 5), { x: 2, y: 2 }, -2, 3, 0); // −2 m (fosse)
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) expect(s.layers[0].height![y * 5 + x]).toBe(-2);
    expect(s.layers[0].height![0]).toBe(0);
  });
  it('hors-grille = no-op', () => {
    const s0 = emptyScene(4, 4);
    expect(paintHeight(s0, { x: -1, y: 0 }, 1, 1, 0)).toBe(s0);
  });
});

describe('editorState — nearestEdge (offset → arête)', () => {
  it('choisit l’arête la plus proche du centre', () => {
    expect(nearestEdge(0.45, 0)).toBe('E'); // vers la droite
    expect(nearestEdge(-0.45, 0)).toBe('O');
    expect(nearestEdge(0, -0.45)).toBe('N');
    expect(nearestEdge(0, 0.45)).toBe('S');
  });
});
