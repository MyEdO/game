import { vi } from 'vitest';
import * as donnees from '../data';
import type { TrappingData } from '../data';

/** Armure de monture de test, 2 PA, hors catalogue : AA 09 l.184 (barde), ADE I 07 l.66 (caparaçon). #4135 */
const armureDeMonture = (id: string, label: string, loc: string): TrappingData => {
  const { shape: _shape, ...cotte } = donnees.findTrappingById('cotte-de-mailles')!;
  return { ...cotte, id, label, loc, pa: 2, enc: 0, qualities: [], capabilities: { armureDeMonture: true } };
};

export const BARDE_DE_TEST = armureDeMonture('barde-de-test', 'Barde de test', 'Tête, Corps, Pattes avant');
export const CAPARACON_DE_TEST = armureDeMonture('caparacon-de-test', 'Caparaçon de test', 'Tête, Corps');

/** `f` joué avec les armures de monture de test au catalogue, lues à l'appel par `findTrappingById` (espion du namespace). */
export function avecArmuresDeMontureDeTest<T>(f: () => T): T {
  const ns = donnees as unknown as Record<string, unknown>;
  const vrai = donnees.findTrappingById;
  const parId = new Map([BARDE_DE_TEST, CAPARACON_DE_TEST].map((t) => [t.id, t]));
  const espion = vi.spyOn(ns, 'findTrappingById', 'get').mockReturnValue((id: string) => parId.get(id) ?? vrai(id));
  try {
    return f();
  } finally {
    espion.mockRestore();
  }
}
