/**
 * `consumeReverseToken` (LDB 23 l.209/218 — Entraînement au Combat / Observer une cible) : jeton
 * d'inversion de Test CONSOMMABLE « pour votre prochaine aventure », posé par l'op `grantReverseToken`
 * (`ActiveEffect.reverseToken`, `duration:{scale:'adventure'}`).
 */
import { describe, it, expect } from 'vitest';
import { consumeReverseToken } from './reverseToken';
import { applyOps } from './ops';
import type { Combatant } from './types';
import { desDuTest } from './dice.testkit';
import { idNeufDeBanc } from '../lib/entityId.testkit';

const mk = (): Combatant => ({ id: 'c', name: 'X', activeEffects: [] }) as unknown as Combatant;

describe('consumeReverseToken (LDB 23 l.209/218)', () => {
  it('0 excédent : sans jeton, rien à consommer', () => {
    expect(consumeReverseToken(mk(), { skill: 'corps-a-corps' })).toBe(false);
  });

  it('cas nominal : jeton scopé à une Compétence — consommé UNE fois, puis épuisé', () => {
    const c = mk();
    applyOps(c, [{ op: 'grantReverseToken', skill: { id: 'corps-a-corps' }}], { idNeuf: idNeufDeBanc, rng: desDuTest, label: 'Entraînement au Combat' });
    expect(consumeReverseToken(c, { skill: 'corps-a-corps' })).toBe(true);
    expect(consumeReverseToken(c, { skill: 'corps-a-corps' })).toBe(false); // épuisé
  });

  it("scope : ne couvre pas une AUTRE Compétence que celle du jeton", () => {
    const c = mk();
    applyOps(c, [{ op: 'grantReverseToken', skill: { id: 'corps-a-corps' }}], { idNeuf: idNeufDeBanc, rng: desDuTest, label: 'Entraînement au Combat' });
    expect(consumeReverseToken(c, { skill: 'projectiles' })).toBe(false);
    expect(consumeReverseToken(c, { skill: 'corps-a-corps' })).toBe(true); // toujours là
  });

  it("jeton SANS `skill` (Observer une cible, l.218) : couvre tout Test", () => {
    const c = mk();
    applyOps(c, [{ op: 'grantReverseToken' }], { idNeuf: idNeufDeBanc, rng: desDuTest, label: 'Observer une cible' });
    expect(consumeReverseToken(c, { skill: 'ragot' })).toBe(true);
  });

  it("expiration adventure : posé avec `duration:{scale:'adventure'}` (purgé à l'interlude suivant)", () => {
    const c = mk();
    applyOps(c, [{ op: 'grantReverseToken', skill: { id: 'corps-a-corps' }}], { idNeuf: idNeufDeBanc, rng: desDuTest, label: 'Entraînement au Combat' });
    expect(c.activeEffects?.[0].duration).toEqual({ scale: 'adventure' });
  });
});
