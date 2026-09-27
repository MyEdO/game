import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { createHero } from '../engine/character';
import { emptyScene } from './scene';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';
import { combatValue } from '../engine/combat';
import { skillBaseValue } from '../engine/skills';
import { skillAdvantageCap } from '../engine/skillCombatApps';

/** Réinitialise le store à un état combat neutre entre deux tests. */
function reset() {
  useGame.setState({
    screen: 'campaign', party: [], scene: null, mode: 'exploration', battle: null,
    pendingTest: null, pendingAttack: null, pendingDefense: null, pendingCascade: null,
    journal: [],
  });
}

function combat(heroOver: Partial<Combatant> = {}) {
  const H = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 3 });
  H.fortune = 0; H.resolve = 0; H.resilience = 0; H.advantage = 0;
  Object.assign(H, heroOver);
  const E: Combatant = JSON.parse(JSON.stringify(H));
  E.id = 'enemy-0'; E.label = 'Brigand'; E.kind = 'enemy'; E.fortune = 0; E.advantage = 0; E.psychState = [];
  const battle: BattleState = {
    combatants: [H, E], order: [H.id, E.id], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ party: [H], mode: 'battle', battle, scene: emptyScene(8, 8) });
  return { H, E };
}

describe('Substitution sociale en défense LIVE (LDB 09 l.287)', () => {
  beforeEach(() => { vi.useFakeTimers(); reset(); });
  afterEach(() => { vi.useRealTimers(); });

  function setDefense(H: Combatant, E: Combatant) {
    useGame.setState({
      pendingDefense: {
        attackerId: E.id, defenderId: H.id, weapon: E.weapons[0], location: null,
        atk: { roll: 55, target: 40, success: false, sl: -1, isDouble: false },
        mode: 'parade', def: null, result: null, suite: { mode: 'machine', coup: {} },
      },
    });
  }

  it('l’option sociale se RÉSOUT : base + libellé = la Compétence substituée', () => {
    const { H, E } = combat();
    H.skills.push({ id: 'intimidation', advances: 6 } as never);
    E.psychState = [{ type: 'peur', sourceId: H.id, indice: 2, calmeDR: 0 } as never]; // l'attaquant a peur de H
    seedBattleRng(1);
    setDefense(H, E);
    useGame.getState().defenseSetMode('social', 'intimidation');
    useGame.getState().defenseRoll();
    const dd = useGame.getState().pendingDefense!.result!.defenderDetail!;
    expect(dd.mode).toBe('social');
    expect(dd.label).toBe('Intimidation');
    expect(dd.base).toBe(skillBaseValue(H, 'intimidation'));
  });

  it('la substitution NE casse PAS la Parade (Corps à corps intact)', () => {
    const { H, E } = combat();
    H.skills.push({ id: 'intimidation', advances: 6 } as never);
    E.psychState = [{ type: 'peur', sourceId: H.id, indice: 2, calmeDR: 0 } as never];
    seedBattleRng(1);
    setDefense(H, E);
    useGame.getState().defenseSetMode('parade');
    useGame.getState().defenseRoll();
    const dd = useGame.getState().pendingDefense!.result!.defenderDetail!;
    expect(dd.mode).toBe('parade');
    expect(dd.base).toBe(combatValue(H, 'melee', H.weapons[0]));
  });
});

describe('Cumuler l’Avantage par une Compétence LIVE (LDB 09 l.305-308)', () => {
  beforeEach(() => { vi.useFakeTimers(); reset(); });
  afterEach(() => { vi.useRealTimers(); });

  it('Intuition réussie → +1 Avantage (plafonné au Bonus d’Int) et Action consommée', () => {
    const { H } = combat();
    const cap = skillAdvantageCap(H, 'intuition'); // = Bonus d'Intelligence, > 0 (Intuition possédée)
    expect(cap).toBeGreaterThan(0);
    useGame.getState().battleGainAdvantage('intuition');
    const pt = useGame.getState().pendingTest!;
    expect(pt.combatAdvantage).toEqual({ combatantId: H.id, cap });
    useGame.setState({ pendingTest: { ...pt, roll: 5, success: true, sl: 2 } });
    useGame.getState().resolveTest();
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.advantage).toBe(1);
    expect(b.acted).toBe(true);
  });

  it('Intuition ratée → aucun gain, mais l’Action est tout de même consommée', () => {
    const { H } = combat();
    useGame.getState().battleGainAdvantage('intuition');
    const pt = useGame.getState().pendingTest!;
    useGame.setState({ pendingTest: { ...pt, roll: 99, success: false, sl: -3 } });
    useGame.getState().resolveTest();
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.advantage).toBe(0);
    expect(b.acted).toBe(true);
  });

  it('déjà au plafond de la méthode → l’action ne s’ouvre pas', () => {
    const { H } = combat();
    H.advantage = skillAdvantageCap(H, 'intuition'); // = Bonus d'Int (plafond de la méthode)
    useGame.getState().battleGainAdvantage('intuition');
    expect(useGame.getState().pendingTest).toBeNull();
  });

  it('Compétence sans application « Avantage » (Corps à corps) → aucune action ouverte', () => {
    combat();
    useGame.getState().battleGainAdvantage('corps-a-corps');
    expect(useGame.getState().pendingTest).toBeNull();
  });
});
