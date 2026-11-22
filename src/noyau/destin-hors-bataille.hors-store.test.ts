/**
 * Le Destin sacrifié hors bataille (#3892) : les trois issues de `choixDuCombat`, `battle` nul, le héros lu au groupe
 * (`porteurParId`). LDB 17 l.29-32 ; `.claude/rules/moteur-et-flux.md:13`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Banc } from './banc.testkit';
import { frapper, horsBataille } from './coupHorsBataille.testkit';
import { testScene } from '../scenes/test-fixture';
import { hasCondition, COND } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { t as tr } from '../i18n';
import { nomDe } from '../engine/nom';

afterEach(() => vi.restoreAllMocks());

/** Le héros du groupe, aucune bataille, frappé par l'assaillant par valeur d'un Critique létal sur double : la mort
 *  que le flux suspend au Destin. */
function coupLetalHorsBataille(): { banc: Banc; H: Combatant; avant: { wounds: number; crits: number; fate: number } } {
  const { banc, H, E } = horsBataille(testScene());
  const avant = { wounds: H.wounds.current, crits: H.criticalWounds ?? 0, fate: H.fate ?? 0 };
  expect(avant.fate).toBeGreaterThan(0);
  frapper(banc, E, H, [22, 12, 1, 100]);
  expect(H.criticalWounds ?? 0).toBe(avant.crits + 1);
  expect(banc.getState().pendingFateSave).toMatchObject({ heroId: H.id, source: 'hit', foeId: E.id });
  return { banc, H, avant };
}

describe('Destin sacrifié hors bataille (#3892) : LDB 17 l.29-32', () => {
  it('« Comment ça a pu rater ? » (l.32) : Blessures restaurées, Critique retiré, un Destin de moins', () => {
    const { banc, H, avant } = coupLetalHorsBataille();
    const groupe = banc.getState().party;
    banc.getState().fenetreChoisir('destin', 'issue', 'eviter');
    const s = banc.getState();
    expect(s.party).not.toBe(groupe);
    expect(s.pendingFateSave).toBeNull();
    expect(H.fate).toBe(avant.fate - 1);
    expect(H.wounds.current).toBe(avant.wounds);
    expect(H.criticalWounds ?? 0).toBe(avant.crits);
    expect(H.outOfRencontre).toBeFalsy();
    expect(s.journal).toContain(tr('cs.fateDodge', { name: nomDe(H) }));
  });

  it('« Meurs un autre jour » (l.31) : mis KO, Inconscient, vivant, un Destin de moins, aucune rencontre à quitter', () => {
    const { banc, H, avant } = coupLetalHorsBataille();
    const groupe = banc.getState().party;
    banc.getState().fenetreChoisir('destin', 'issue', 'survivre');
    const s = banc.getState();
    expect(s.party).not.toBe(groupe);
    expect(s.pendingFateSave).toBeNull();
    expect(H.fate).toBe(avant.fate - 1);
    expect(hasCondition(H, COND.inconscient)).toBe(true);
    expect(H.dead).toBeFalsy();
    expect(H.outOfRencontre).toBeFalsy();
    expect(H.exitReason).toBeUndefined();
    expect(s.journal).toContain(tr('cs.fateFlee', { name: nomDe(H) }));
  });

  it('accepter le sort (l.29) : mort, le Destin intact', () => {
    const { banc, H, avant } = coupLetalHorsBataille();
    const groupe = banc.getState().party;
    banc.getState().fenetreChoisir('destin', 'issue', 'accepter');
    const s = banc.getState();
    expect(s.party).not.toBe(groupe);
    expect(s.pendingFateSave).toBeNull();
    expect(H.fate).toBe(avant.fate);
    expect(H.dead).toBe(true);
    expect(H.outOfRencontre).toBeFalsy();
    expect(s.journal).toContain(tr('cs.succumb', { name: nomDe(H) }));
  });
});
