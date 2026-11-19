import { describe, it, expect } from 'vitest';
import { distanceDeCombat, footprintChebyshev } from './footprint';
import { emptyScene } from './scene';
import type { Combatant } from '../../engine/types';
import type { SizeCategory } from '../../engine/size';

/**
 * DISTANCE DE COMBAT VERTICALE — `distanceDeCombat(scene, a, b)` = max(distance horizontale d'empreinte,
 * Δhauteur ÷ échelle métrique). La séparation verticale vient de la HAUTEUR MÉTRIQUE des surfaces
 * (`pos.h`, en mètres), plus d'un forfait par étage. Un défenseur de muraille n'est donc PAS superposé
 * aux assaillants au sol. Échelle = `sceneMetresPerTile` (LDB 15 l.12).
 */

const mk = (x: number, y: number, h?: number, size?: SizeCategory): Combatant =>
  ({ id: `${x},${y}`, name: 'c', pos: h ? { x, y, h } : { x, y }, size, conditions: [] }) as unknown as Combatant;

describe('distanceDeCombat — terme vertical = Δhauteur ÷ mpt', () => {
  it('même (x,y), Δh = 4 m, mpt 2 → 2 cases (pas 0 : atteignable au tir, pas au contact)', () => {
    expect(distanceDeCombat(null, mk(5, 5, 0), mk(5, 5, 4))).toBe(2);
  });

  it('coplanaire (Δh = 0) → byte-identique à la distance d’empreinte horizontale', () => {
    const a = mk(0, 0), b = mk(3, 4);
    expect(distanceDeCombat(null, a, b)).toBe(footprintChebyshev(a.pos!, 1, b.pos!, 1));
    expect(distanceDeCombat(null, a, b)).toBe(4);
  });

  it('(x,y) adjacents + Δh = 4 m → max(1, 2) = 2 (le terme vertical domine)', () => {
    expect(distanceDeCombat(null, mk(5, 5, 0), mk(6, 5, 4))).toBe(2);
  });

  it('(x,y) éloignés + petit Δh → l’horizontal domine (max)', () => {
    expect(distanceDeCombat(null, mk(0, 0, 0), mk(6, 0, 2))).toBe(6); // max(6, 1) = 6
  });

  it('échelle MER (mpt = 10) : Δh 4 m ne pèse presque rien → l’horizontal prime', () => {
    expect(distanceDeCombat({ ...emptyScene('mer'), metresPerTile: 10 }, mk(0, 0, 0), mk(3, 0, 4))).toBe(3); // max(3, 0.4) = 3
  });

  it('un combattant non posé → Infinity (inchangé)', () => {
    const ghost = { id: 'g', name: 'g', conditions: [] } as unknown as Combatant;
    expect(distanceDeCombat(null, mk(0, 0, 0), ghost)).toBe(Infinity);
  });
});
