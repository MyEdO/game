/**
 * runFlow — exécution de la logique authorée (Flow) : séquence d'effets, branche `si` sur l'état
 * VIVANT, et nœud `test` (ouvre la modale, SUSPEND, reprend branche + continuation à `jetValider('test')`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { runFlow } from './combatEffects';
import { createHero } from '../engine/character';
import type { Flow } from '../data/schemas/defs-scenes/effets';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const setFlag = (flag: string): Flow => ({ kind: 'effet', effet: { type: 'setFlag', flag } });

describe('runFlow — séquence + branche if (état vivant)', () => {
  it('seq de do : applique les effets dans l’ordre', () => {
    runFlow(banc.getState, banc.setState, { kind: 'sequence', etapes: [setFlag('a'), setFlag('b')] });
    expect(banc.getState().flags).toMatchObject({ a: true, b: true });
  });

  it('if : la condition est évaluée APRÈS les effets déjà émis (état vivant)', () => {
    // do(setFlag porte) PUIS if(flag porte) → la branche `alors` doit être prise (la condition voit l'effet).
    const flow: Flow = {
      kind: 'sequence',
      etapes: [
        setFlag('porte'),
        { kind: 'si', condition: { kind: 'flag', expr: 'porte' }, alors: setFlag('ouvert'), sinon: setFlag('ferme') },
      ],
    };
    runFlow(banc.getState, banc.setState, flow);
    expect(banc.getState().flags.ouvert).toBe(true);
    expect(banc.getState().flags.ferme).toBeUndefined();
  });

  it('if sans else, condition fausse → rien', () => {
    runFlow(banc.getState, banc.setState, { kind: 'si', condition: { kind: 'flag', expr: 'jamais' }, alors: setFlag('x') });
    expect(banc.getState().flags.x).toBeUndefined();
  });
});

describe('runFlow — nœud test (suspension + continuation)', () => {
  function hero() {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    return h;
  }

  it('ouvre pendingTest ; jetValider@test joue la branche RÉUSSITE puis la continuation', () => {
    banc.setState({ party: [hero()] });
    const flow: Flow = {
      kind: 'sequence',
      etapes: [
        setFlag('avant'),
        { kind: 'test', test: { characteristic: 'force', label: 'Force' }, reussite: setFlag('gagne'), echec: setFlag('perd') },
        setFlag('apres'), // CONTINUATION : doit s'exécuter APRÈS la branche
      ],
    };
    runFlow(banc.getState, banc.setState, flow);
    // L'effet avant le test est appliqué ; le test suspend ; la continuation attend.
    expect(banc.getState().flags.avant).toBe(true);
    expect(banc.getState().flags.apres).toBeUndefined();
    expect(banc.getState().pendingTest).toBeTruthy();

    // Force une réussite et acquitte → branche `reussite` + continuation.
    banc.setState({ pendingTest: { ...banc.getState().pendingTest!, roll: 5, success: true } });
    banc.getState().jetValider('test');
    expect(banc.getState().flags.gagne).toBe(true);
    expect(banc.getState().flags.perd).toBeUndefined();
    expect(banc.getState().flags.apres).toBe(true); // continuation exécutée
    expect(banc.getState().pendingTest).toBeNull();
  });

  it('jetValider@test joue la branche ÉCHEC sur un Test raté', () => {
    banc.setState({ party: [hero()] });
    const flow: Flow = { kind: 'test', test: { characteristic: 'force' }, reussite: setFlag('gagne'), echec: setFlag('perd') };
    runFlow(banc.getState, banc.setState, flow);
    banc.setState({ pendingTest: { ...banc.getState().pendingTest!, roll: 99, success: false } });
    banc.getState().jetValider('test');
    expect(banc.getState().flags.perd).toBe(true);
    expect(banc.getState().flags.gagne).toBeUndefined();
  });
});
