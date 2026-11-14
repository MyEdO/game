/** L'op impure `attaquesSubies` (#3892) : déclarée par sa grammaire, inerte dans `applyOps`, dite par le Codex.
 *  MDG 15 l.163-164, l.177-178 */
import { describe, expect, it } from 'vitest';
import { gameOpSchema } from '../data/schemas/grammaire/mecanique';
import { applyOps, type GameOp } from '../engine/ops';
import { flowHasImpureOp } from '../engine/flowCore';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { makeRNG } from '../engine/dice';
import { t } from '../i18n';
import { humanizeOp } from './codex/humanize';

const rats = { type: 'statblock', label: 'Rats géants', char: { 'capacite-de-combat': 35 }, traits: [{ id: 'arme', value: 5 }] } as const;
const attaques = { op: 'attaquesSubies', assaillant: { statblock: rats }, nombre: { dice: { n: 1, sides: 10 } } } as const;

describe('op `attaquesSubies`', () => {
  it('la grammaire admet un statbloc assaillant et un Tirage `{ dice }`', () => {
    expect(gameOpSchema.safeParse(attaques).success).toBe(true);
  });

  it('la grammaire refuse une op sans `nombre`, ou un `nombre` en chaîne (« 1d10 ») au lieu d’un Tirage', () => {
    const { nombre: _n, ...sansNombre } = attaques;
    expect(gameOpSchema.safeParse(sansNombre).success).toBe(false);
    expect(gameOpSchema.safeParse({ ...attaques, nombre: '1d10' }).success).toBe(false);
  });

  it('est inerte dans `applyOps` et rangée parmi les ops impures', () => {
    const op = gameOpSchema.parse(attaques);
    expect(applyOps(combattantDeTest(), [op], { idNeuf: idsDeTest, rng: makeRNG(1) })).toEqual([]);
    expect(flowHasImpureOp({ kind: 'effet', effet: { type: 'ops', ops: [op] } })).toBe(true);
  });

  it('la fiche Codex dit le nombre d’attaques et l’assaillant', () => {
    expect(humanizeOp(gameOpSchema.parse(attaques) as GameOp)).toBe(t('codex.op.attaquesSubies', { nombre: '1d10', assaillant: 'Rats géants' }));
  });
});
