/**
 * chooseDialogue — l'avancée du dialogue (`choice.next`) est DIFFÉRÉE quand le `choice.flow` suspend
 * sur un Test : la boîte de dialogue n'avance qu'APRÈS résolution (`resolveTest`), jamais sous la
 * modale de jet. Un choix sans Test enchaîne comme avant.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Flow } from './flow';
import type { Dialogue } from './scene';

const hero = () => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
const setFlag = (flag: string): Flow => ({ kind: 'do', effect: { type: 'setFlag', flag } });

/** Dialogue à deux nœuds ; le choix `withFlow` porte un Test + un `next` vers n2. */
function makeDialogue(withFlow: boolean): Dialogue {
  return {
    id: 'd', start: 'n1',
    nodes: [
      {
        id: 'n1', desc: '…',
        choices: [{
          label: 'Tenter',
          next: 'n2',
          ...(withFlow ? { flow: { kind: 'test', test: { characteristic: 'force', label: 'Force' }, success: setFlag('gagne'), fail: setFlag('perd') } as Flow } : {}),
        }],
      },
      { id: 'n2', desc: 'Suite', choices: [] },
    ],
  };
}

beforeEach(() => {
  useGame.setState({ screen: 'campaign', battle: null, scene: null, mode: 'exploration', flags: {}, journal: [], pendingTest: null, dialogue: null });
});

describe('chooseDialogue — avancée différée pendant un Test', () => {
  it('choix AVEC Test : le dialogue reste au nœud courant tant que le Test n’est pas résolu', () => {
    useGame.setState({ party: [hero()], dialogue: { dialogue: makeDialogue(true), nodeId: 'n1', session: 1 } });
    useGame.getState().chooseDialogue(0);
    // Le Test a suspendu ; le nœud N’A PAS avancé (pas de DialogueBox du nœud suivant sous la modale).
    expect(useGame.getState().pendingTest).toBeTruthy();
    expect(useGame.getState().dialogue?.nodeId).toBe('n1');
    // La transition est portée par le pending, en attente de reprise.
    expect(useGame.getState().pendingTest!.dialogueNext).toBeTruthy();
  });

  it('la réponse à Test ouvre la fenêtre de jet ORDINAIRE — pas une modale propre au dialogue (#1869)', () => {
    // `chooseDialogue` → `runFlow` → `openSkillTest` : le dialogue n'a AUCUN chemin de jet à lui. Le
    // pending est celui de tous les Tests (même slot, même verbe de résolution `resolveTest`), et il
    // porte la SITUATION déclarée par le flux — jamais le libellé de la réponse.
    useGame.setState({ party: [hero()], dialogue: { dialogue: makeDialogue(true), nodeId: 'n1', session: 1 } });
    useGame.getState().chooseDialogue(0);
    const pt = useGame.getState().pendingTest!;
    expect(pt.label).toBe('Force');
    expect(pt.char).toBe('force');
    expect(pt.actorId).toBeTruthy(); // un héros du groupe jette : la voie est la voie commune
  });

  it('résolution du Test → la branche s’applique PUIS le dialogue avance', () => {
    useGame.setState({ party: [hero()], dialogue: { dialogue: makeDialogue(true), nodeId: 'n1', session: 1 } });
    useGame.getState().chooseDialogue(0);
    useGame.setState({ pendingTest: { ...useGame.getState().pendingTest!, roll: 5, success: true } });
    useGame.getState().resolveTest();
    expect(useGame.getState().flags.gagne).toBe(true); // effet de branche appliqué
    expect(useGame.getState().dialogue?.nodeId).toBe('n2'); // avancée APRÈS résolution
    expect(useGame.getState().pendingTest).toBeNull();
  });

  it('échec au Test → branche d’échec appliquée, dialogue avance quand même', () => {
    useGame.setState({ party: [hero()], dialogue: { dialogue: makeDialogue(true), nodeId: 'n1', session: 1 } });
    useGame.getState().chooseDialogue(0);
    useGame.setState({ pendingTest: { ...useGame.getState().pendingTest!, roll: 99, success: false } });
    useGame.getState().resolveTest();
    expect(useGame.getState().flags.perd).toBe(true);
    expect(useGame.getState().dialogue?.nodeId).toBe('n2');
  });

  it('choix SANS Test : le dialogue avance immédiatement (non-régression)', () => {
    useGame.setState({ party: [hero()], dialogue: { dialogue: makeDialogue(false), nodeId: 'n1', session: 1 } });
    useGame.getState().chooseDialogue(0);
    expect(useGame.getState().pendingTest).toBeNull();
    expect(useGame.getState().dialogue?.nodeId).toBe('n2');
  });
});
