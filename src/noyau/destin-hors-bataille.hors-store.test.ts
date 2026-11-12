/**
 * Le Destin sacrifié hors bataille (#3892) : les trois issues de `choixDuCombat`, `battle` nul, le héros lu au groupe
 * (`porteurParId`). LDB 17 l.29-32 ; `.claude/rules/moteur-et-flux.md:13`.
 */
import { describe, expect, it } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { heroDuDuel } from './combatDeTest.testkit';
import { finalizeHeroDeath } from './combatFlow';
import { testScene } from '../scenes/test-fixture';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { hasCondition, COND } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { t as tr } from '../i18n';

/** Le héros du groupe, scène lancée, aucune bataille, frappé d'un Critique létal par un assaillant hors de toute
 *  file : Blessures à 0, un Critique de plus, puis la mort que `finalizeHeroDeath` suspend au Destin. */
function coupLetalHorsBataille(): { banc: Banc; H: Combatant; avant: { wounds: number; crits: number; fate: number } } {
  const banc = ouvrirLeBanc();
  banc.setState({ party: [heroDuDuel()] });
  banc.getState().lancerLaScene(testScene());
  expect(banc.getState().battle).toBeNull();
  const H = banc.getState().party[0];
  const avant = { wounds: H.wounds.current, crits: H.criticalWounds ?? 0, fate: H.fate ?? 0 };
  expect(avant.fate).toBeGreaterThan(0);
  H.wounds.current = 0;
  H.criticalWounds = avant.crits + 1;
  const E = combattantDeTest({ id: 'assaillant', kind: 'enemy', label: 'Assaillant' });
  finalizeHeroDeath(banc.getState, banc.setState, H, 'hit', avant.wounds, E);
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
    expect(s.journal).toContain(tr('cs.fateDodge', { name: H.label }));
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
    expect(s.journal).toContain(tr('cs.fateFlee', { name: H.label }));
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
    expect(s.journal).toContain(tr('cs.succumb', { name: H.label }));
  });
});
