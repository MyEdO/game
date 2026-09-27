import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { seedBattleRng } from '../battleRng';
import { REPLIS_DEUX_CIBLES, evaluateTest, resolveOpposed } from '../../engine/tests';
import type { Combatant } from '../../engine/types';

/**
 * Départage d'égalité du Test de RÉCUPÉRATION opposé (`EtatData.recover`) — `LDB 12 l.160`.
 *
 * « Vous pouvez utiliser votre Action pour retirer l'État *Empêtré* en réussissant un Test opposé
 * **de Force** contre la source de cet empêtrement » (`LDB 16 l.66`).
 *
 * Les deux camps de ce Test sont FONDUS par construction : l'acteur porte l'État qu'il quitte, la
 * source porte les siens. La grandeur du départage est la valeur NUE des DEUX (`skillBaseValue`),
 * jamais les valeurs testées — sinon un porteur d'États perdrait une égalité qu'il gagne au RAW.
 */

const CHARS = (force: number) => ({
  'capacite-de-combat': 40, 'capacite-de-tir': 40, force, endurance: 40, initiative: 30,
  agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
});

function combatant(p: Partial<Combatant> & { id: string; force: number }): Combatant {
  return {
    label: p.label ?? p.id, kind: p.kind ?? 'hero',
    characteristics: CHARS(p.force) as never,
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], fortune: 0, resilience: 0, pos: { x: 1, y: 1 },
    ...p,
  } as unknown as Combatant;
}

function setBattle(combatants: Combatant[], activeId: string) {
  const order = combatants.map((c) => c.id);
  useGame.setState({
    mode: 'battle',
    battle: {
      combatants, order, baseOrder: order, turn: order.indexOf(activeId), round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, acted: false,
      log: [], over: null,
    } as never,
    pendingStateRecovery: null,
  });
}

/** Empêtré chargé d'États : acteur Force NUE 60 (3 Exténué), source Force NUE 50 (1 Exténué) — les
 *  valeurs TESTÉES s'inversent, les NUES non. */
function empetreCharge() {
  const src = combatant({
    id: 'liane', label: 'Liane', kind: 'enemy', force: 50,
    conditions: [{ id: 'extenue', value: 1 }] as never,
  });
  const actor = combatant({
    id: 'h', label: 'Héros', force: 60, fortune: 2,
    conditions: [{ id: 'empetre', value: 1, sourceId: 'liane' }, { id: 'extenue', value: 3 }] as never,
  });
  setBattle([actor, src], 'h');
  useGame.getState().battleRecoverState('empetre');
  return useGame.getState().pendingStateRecovery!;
}

describe('LDB 12 l.160 — la récupération opposée départage sur les valeurs NUES des DEUX camps', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(1); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('le pending porte les nues des deux camps, DISTINCTES de leurs valeurs testées', () => {
    const sr = empetreCharge();
    expect(sr.opposition).toBeDefined();
    expect(sr.skillBase, 'Force nue de l’acteur (LDB 09 l.17)').toBe(60);
    expect(sr.skillValue, '3 États Exténué fondent la valeur testée').toBe(30);
    expect(sr.opposition?.base, 'Force nue de l’entrave').toBe(50);
    expect(sr.opposition?.value, '1 État Exténué fond celle de l’entrave').toBe(40);
  });

  it('à DR ÉGAL, la nue la plus haute l’emporte — l’acteur (60) bat l’entrave (50) que ses cibles perdraient', () => {
    let tie: { actorSL: number; oppSL: number } | null = null;
    let sr = null as ReturnType<typeof empetreCharge> | null;
    // Les deux jets sont RNG : on cherche le premier germe qui donne un DR égal (départage joué).
    for (let seed = 1; seed <= 200 && !tie; seed += 1) {
      seedBattleRng(seed);
      empetreCharge();
      useGame.getState().recoverRoll();
      const cur = useGame.getState().pendingStateRecovery!;
      if (cur.roll && cur.opponentRoll && cur.roll.sl === cur.opponentRoll.sl) {
        tie = { actorSL: cur.roll.sl, oppSL: cur.opponentRoll.sl };
        sr = cur;
      }
    }
    expect(tie, 'aucun DR égal en 200 germes : le cas de départage n’a pas été atteint').not.toBeNull();
    expect(sr!.roll!.base).toBe(60);
    expect(sr!.opponentRoll!.base).toBe(50);
    // Les cibles (valeurs testées à Difficulté Intermédiaire) sont INVERSÉES : 30 < 40.
    expect(sr!.roll!.target).toBe(30);
    expect(sr!.opponentRoll!.target).toBe(40);
    const verdict = resolveOpposed(sr!.roll!, sr!.opponentRoll!);
    expect(verdict.decidedBy).toBe('valeur');
    expect(verdict.attackerWins, 'nue 60 > 50 : l’acteur se libère').toBe(true);
    expect(sr!.success, 'le flux applique le MÊME verdict').toBe(true);
  });

  it('CONTRAT : le flux de récupération ne déclenche AUCUN repli deux-cibles (sonde REPLIS_DEUX_CIBLES)', () => {
    // La sonde est vivante dans ce runtime : deux jets SANS nue la font compter.
    const temoin = REPLIS_DEUX_CIBLES.count;
    resolveOpposed(evaluateTest(30, 50), evaluateTest(40, 50));
    expect(REPLIS_DEUX_CIBLES.count, 'sonde inerte : la preuve ci-dessous ne vaudrait rien').toBe(temoin + 1);

    const avant = REPLIS_DEUX_CIBLES.count;
    seedBattleRng(7);
    empetreCharge();
    useGame.getState().recoverRoll();
    useGame.getState().recoverReroll(); // Chance : re-oppose contre le jet FIGÉ de l'entrave
    expect(REPLIS_DEUX_CIBLES.count, 'un départage du flux est retombé sur les cibles').toBe(avant);
  });
});
