/**
 * dialogue.reponse — l'avancée du dialogue (`choice.next`) est DIFFÉRÉE quand le `choice.flow` suspend
 * sur un Test : la boîte de dialogue n'avance qu'APRÈS résolution (`jetValider('test')`), jamais sous la
 * modale de jet. Un choix sans Test enchaîne comme avant.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import type { Dialogue } from './monde/scene';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const hero = () => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
const setFlag = (flag: string): Flow => ({ kind: 'effet', effet: { type: 'setFlag', flag } });

/** Dialogue à deux nœuds ; le choix `withFlow` porte un Test + un `next` vers n2. */
function makeDialogue(withFlow: boolean): Dialogue {
  return {
    id: 'd', start: { id: 'n1' },
    nodes: [
      {
        id: 'n1', desc: '…',
        choices: [{
          id: 'tenter',
          label: 'Tenter',
          next: { id: 'n2' },
          ...(withFlow ? { flow: { kind: 'test', test: { characteristic: 'force', label: 'Force' }, reussite: setFlag('gagne'), echec: setFlag('perd') } as Flow } : {}),
        }],
      },
      { id: 'n2', desc: 'Suite', choices: [] },
    ],
  };
}

beforeEach(() => {
  banc.setState({ screen: 'campaign', battle: null, scene: null, mode: 'exploration', flags: {}, journal: [], pendingTest: null, dialogue: null });
});

describe('dialogue.reponse — avancée différée pendant un Test', () => {
  it('choix AVEC Test : le dialogue reste au nœud courant tant que le Test n’est pas résolu', () => {
    banc.setState({ party: [hero()], dialogue: { dialogue: makeDialogue(true), nodeId: 'n1', session: 1 } });
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'tenter');
    // Le Test a suspendu ; le nœud N’A PAS avancé (pas de DialogueBox du nœud suivant sous la modale).
    expect(banc.getState().pendingTest).toBeTruthy();
    expect(banc.getState().dialogue?.nodeId).toBe('n1');
    // La transition est portée par le pending, en attente de reprise.
    expect(banc.getState().pendingTest!.dialogueNext).toBeTruthy();
  });

  it('la réponse à Test ouvre la fenêtre de jet ORDINAIRE — pas une modale propre au dialogue (#1869)', () => {
    // le choix `dialogue.reponse` → `runFlow` → `openSkillTest` : le dialogue n'a AUCUN chemin de jet à lui. Le
    // pending est celui de tous les Tests (même slot, même verbe de résolution `jetValider('test')`), et il
    // porte la SITUATION déclarée par le flux — jamais le libellé de la réponse.
    banc.setState({ party: [hero()], dialogue: { dialogue: makeDialogue(true), nodeId: 'n1', session: 1 } });
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'tenter');
    const pt = banc.getState().pendingTest!;
    expect(pt.label).toBe('Force');
    expect(pt.sujet?.characteristic).toBe('force');
    expect(pt.actorId).toBeTruthy(); // un héros du groupe jette : la voie est la voie commune
  });

  it('résolution du Test → la branche s’applique PUIS le dialogue avance', () => {
    banc.setState({ party: [hero()], dialogue: { dialogue: makeDialogue(true), nodeId: 'n1', session: 1 } });
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'tenter');
    banc.setState({ pendingTest: { ...banc.getState().pendingTest!, roll: 5, success: true } });
    banc.getState().jetValider('test');
    expect(banc.getState().flags.gagne).toBe(true); // effet de branche appliqué
    expect(banc.getState().dialogue?.nodeId).toBe('n2'); // avancée APRÈS résolution
    expect(banc.getState().pendingTest).toBeNull();
  });

  it('échec au Test → branche d’échec appliquée, dialogue avance quand même', () => {
    banc.setState({ party: [hero()], dialogue: { dialogue: makeDialogue(true), nodeId: 'n1', session: 1 } });
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'tenter');
    banc.setState({ pendingTest: { ...banc.getState().pendingTest!, roll: 99, success: false } });
    banc.getState().jetValider('test');
    expect(banc.getState().flags.perd).toBe(true);
    expect(banc.getState().dialogue?.nodeId).toBe('n2');
  });

  it('choix SANS Test : le dialogue avance immédiatement (non-régression)', () => {
    banc.setState({ party: [hero()], dialogue: { dialogue: makeDialogue(false), nodeId: 'n1', session: 1 } });
    banc.getState().fenetreChoisir('dialogue', 'reponse', 'tenter');
    expect(banc.getState().pendingTest).toBeNull();
    expect(banc.getState().dialogue?.nodeId).toBe('n2');
  });
});
