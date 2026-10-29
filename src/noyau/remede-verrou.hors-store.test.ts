/**
 * REMÈDE D'ÉTAT ET VERROU — l'offre et le dispatcher rendent le même verdict, lu au même endroit
 * (`isConditionLocked`). Un État verrouillé ne se retire par aucun moyen (`LDB 18 l.15`) : le geste
 * qui le viserait est refusé AVANT de coûter quoi que ce soit, et la raison est dite.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { ACTION_GATES, actionGate, type ActionCtx } from './actionRegistry';
import { ACTE_DE_DEVERROUILLAGE, hasCondition } from '../engine/conditions';
import { findConditionById, type ActionDef } from '../data/index';
import { t } from '../i18n';
import type { ConditionInstance } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function setup() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  banc.getState().startScene(testScene());
  banc.getState().startCombat('enc-mutants');
  banc.getState().confirmRoundStart();
  banc.abandonner();
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  H.engagedWith = [];
  banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id), movementUsed: 0, acted: false }, pendingStateRecovery: null });
  return { H };
}

const ctxDe = (def?: ActionDef): ActionCtx => {
  const battle = banc.getState().battle!;
  return { active: battle.combatants.find((c) => c.kind === 'hero')!, battle, def, gameTime: banc.getState().gameTime };
};

describe('remède d’État — un État VERROUILLÉ refuse le Test, et le dit', () => {
  beforeEach(() => { banc.setState({ battle: null }); });

  it('En flammes verrouillé par un acte de soin : la case est fermée ET le dispatcher n’ouvre rien', () => {
    const { H } = setup();
    H.conditions = [{ id: 'en-flammes', value: 1, unlockBy: 'medicalAid' }] as ConditionInstance[];
    banc.setState({ battle: { ...banc.getState().battle! } });
    const verdict = actionGate('roll-fire', ctxDe());
    expect(verdict.ok, 'un remède offert sur un État que le Test ne peut pas ôter').toBe(false);
    expect(verdict.reason).toBe(t('cond.lockedByAct', { acte: ACTE_DE_DEVERROUILLAGE.medicalAid }));
    banc.getState().battleRecoverState('en-flammes');
    expect(banc.getState().pendingStateRecovery, 'le Test s’est ouvert sur un État verrouillé').toBeNull();
    expect(hasCondition(banc.getState().battle!.combatants.find((c) => c.id === H.id)!, 'en-flammes')).toBe(true);
  });

  it('TÉMOIN — sans verrou, la même case est offerte et le Test s’ouvre', () => {
    const { H } = setup();
    H.conditions = [{ id: 'en-flammes', value: 1 }] as ConditionInstance[];
    banc.setState({ battle: { ...banc.getState().battle! } });
    expect(actionGate('roll-fire', ctxDe()).ok).toBe(true);
    banc.getState().battleRecoverState('en-flammes');
    expect(banc.getState().pendingStateRecovery, 'le Test ne s’est pas ouvert').toBeTruthy();
  });

  // Le Test de récupération est un prérequis du DISPATCHER (`battleRecoverState`), pas une propriété
  // du remède : un remède-GESTE sur un État sans `recover` ni verrou reste OFFERT.
  it('un remède-GESTE sur un État sans Test ni verrou est OFFERT ; seul le gate de Test le refuse', () => {
    const { H } = setup();
    const etat = 'assourdi';
    expect(findConditionById(etat)!.recover, 'la fixture a gagné un Test : elle ne mesure plus rien').toBeUndefined();
    expect(findConditionById(etat)!.lockedUntil, 'la fixture a gagné un verrou').toBeUndefined();
    H.conditions = [{ id: etat, value: 1 }] as ConditionInstance[];
    banc.setState({ battle: { ...banc.getState().battle! } });
    const def = { id: 'remede-fixture', rule: { id: etat, type: 'etat' } } as ActionDef;
    expect(ACTION_GATES['etat-porte'](ctxDe(def)).ok, 'l’État est porté').toBe(true);
    expect(ACTION_GATES['remede-atteignable'](ctxDe(def)).ok, 'aucun verrou : le geste est atteignable').toBe(true);
    const parTest = ACTION_GATES['etat-recuperable-par-test'](ctxDe(def));
    expect(parTest.ok, 'cet État ne se retire pourtant par aucun Test').toBe(false);
    expect(parTest.reason).toBe(t('agate.stateNoRecoverTest'));
  });
});
