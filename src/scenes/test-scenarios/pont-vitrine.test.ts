import { describe, it, expect } from 'vitest';
import { scenario } from './pont-vitrine';
import { layerTiles } from '../../state/scene';
const scenarioConstruit = scenario.construire();

/** Valide la Scene PRODUITE par `buildScene(MapSpec)` : la migration doit être ÉQUIVALENTE en jeu à
 *  l'ancien DSL bespoke (mêmes dimensions, mêmes couches/tuiles/hauteurs, mêmes props, même heroStart). */
describe('pont-vitrine — Scene produite', () => {
  const s = scenarioConstruit.scene;
  const W = 16;
  const at = (z: number, x: number, y: number) => layerTiles(s, z)[y * W + x];
  const height = (z: number) => s.layers.find((l) => l.z === z)!.height!;
  const hAt = (z: number, x: number, y: number) => height(z)[y * W + x];

  it('16×16, deux couches z0/z1', () => {
    expect(s.dimensions).toEqual({ w: 16, h: 16 });
    expect(s.layers.map((l) => l.z)).toEqual([0, 1]);
    expect(s.ambiance).toBe('exterieur');
    expect(s.ambientLight).toBe('jour');
  });

  it('couche 0 : herbe de base + chemin route + rampes pierre + gouffre vide', () => {
    // chemin `route` nord-sud (cols 7-8) traversant toute la carte
    for (let y = 0; y < 16; y++) { expect(at(0, 7, y)).toBe('route'); expect(at(0, 8, y)).toBe('route'); }
    // rampes de pierre ouest (cols 3-4) et est (cols 11-12) sur les rangées 6-8
    for (let y = 6; y <= 8; y++) for (const x of [3, 4, 11, 12]) expect(at(0, x, y)).toBe('pierre');
    // gouffre `vide` de la falaise (col 10, rangées 12-15 ; + rangée 12 cols 10-15)
    for (let x = 10; x <= 15; x++) expect(at(0, x, 12)).toBe('vide');
    for (let y = 13; y <= 15; y++) expect(at(0, 10, y)).toBe('vide');
    // ailleurs = herbe
    expect(at(0, 0, 0)).toBe('herbe');
    expect(at(0, 13, 14)).toBe('herbe');
  });

  it('couche 1 : vide partout sauf le tablier de planches (cols 5-10, rangées 6-8)', () => {
    for (let y = 6; y <= 8; y++) for (let x = 5; x <= 10; x++) expect(at(1, x, y)).toBe('planches');
    expect(at(1, 0, 0)).toBe('vide');
    expect(at(1, 4, 7)).toBe('vide'); // juste à l'ouest du tablier
    expect(at(1, 11, 7)).toBe('vide'); // juste à l'est du tablier
  });

  it('hauteurs métriques — couche 0 : rampes 0→1→2, plateau 1 m, falaise 1→2→3', () => {
    // rampe ouest : col 3 → 1 m, col 4 → 2 m (rangées 6-8)
    for (let y = 6; y <= 8; y++) { expect(hAt(0, 3, y)).toBe(1); expect(hAt(0, 4, y)).toBe(2); }
    // rampe est : col 12 → 1 m, col 11 → 2 m
    for (let y = 6; y <= 8; y++) { expect(hAt(0, 12, y)).toBe(1); expect(hAt(0, 11, y)).toBe(2); }
    // plateau : rect [1..4]×[12..14] à 1 m
    for (let y = 12; y <= 14; y++) for (let x = 1; x <= 4; x++) expect(hAt(0, x, y)).toBe(1);
    // falaise : (9,11)→1 m, (10,11)→2 m, rebord (cols 11-15, rangée 11)→3 m
    expect(hAt(0, 9, 11)).toBe(1);
    expect(hAt(0, 10, 11)).toBe(2);
    for (let x = 11; x <= 15; x++) expect(hAt(0, x, 11)).toBe(3);
    // creux au fond = 0 m
    expect(hAt(0, 13, 14)).toBe(0);
    // sol par défaut = 0 m
    expect(hAt(0, 0, 0)).toBe(0);
  });

  it('hauteurs métriques — couche 1 : tablier à 2 m (cols 5-10, rangées 6-8)', () => {
    for (let y = 6; y <= 8; y++) for (let x = 5; x <= 10; x++) expect(hAt(1, x, y)).toBe(2);
    expect(hAt(1, 0, 0)).toBe(0);
  });

  it('heroStart au nord sur le chemin + 6 props aux positions attendues', () => {
    const hero = s.entities.find((e) => e.kind === 'heroStart');
    expect(hero?.pos).toEqual({ x: 7, y: 1 });
    const props = s.entities.filter((e) => e.kind === 'prop');
    expect(props).toHaveLength(6);
    const byRef = (ref: string, x: number, y: number) =>
      expect(props.some((p) => p.ref === ref && p.pos.x === x && p.pos.y === y)).toBe(true);
    byRef('arbre', 0, 2);
    byRef('arbre', 15, 4);
    byRef('arbre', 0, 9);
    byRef('panneau', 6, 4);
    byRef('rocher', 13, 11);
    byRef('buisson', 13, 14);
  });
});
