/**
 * runFlow — exécution de la logique authorée (Flow) : séquence d'effets, branche `if` sur l'état
 * VIVANT, et nœud `test` (ouvre la modale, SUSPEND, reprend branche + continuation à `resolveTest`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { runFlow } from './combatFlow';
import { createHero } from '../engine/character';
import type { Flow } from './flow';

const setFlag = (flag: string): Flow => ({ kind: 'do', effect: { type: 'setFlag', flag } });

beforeEach(() => {
  useGame.setState({ battle: null, scene: null, mode: 'exploration', flags: {}, journal: [], pendingTest: null, pendingLoot: null });
});

describe('runFlow — séquence + branche if (état vivant)', () => {
  it('seq de do : applique les effets dans l’ordre', () => {
    runFlow(useGame.getState, useGame.setState, { kind: 'seq', steps: [setFlag('a'), setFlag('b')] });
    expect(useGame.getState().flags).toMatchObject({ a: true, b: true });
  });

  it('if : la condition est évaluée APRÈS les effets déjà émis (état vivant)', () => {
    // do(setFlag porte) PUIS if(flag porte) → la branche `then` doit être prise (la condition voit l'effet).
    const flow: Flow = {
      kind: 'seq',
      steps: [
        setFlag('porte'),
        { kind: 'if', cond: { kind: 'flag', expr: 'porte' }, then: setFlag('ouvert'), else: setFlag('ferme') },
      ],
    };
    runFlow(useGame.getState, useGame.setState, flow);
    expect(useGame.getState().flags.ouvert).toBe(true);
    expect(useGame.getState().flags.ferme).toBeUndefined();
  });

  it('if sans else, condition fausse → rien', () => {
    runFlow(useGame.getState, useGame.setState, { kind: 'if', cond: { kind: 'flag', expr: 'jamais' }, then: setFlag('x') });
    expect(useGame.getState().flags.x).toBeUndefined();
  });
});

describe('runFlow — nœud test (suspension + continuation)', () => {
  function hero() {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    return h;
  }

  it('ouvre pendingTest ; resolveTest joue la branche RÉUSSITE puis la continuation', () => {
    useGame.setState({ party: [hero()] });
    const flow: Flow = {
      kind: 'seq',
      steps: [
        setFlag('avant'),
        { kind: 'test', test: { characteristic: 'force', label: 'Force' }, success: setFlag('gagne'), fail: setFlag('perd') },
        setFlag('apres'), // CONTINUATION : doit s'exécuter APRÈS la branche
      ],
    };
    runFlow(useGame.getState, useGame.setState, flow);
    // L'effet avant le test est appliqué ; le test suspend ; la continuation attend.
    expect(useGame.getState().flags.avant).toBe(true);
    expect(useGame.getState().flags.apres).toBeUndefined();
    expect(useGame.getState().pendingTest).toBeTruthy();

    // Force une réussite et acquitte → branche `success` + continuation.
    useGame.setState({ pendingTest: { ...useGame.getState().pendingTest!, roll: 5, success: true } });
    useGame.getState().resolveTest();
    expect(useGame.getState().flags.gagne).toBe(true);
    expect(useGame.getState().flags.perd).toBeUndefined();
    expect(useGame.getState().flags.apres).toBe(true); // continuation exécutée
    expect(useGame.getState().pendingTest).toBeNull();
  });

  it('resolveTest joue la branche ÉCHEC sur un Test raté', () => {
    useGame.setState({ party: [hero()] });
    const flow: Flow = { kind: 'test', test: { characteristic: 'force' }, success: setFlag('gagne'), fail: setFlag('perd') };
    runFlow(useGame.getState, useGame.setState, flow);
    useGame.setState({ pendingTest: { ...useGame.getState().pendingTest!, roll: 99, success: false } });
    useGame.getState().resolveTest();
    expect(useGame.getState().flags.perd).toBe(true);
    expect(useGame.getState().flags.gagne).toBeUndefined();
  });
});
