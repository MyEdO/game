import { describe, it, expect } from 'vitest';
import { fixedJetOpen } from './fixedDieMark';
import { etatInitialDuJeu, type Jeu } from './etat';

/** #973 — `fixedJetOpen` lit les slots `pending*` de l'état qu'il reçoit : tout slot de l'état initial
 *  du jeu qui porte un dé fixé ouvre la fenêtre de marquage, aucun sans. */
describe('fixedJetOpen — sur l’état initial du jeu', () => {
  const initial = etatInitialDuJeu() as Jeu;
  const slots = Object.keys(initial).filter((k) => k.startsWith('pending'));

  it('aucun slot ouvert : faux', () => {
    expect(fixedJetOpen(initial)).toBe(false);
  });

  it('chaque slot `pending*` qui porte `fixed: true` : vrai', () => {
    expect(slots.length).toBeGreaterThan(0);
    for (const k of slots) expect(fixedJetOpen({ ...initial, [k]: { fixed: true } }), k).toBe(true);
  });

  it('un slot ouvert SANS dé fixé : faux', () => {
    expect(fixedJetOpen({ ...initial, pendingTest: { fixed: false } as never })).toBe(false);
  });
});
