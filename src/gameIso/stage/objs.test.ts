import type { JSX } from 'react';
import { describe, it, expect } from 'vitest';
import { sortByDepth, mergeByDepth, type StageObj } from './objs';

const o = (d: number, tag: string): StageObj => ({ d, el: { key: tag } as unknown as JSX.Element });
const tags = (list: StageObj[]) => list.map((x) => x.el.key);

describe('tri statique + insertion dynamique par dichotomie (fix du sort à 60 Hz)', () => {
  it('sortByDepth : tri STABLE — l’ordre de concaténation départage les ex æquo', () => {
    const merged = sortByDepth([o(2, 'floor2'), o(1, 'floor1')], [o(1, 'wall1')], [o(1, 'hl1')]);
    expect(tags(merged)).toEqual(['floor1', 'wall1', 'hl1', 'floor2']);
  });

  it('mergeByDepth : dyn vide ⇒ IDENTITÉ référentielle (contrat de perf du memo)', () => {
    const stat = sortByDepth([o(1, 'a'), o(2, 'b')]);
    expect(mergeByDepth(stat, [])).toBe(stat);
  });

  it('mergeByDepth : insère à la bonne profondeur, le STATIQUE d’abord à égalité (ordre d’émission historique)', () => {
    const stat = [o(1, 's1'), o(2, 's2'), o(2, 's2b'), o(4, 's4')];
    const dyn = [o(2, 'd2'), o(0, 'd0'), o(5, 'd5'), o(2, 'd2b')];
    // d0 avant tout ; d2 puis d2b APRÈS les statiques à 2 (et dans leur ordre d'émission) ; d5 en queue.
    expect(tags(mergeByDepth(stat, dyn))).toEqual(['d0', 's1', 's2', 's2b', 'd2', 'd2b', 's4', 'd5']);
  });

  it('mergeByDepth : dynamiques seuls (couche statique vide)', () => {
    expect(tags(mergeByDepth([], [o(3, 'b'), o(1, 'a')]))).toEqual(['a', 'b']);
  });
});
