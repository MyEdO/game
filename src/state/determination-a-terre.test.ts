/**
 * DÉTERMINATION SUR À TERRE À 0 BLESSURE — les deux passages se lisent ensemble : « Retirez un État :
 * si vous retirez l'État à Terre, regagnez 1 Point de Blessure lorsque vous vous mettez debout »
 * (`LDB 17 l.61`) et « Jusqu'à ce que vous puissiez au moins guérir 1 Point de Blessure, vous ne
 * pourrez pas vous débarrasser de cet État » (`LDB 18 l.15`). La dépense REND la Blessure qui lève le
 * verrou : elle est donc OUVERTE à 0 PB — c'est son usage prévu. Le GESTE « Se relever », lui, ne rend
 * rien : il reste refusé (`LDB 16 l.35`). Deux verdicts différents, et c'est la règle.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { actionGate } from './actionRegistry';
import { hasCondition, raisonRefusDetermination, ACTE_DE_DEVERROUILLAGE } from '../engine/conditions';
import { findConditionById } from '../data/index';
import { t } from '../i18n';
import type { Combatant, ConditionInstance } from '../engine/types';

/** Héros ACTIF, À Terre, à `pb` Blessures et `resolve` points de Détermination. */
function setup(pb: number, resolve: number, inst: Partial<ConditionInstance> = {}) {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene);
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  H.engagedWith = [];
  H.resolve = resolve;
  H.wounds.current = pb;
  H.conditions = [{ id: 'a-terre', value: 1, ...inst }] as ConditionInstance[];
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id), movementUsed: 0, acted: false } });
  return { H };
}

const vivant = (id: string): Combatant => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

describe('Détermination — « Retirez un État » relève d’À Terre à 0 Blessure (LDB 17 l.61)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('la donnée déclare le soin de la dépense', () => {
    expect(findConditionById('a-terre')!.resolveHeals, 'sans ce champ, la règle l.61 n’a plus de porteur').toBe(1);
  });

  it('0 PB + 1 Détermination → `battleSpendResolve` : État retiré, 1 PB regagné, point débité, journal « se relève »', () => {
    const { H } = setup(0, 1);
    useGame.getState().battleSpendResolve('a-terre');
    const apres = vivant(H.id);
    expect(hasCondition(apres, 'a-terre'), 'l’État n’a pas été retiré (LDB 17 l.61)').toBe(false);
    expect(apres.wounds.current, 'la Blessure de la mise debout n’a pas été rendue').toBe(1);
    expect(apres.resolve).toBe(0);
    expect(useGame.getState().battle!.log.map((e) => e.text).join('\n')).toContain(t('cs.fragGettingUp'));
  });

  it('0 PB + 1 Détermination → `spendResolveCondition` (par id) : même verdict', () => {
    const { H } = setup(0, 1);
    useGame.getState().spendResolveCondition(H.id, 'a-terre');
    const apres = vivant(H.id);
    expect(hasCondition(apres, 'a-terre')).toBe(false);
    expect(apres.wounds.current).toBe(1);
    expect(apres.resolve).toBe(0);
  });

  it('SANS Détermination : rien ne bouge — ni l’État, ni les Blessures', () => {
    const { H } = setup(0, 0);
    useGame.getState().battleSpendResolve('a-terre');
    const apres = vivant(H.id);
    expect(hasCondition(apres, 'a-terre')).toBe(true);
    expect(apres.wounds.current, 'un soin a été rendu sans dépense').toBe(0);
  });

  it('à 0 PB, la case « Se relever » reste FERMÉE alors que la dépense, elle, est OUVERTE', () => {
    const { H } = setup(0, 1);
    const battle = useGame.getState().battle!;
    const geste = actionGate('stand', { active: vivant(H.id), battle });
    expect(geste.ok, 'le GESTE ne rend aucune Blessure : il reste refusé (LDB 16 l.35)').toBe(false);
    expect(geste.reason).toBe(findConditionById('a-terre')!.lockedReason);
    expect(raisonRefusDetermination(vivant(H.id), 'a-terre'), 'la dépense doit rester ouverte').toBeUndefined();
  });

  it('verrou de Critique (`unlockBy`) : la dépense est REFUSÉE — point NON débité, aucun soin rendu', () => {
    const { H } = setup(0, 1, { unlockBy: 'medicalAid' });
    expect(raisonRefusDetermination(vivant(H.id), 'a-terre'))
      .toBe(t('cond.lockedByAct', { acte: ACTE_DE_DEVERROUILLAGE.medicalAid }));
    useGame.getState().battleSpendResolve('a-terre');
    const apres = vivant(H.id);
    expect(hasCondition(apres, 'a-terre')).toBe(true);
    expect(apres.resolve, 'le point a été débité sur une dépense refusée').toBe(1);
    expect(apres.wounds.current, 'le porteur a été soigné sans rien payer').toBe(0);
  });

  it('munition logée qui annule le soin : dépense REFUSÉE avec sa raison, rien n’est débité ni soigné', () => {
    const { H } = setup(0, 1);
    const h = vivant(H.id);
    // « Chaque flèche ou balle non retirée vous empêche de guérir 1 de vos Blessures » (LDB 62 l.250) :
    // assez de munitions logées pour que le plafond de soin rende 0 — le verrou tient donc.
    h.conditions = [...h.conditions, { id: 'munition-logee', value: h.wounds.max } as ConditionInstance];
    expect(raisonRefusDetermination(h, 'a-terre'), 'le soin est nul : le verrou doit refuser').toBe(findConditionById('a-terre')!.lockedReason);
    useGame.getState().battleSpendResolve('a-terre');
    const apres = vivant(H.id);
    expect(hasCondition(apres, 'a-terre')).toBe(true);
    expect(apres.resolve).toBe(1);
    expect(apres.wounds.current).toBe(0);
  });
});
