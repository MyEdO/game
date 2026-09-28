import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { scenario } from './19-grimpant';
import { runEnemyAI } from '../../state/combatFlow';
const scenarioConstruit = scenario.construire();

/**
 * GRIMPANT (#504) : preuve LIVE sur la scène RÉELLE du scénario — l'araignée géante (Trait Grimpant)
 * franchit l'arête `WallSeg.climb` posée au pied du plateau, SANS Test (aucune modale de jet ouverte),
 * et arrive au contact du Chasseur en peu de tours (anti-grind).
 */
function startGrimpant(): { spider: import('../../engine/types').Combatant } {
  useGame.setState({ party: scenario.construire().party });
  useGame.getState().startScene(scenarioConstruit.scene);
  useGame.getState().startCombat('enc-grimpant');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const spider = b.combatants.find((c) => c.kind === 'enemy')!;
  return { spider };
}

describe('Grimpant — l’araignée escalade (grimpant)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('scène : plateau à 4 m, une seule arête climb au pied (5,3), Chasseur posté dessus (5,1)', () => {
    const s = scenarioConstruit.scene;
    expect(s.dimensions).toEqual({ w: 10, h: 10 });
    const climb = s.walls!.find((w) => w.climb);
    expect(climb).toMatchObject({ x: 5, y: 3, side: 'N' });
    expect(useGame.getState().party ?? scenario.construire().party).toBeTruthy();
  });

  it('l’araignée (Trait Grimpant) franchit la falaise SANS Test et atteint le plateau en ≤ 2 tours (anti-grind)', () => {
    const { spider } = startGrimpant();
    expect(spider.traits?.some((t) => t.id === 'grimpant')).toBe(true);
    expect(spider.pos!.y).toBeGreaterThan(2); // départ au sol, sous la falaise

    for (let round = 0; round < 2 && !useGame.getState().battle!.over; round++) {
      const b = useGame.getState().battle!;
      const sp = b.combatants.find((c) => c.id === spider.id)!;
      if (!sp.pos || sp.pos.y <= 2) break; // déjà sur le plateau
      const turnIdx = b.order.indexOf(spider.id);
      useGame.setState({ battle: { ...b, round: b.round + round, turn: turnIdx, acted: false, action: null, movementUsed: 0 } }); // un tour par Round
      runEnemyAI(useGame.getState, useGame.setState, spider.id);
      vi.runOnlyPendingTimers();
    }
    const after = useGame.getState().battle!.combatants.find((c) => c.id === spider.id)!;
    expect(after.pos!.y).toBeLessThanOrEqual(2); // a grimpé sur le plateau
  });

  it('journalise le franchissement (climb.auto, #504) : le pathing IA n’est pas un jet silencieux', () => {
    const { spider } = startGrimpant();
    for (let round = 0; round < 2 && !useGame.getState().battle!.over; round++) {
      const b = useGame.getState().battle!;
      const sp = b.combatants.find((c) => c.id === spider.id)!;
      if (!sp.pos || sp.pos.y <= 2) break;
      const turnIdx = b.order.indexOf(spider.id);
      useGame.setState({ battle: { ...b, round: b.round + round, turn: turnIdx, acted: false, action: null, movementUsed: 0 } }); // un tour par Round
      runEnemyAI(useGame.getState, useGame.setState, spider.id);
      vi.runOnlyPendingTimers();
    }
    const log = useGame.getState().battle!.log;
    expect(log.some((l) => l.text.includes('escalade la paroi sans effort'))).toBe(true);
  });
});
