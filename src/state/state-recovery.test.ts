import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import type { Combatant } from '../engine/types';
import { seedBattleRng } from './battleRng';
import { applyOps } from '../engine/ops';
import { findConditionById } from '../data';

function hero(p: Partial<Combatant>): Combatant {
  return {
    id: 'h1', label: 'Héros', kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 80, endurance: 40, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'athletisme', characteristic: 'agilite', advances: 20 }], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

function enemy(p: Partial<Combatant>): Combatant {
  return { ...hero({ kind: 'enemy', label: 'Bête', skills: [], ...p }) } as Combatant;
}

function setBattle(combatants: Combatant[], activeId: string) {
  const order = combatants.map((c) => c.id);
  useGame.setState({
    mode: 'battle',
    battle: {
      combatants, order, baseOrder: order, turn: order.indexOf(activeId), round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, acted: false,
      log: [], over: null,
    } as any,
    pendingStateRecovery: null,
  });
}

describe('Récupération d’État — flux combat (LDB 16 l.66/84)', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('En flammes : se rouler (Athlétisme) → retire 1 + DR pions, consomme l’Action', () => {
    const h = hero({ id: 'h', conditions: [{ id: 'en-flammes', value: 2 }] });
    setBattle([h], 'h');
    useGame.getState().battleRecoverState('en-flammes');
    const sr = useGame.getState().pendingStateRecovery!;
    expect(sr).not.toBeNull();
    expect(sr.opposition).toBeUndefined();
    expect(sr.skillLabel).toBe('Athlétisme');
    useGame.getState().recoverRoll();
    expect(useGame.getState().pendingStateRecovery!.roll).not.toBeNull();
    // fige une réussite reproductible (DR 1) avant Appliquer
    useGame.setState({ pendingStateRecovery: { ...useGame.getState().pendingStateRecovery!, success: true, netSL: 1 } });
    useGame.getState().recoverConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    expect(after.conditions.find((c) => c.id === 'en-flammes')).toBeUndefined(); // 2 − (1+1) = 0 → retiré
    expect(useGame.getState().battle!.acted).toBe(true);
    expect(useGame.getState().pendingStateRecovery).toBeNull();
  });

  it('Empêtré : Test OPPOSÉ de Force contre la source ; succès → se libère', () => {
    const h = hero({ id: 'h', characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 80, endurance: 40, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } as any,
      conditions: [{ id: 'empetre', value: 1, sourceId: 'pieuvre' }] });
    const src = enemy({ id: 'pieuvre', label: 'Pieuvre', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 20, endurance: 30, initiative: 20, agilite: 20, dexterite: 20, intelligence: 20, 'force-mentale': 20, sociabilite: 20 } as any });
    setBattle([h, src], 'h');
    useGame.getState().battleRecoverState('empetre');
    const sr = useGame.getState().pendingStateRecovery!;
    expect(sr.opposition).toBeDefined();
    expect(sr.opposition?.label).toBe('Pieuvre');
    useGame.getState().recoverRoll();
    // fige la victoire de l’acteur (F 80 ≫ F 20)
    useGame.setState({ pendingStateRecovery: { ...useGame.getState().pendingStateRecovery!, success: true, netSL: 0 } });
    useGame.getState().recoverConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    expect(after.conditions.find((c) => c.id === 'empetre')).toBeUndefined();
    expect(useGame.getState().battle!.acted).toBe(true);
  });

  it('Empêtré sans source vivante → Test simple (non opposé)', () => {
    const h = hero({ id: 'h', conditions: [{ id: 'empetre', value: 1, sourceId: 'parti' }] });
    setBattle([h], 'h'); // la source 'parti' n’est pas dans le combat
    useGame.getState().battleRecoverState('empetre');
    expect(useGame.getState().pendingStateRecovery!.opposition).toBeUndefined();
    expect(useGame.getState().pendingStateRecovery!.skillLabel).toBe('Force');
  });

  it('échec : aucun pion retiré, l’Action est tout de même consommée', () => {
    const h = hero({ id: 'h', conditions: [{ id: 'en-flammes', value: 1 }] });
    setBattle([h], 'h');
    useGame.getState().battleRecoverState('en-flammes');
    useGame.getState().recoverRoll();
    useGame.setState({ pendingStateRecovery: { ...useGame.getState().pendingStateRecovery!, success: false, netSL: 0 } });
    useGame.getState().recoverConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    expect(after.conditions.find((c) => c.id === 'en-flammes')?.value).toBe(1); // intact
    expect(useGame.getState().battle!.acted).toBe(true);
  });

  it('Empêtré de sort (escapeStrength) : Test OPPOSÉ contre la Force d’entrave FIGÉE (FM du lanceur)', () => {
    // Lanceur : Force Mentale 55 → la Force d'entrave figée doit valoir 55 (charOf FM), pas sa Force.
    const caster = enemy({ id: 'sorcier', label: 'Sorcier',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 25, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 55, sociabilite: 30 } as any });
    const h = hero({ id: 'h', conditions: [] });
    // L'op `condition` Empêtré avec escapeStrength = FM du lanceur (Enchevêtrement de Taal).
    applyOps(h, [{ op: 'condition', id: 'empetre', value: 1, escapeStrength: { charOf: 'force-mentale' } }], { caster });
    expect(h.conditions.find((c) => c.id === 'empetre')?.escapeStrength).toBe(55);
    setBattle([h], 'h'); // pas de source vivante dans le combat → sans escapeStrength, ce serait un Test simple
    useGame.getState().battleRecoverState('empetre');
    const sr = useGame.getState().pendingStateRecovery!;
    expect(sr.opposition).toBeDefined(); // grâce à la Force d'entrave figée
    expect(sr.opposition?.value).toBe(55); // FM du lanceur, pas sa Force (25)
    expect(sr.opposition?.label, 'sans source au combat, l’entrave est l’État lui-même (#1882)').toBe(findConditionById('empetre')!.label);
  });

  it('entrave figée d’une source HORS DE COMBAT : l’entrave porte le NOM de sa source (#1882)', () => {
    const caster = enemy({ id: 'src', label: 'Liane', dead: true });
    const h = hero({ id: 'h', conditions: [] });
    applyOps(h, [{ op: 'condition', id: 'empetre', value: 1, escapeStrength: 40 }], { caster });
    h.conditions.find((c) => c.id === 'empetre')!.sourceId = 'src';
    setBattle([h, caster], 'h');
    useGame.getState().battleRecoverState('empetre');
    expect(useGame.getState().pendingStateRecovery!.opposition).toEqual({ value: 40, base: 40, label: 'Liane' });
  });

  it('escapeStrength PRIORITAIRE sur la Force de la source vivante', () => {
    // La source vivante a Force 80 ; l'entrave figée (sort) vaut FM 30 → c'est la valeur figée qui prime.
    const caster = enemy({ id: 'src', label: 'Liane',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 80, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } as any });
    const h = hero({ id: 'h', conditions: [] });
    applyOps(h, [{ op: 'condition', id: 'empetre', value: 1, escapeStrength: { charOf: 'force-mentale' } }], { caster });
    // L'op ne pose pas de sourceId — on simule une entrave dont la source serait aussi présente :
    h.conditions.find((c) => c.id === 'empetre')!.sourceId = 'src';
    setBattle([h, caster], 'h');
    useGame.getState().battleRecoverState('empetre');
    const sr = useGame.getState().pendingStateRecovery!;
    expect(sr.opposition?.value).toBe(30); // FM figée, PAS la Force 80 de la source vivante
    expect(sr.opposition?.label).toBe('Liane'); // nom de la source si présente
  });

  it('Filet (Zoo Impérial p.29) : échec du Test à seuil → entangleOnFail AGGRAVE (+1 État Empêtré)', () => {
    const h = hero({ id: 'h', conditions: [{ id: 'empetre', value: 1, escapeThreshold: 3, entangleOnFail: true }], armour: { tete: 5, brasG: 5, brasD: 5, corps: 5, jambeG: 5, jambeD: 5 } });
    setBattle([h], 'h');
    useGame.getState().battleRecoverState('empetre');
    useGame.getState().recoverRoll();
    useGame.setState({ pendingStateRecovery: { ...useGame.getState().pendingStateRecovery!, success: false, netSL: 1 } }); // DR < seuil → échoue
    useGame.getState().recoverConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    expect(after.conditions.find((c) => c.id === 'empetre')?.value).toBe(2); // 1 → 2 (aggravation)
  });

  it('Immobilisante GÉNÉRIQUE (fouet/lasso, LDB 62 l.256-258) : échec = rien (pas d’entangleOnFail en donnée)', () => {
    const h = hero({ id: 'h', conditions: [{ id: 'empetre', value: 1, escapeStrength: 47 }] });
    setBattle([h], 'h');
    useGame.getState().battleRecoverState('empetre');
    useGame.getState().recoverRoll();
    useGame.setState({ pendingStateRecovery: { ...useGame.getState().pendingStateRecovery!, success: false, netSL: 0 } });
    useGame.getState().recoverConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    expect(after.conditions.find((c) => c.id === 'empetre')?.value).toBe(1); // inchangé
  });

  it('Filet BARBELÉ (Zoo Impérial p.29) : Dégâts ignorant l’armure à CHAQUE tentative — RÉUSSIE', () => {
    // Endurance quasi nulle (BE 0) : isole le seul comportement testé (ignore l'ARMURE, PAS l'Endurance).
    const h = hero({ id: 'h', wounds: { current: 12, max: 12 },
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 80, endurance: 1, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } as any,
      armour: { tete: 5, brasG: 5, brasD: 5, corps: 5, jambeG: 5, jambeD: 5 },
      conditions: [{ id: 'empetre', value: 1, escapeThreshold: 3, entangleOnFail: true, struggleDamage: 1 }] });
    setBattle([h], 'h');
    useGame.getState().battleRecoverState('empetre');
    useGame.getState().recoverRoll();
    useGame.setState({ pendingStateRecovery: { ...useGame.getState().pendingStateRecovery!, success: true, netSL: 3 } });
    useGame.getState().recoverConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    expect(after.wounds!.current).toBe(11); // 1 Blessure malgré 5 PA (ignore l’armure)
    expect(after.conditions.find((c) => c.id === 'empetre')).toBeUndefined(); // libéré
  });

  it('Filet BARBELÉ (Zoo Impérial p.29) : Dégâts ignorant l’armure à CHAQUE tentative — RATÉE', () => {
    const h = hero({ id: 'h', wounds: { current: 12, max: 12 },
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 80, endurance: 1, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 } as any,
      armour: { tete: 5, brasG: 5, brasD: 5, corps: 5, jambeG: 5, jambeD: 5 },
      conditions: [{ id: 'empetre', value: 1, escapeThreshold: 3, entangleOnFail: true, struggleDamage: 1 }] });
    setBattle([h], 'h');
    useGame.getState().battleRecoverState('empetre');
    useGame.getState().recoverRoll();
    useGame.setState({ pendingStateRecovery: { ...useGame.getState().pendingStateRecovery!, success: false, netSL: 1 } });
    useGame.getState().recoverConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'h')!;
    expect(after.wounds!.current).toBe(11); // Dégâts infligés MÊME sur échec
    expect(after.conditions.find((c) => c.id === 'empetre')?.value).toBe(2); // + aggravation
  });

  it('cancel avant Appliquer : pas de coût d’Action', () => {
    const h = hero({ id: 'h', conditions: [{ id: 'en-flammes', value: 1 }] });
    setBattle([h], 'h');
    useGame.getState().battleRecoverState('en-flammes');
    useGame.getState().recoverCancel();
    expect(useGame.getState().pendingStateRecovery).toBeNull();
    expect(useGame.getState().battle!.acted).toBe(false);
  });
});
