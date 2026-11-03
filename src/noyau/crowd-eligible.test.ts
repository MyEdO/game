import { describe, it, expect } from 'vitest';
import { crowdEligible } from './combatFlow';

/** « Tirer dans le tas » (LDB 14 l.106) : la touche au hasard porte sur TOUT le monde serré
 *  au contact de la cible — les DEUX camps (un allié peut être touché : tir fratricide), le tireur exclu. */
const C = (id: string, x: number, y: number, kind: string) =>
  ({ id, pos: { x, y }, kind, wounds: { current: 5, max: 5 }, conditions: [] } as any);
const battle = (combatants: any[]) => ({ combatants } as any);

describe('crowdEligible', () => {
  it('cible + allié + ennemi au contact (diagonale incluse) ; exclut le tireur et les distants', () => {
    const shooter = C('s', 0, 0, 'hero');
    const target = C('t', 5, 5, 'monster');
    const ally = C('a', 5, 6, 'hero'); // allié du tireur au contact de la cible → fratricide possible
    const foe = C('f', 6, 6, 'monster'); // ennemi en diagonale, au contact
    const far = C('x', 9, 9, 'monster'); // distant → exclu
    const elig = crowdEligible(battle([shooter, target, ally, foe, far]), shooter, target);
    expect(elig.map((c) => c.id).sort()).toEqual(['a', 'f', 't']);
  });
});
