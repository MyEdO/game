import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from './policy';
import { statusCharmMod, statusCharmLabel, decalerLeStatut } from './social';
import type { Status } from './money';
import { createHero } from './character';
import { applyOps } from './ops';
import { desDuTest } from './dice.testkit';
import { conditionCtx, evalCondition } from './flowCore';

const S = (tier: Status['tier'], standing: number): Status => ({ tier, standing });


afterEach(() => {
  resetRule('social-status-reaction-roll');
  resetRule('social-begging-bonus');
  resetRule('social-charm-intra-tier');
});

describe('statusCharmMod — inter-Échelon (RAW de base, LDB 08 l.57)', () => {
  it('actor d’un Échelon SUPÉRIEUR → +10', () => {
    expect(statusCharmMod(S('or', 1), S('argent', 5))).toBe(10);
    expect(statusCharmMod(S('argent', 1), S('bronze', 5))).toBe(10);
    expect(statusCharmMod(S('or', 2), S('bronze', 3))).toBe(10);
  });
  it('actor d’un Échelon INFÉRIEUR → −10', () => {
    expect(statusCharmMod(S('bronze', 5), S('argent', 1))).toBe(-10);
    expect(statusCharmMod(S('argent', 5), S('or', 1))).toBe(-10);
  });
  it('même Échelon (toutes options off) → 0 même à Standing différent', () => {
    expect(statusCharmMod(S('argent', 5), S('argent', 1))).toBe(0);
    expect(statusCharmMod(S('bronze', 1), S('bronze', 3))).toBe(0);
  });
});

describe('statusCharmMod — intra-Échelon (option social-charm-intra-tier, l.88)', () => {
  it('gaté par la règle : sans elle, 0', () => {
    expect(statusCharmMod(S('argent', 5), S('argent', 1))).toBe(0);
  });
  it('avec la règle : ±10 selon le Standing', () => {
    setRule('social-charm-intra-tier', true);
    expect(statusCharmMod(S('argent', 5), S('argent', 1))).toBe(10);
    expect(statusCharmMod(S('argent', 1), S('argent', 5))).toBe(-10);
    expect(statusCharmMod(S('bronze', 3), S('bronze', 3))).toBe(0); // Standing égal → 0
  });
  it('n’affecte pas l’inter-Échelon (qui reste ±10)', () => {
    setRule('social-charm-intra-tier', true);
    expect(statusCharmMod(S('or', 1), S('bronze', 5))).toBe(10);
  });
});

describe('statusCharmMod — mendicité (option social-begging-bonus, l.92)', () => {
  it('Bronze → Argent + begging : +10 au lieu de −10', () => {
    setRule('social-begging-bonus', true);
    expect(statusCharmMod(S('bronze', 2), S('argent', 1), { begging: true })).toBe(10);
  });
  it('sans begging (option active mais flag faux) : reste −10', () => {
    setRule('social-begging-bonus', true);
    expect(statusCharmMod(S('bronze', 2), S('argent', 1))).toBe(-10);
  });
  it('uniquement Bronze → Argent (pas Bronze → Or)', () => {
    setRule('social-begging-bonus', true);
    expect(statusCharmMod(S('bronze', 2), S('or', 1), { begging: true })).toBe(-10);
  });
  it('option off : begging ignoré → −10', () => {
    expect(statusCharmMod(S('bronze', 2), S('argent', 1), { begging: true })).toBe(-10);
  });
});

describe('statusCharmMod — réaction au Statut (option social-status-reaction-roll, l.54/90)', () => {
  it('1-2 « Braver le Statut » → 0', () => {
    setRule('social-status-reaction-roll', true);
    expect(statusCharmMod(S('or', 1), S('bronze', 1), { reactionRoll: 1 })).toBe(0);
    expect(statusCharmMod(S('or', 1), S('bronze', 1), { reactionRoll: 2 })).toBe(0);
  });
  it('3-8 « réactions classiques » → mod inchangé', () => {
    setRule('social-status-reaction-roll', true);
    expect(statusCharmMod(S('or', 1), S('bronze', 1), { reactionRoll: 5 })).toBe(10);
    expect(statusCharmMod(S('bronze', 1), S('or', 1), { reactionRoll: 5 })).toBe(-10);
  });
  it('9-10 « Opinions extrêmes » → mod inversé (Or>Bronze +10 → −10 ; Bronze<Or −10 → +10)', () => {
    setRule('social-status-reaction-roll', true);
    expect(statusCharmMod(S('or', 1), S('bronze', 1), { reactionRoll: 9 })).toBe(-10);
    expect(statusCharmMod(S('or', 1), S('bronze', 1), { reactionRoll: 10 })).toBe(-10);
    expect(statusCharmMod(S('bronze', 1), S('or', 1), { reactionRoll: 10 })).toBe(10);
  });
  it('enveloppe aussi un mod de 0 (rien à inverser)', () => {
    setRule('social-status-reaction-roll', true);
    expect(statusCharmMod(S('argent', 3), S('argent', 1), { reactionRoll: 9 })).toBe(-0);
  });
});

describe('statusCharmMod — défaut (toutes règles off)', () => {
  it('seul le ±10 inter-Échelon RAW s’applique ; aucune option ne change un Test', () => {
    expect(statusCharmMod(S('or', 1), S('bronze', 5))).toBe(10);
    expect(statusCharmMod(S('bronze', 5), S('or', 1))).toBe(-10);
    expect(statusCharmMod(S('argent', 1), S('argent', 5))).toBe(0); // intra off
    expect(statusCharmMod(S('bronze', 2), S('argent', 1), { begging: true })).toBe(-10); // begging off
  });
});

describe('statusCharmLabel', () => {
  it('inter-Échelon : libellé orienté', () => {
    expect(statusCharmLabel(S('argent', 3), S('bronze', 2))).toBe('Statut (Argent>Bronze) +10');
    expect(statusCharmLabel(S('bronze', 2), S('or', 1))).toBe('Statut (Bronze<Or) −10');
  });
  it('même Échelon sans mod → undefined', () => {
    expect(statusCharmLabel(S('argent', 3), S('argent', 1))).toBeUndefined();
  });
  it('intra-Échelon (option) compare le Standing', () => {
    setRule('social-charm-intra-tier', true);
    expect(statusCharmLabel(S('argent', 5), S('argent', 1))).toBe('Statut (Argent 5>1) +10');
  });
  it('mendicité : mentionne le mode', () => {
    setRule('social-begging-bonus', true);
    expect(statusCharmLabel(S('bronze', 2), S('argent', 1), { begging: true })).toBe('Statut (mendicité Bronze>Argent) +10');
  });
});

describe('Statut EFFECTIF — le Standing temporaire de Réputation compte pendant l’aventure (LDB 23 l.234)', () => {
  it('un héros Argent 1 passe la Condition « au moins Argent 2 » une fois son Standing monté de +1', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 1601 });
    const cond = { kind: 'status' as const, atLeast: 'Argent 2' };
    const ctx = () => conditionCtx({ flags: {}, gameTime: 0, party: [h] });
    expect(evalCondition(cond, ctx()), 'témoin : Argent 1 de carrière').toBe(false);
    applyOps(h, [{ op: 'statusMod', amount: 1 }], { rng: desDuTest, label: 'Réputation' });
    expect(evalCondition(cond, ctx())).toBe(true);
  });
});

describe('decalerLeStatut — le Standing qui atteint 0 fait descendre l’Échelon (LDB 08 l.101)', () => {
  it.each([
    [S('bronze', 1), -1, S('bronze', 0)],
    [S('argent', 1), -1, S('bronze', 5)],
    [S('or', 1), -1, S('argent', 5)],
    [S('bronze', 0), -1, S('bronze', 0)],
    [S('bronze', 2), -1, S('bronze', 1)],
    [S('bronze', 0), 1, S('bronze', 1)],
    [S('or', 5), 2, S('or', 7)],
  ])('%o décalé de %i → %o', (statut, delta, attendu) => {
    expect(decalerLeStatut(statut, delta)).toEqual(attendu);
  });
});
