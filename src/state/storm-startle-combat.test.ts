import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { startleOnStormAtCombatStart } from '../noyau/combatFlow';
import { stacks, hasCondition, COND } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import type { BattleState } from './store';

/**
 * #341 — Éclairs de la pluie diluvienne (EDOC 8 l.82). À l'OUVERTURE d'un combat pendant un jour de
 * voyage sous pluie diluvienne (`weather.json` `lightningNervous`), chaque monture au Trait Nerveux est
 * effrayée UNE fois — +3 Brisé. La cause est un BRUIT FORT (tonnerre → `startleCause:'noise'`), donc une
 * monture Dressée (Guerre) est exemptée par la donnée du Trait Nerveux (aucune branche par-nom).
 */
const mkMount = (id: string, traits: { id: string }[]): Combatant => ({
  id, name: id, kind: 'enemy', characteristics: { 'capacite-de-combat': 30, endurance: 40 }, skills: [], talents: [],
  traits, conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: { corps: 0 },
  wounds: { current: 10, max: 10, base: 10 }, advantage: 0, pos: { x: 0, y: 0 },
} as unknown as Combatant);

function setup(weatherId: string, combatants: Combatant[]) {
  const battle: BattleState = {
    combatants, order: combatants.map((c) => c.id), turn: -1, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as BattleState;
  useGame.setState({
    // Halte de nuit : le jour clos est le dernier de `plan.log` (`openRest`), sans `plan.recap`.
    battle, travelPlan: { interrupted: false, log: [{ weather: { id: weatherId } }] } as never,
  });
}

describe('#341 — startle des montures Nerveuses à l’ouverture de combat sous pluie diluvienne', () => {
  beforeEach(() => useGame.setState({ battle: null, travelPlan: null, pendingRest: null }));

  it('pluie diluvienne : une monture Nerveuse (non Dressée) gagne +3 Brisé', () => {
    const m = mkMount('m1', [{ id: 'nerveux' }]);
    setup('pluie-diluvienne', [m]);
    startleOnStormAtCombatStart(useGame.getState, useGame.setState);
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'm1')!;
    expect(stacks(after, COND.brise)).toBe(3);
  });

  it('pluie diluvienne : une monture Nerveuse Dressée (Guerre) est exemptée (bruit fort)', () => {
    const m = mkMount('m2', [{ id: 'nerveux' }, { id: 'dresse-guerre' }]);
    setup('pluie-diluvienne', [m]);
    startleOnStormAtCombatStart(useGame.getState, useGame.setState);
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'm2')!;
    expect(hasCondition(after, COND.brise)).toBe(false);
  });

  it('pluie SIMPLE : aucun effarouchement (météo sans lightningNervous)', () => {
    const m = mkMount('m3', [{ id: 'nerveux' }]);
    setup('pluie', [m]);
    startleOnStormAtCombatStart(useGame.getState, useGame.setState);
    const after = useGame.getState().battle!.combatants.find((c) => c.id === 'm3')!;
    expect(hasCondition(after, COND.brise)).toBe(false);
  });
});
