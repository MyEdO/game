/**
 * `certainFlowOps` (#1117) : les ops qu'un Flow appliquera à coup sûr. L'invariant qui compte est le FAIL-CLOSED :
 * un Flow dont l'issue dépend d'une Condition, d'un second jet ou d'un choix ne se résume PAS.
 */
import { describe, it, expect } from 'vitest';
import { certainFlowOps, EMPTY_FLOW, testFlow, type Flow } from './flowCore';
import type { GameOp } from './ops';

const OPS: GameOp[] = [{ op: 'condition', id: { id: 'sonne' }, value: 1 }];
const AUTRES: GameOp[] = [{ op: 'wounds', amount: 3 }];
const doOps = (ops: GameOp[]): Flow => ({ kind: 'effet', effet: { type: 'ops', on: 'target', ops } });

describe('certainFlowOps — les ops certaines d’un Flow (#1117)', () => {
  it('une feuille d’ops rend SES ops, dans l’ordre', () => {
    expect(certainFlowOps(doOps(OPS))).toEqual(OPS);
  });

  it('une séquence CONCATÈNE ses feuilles, dans l’ordre d’application', () => {
    const f: Flow = { kind: 'sequence', etapes: [doOps(OPS), doOps(AUTRES)] };
    expect(certainFlowOps(f)).toEqual([...OPS, ...AUTRES]);
  });

  it('une branche VIDE rend `[]` — « rien ne se produit » est une réponse, pas une absence', () => {
    expect(certainFlowOps(EMPTY_FLOW)).toEqual([]);
  });

  it('FAIL-CLOSED : un `if` ne se résume pas (la branche dépend d’une Condition évaluée plus tard)', () => {
    const f: Flow = { kind: 'si', condition: { kind: 'flag', expr: 'x' }, alors: doOps(OPS), sinon: doOps(AUTRES) };
    expect(certainFlowOps(f)).toBeUndefined();
    // …et il CONTAMINE la séquence qui le porte.
    expect(certainFlowOps({ kind: 'sequence', etapes: [doOps(OPS), f] })).toBeUndefined();
  });

  it('FAIL-CLOSED : un `test` imbriqué (second jet) et un `choice` ne se résument pas non plus', () => {
    expect(certainFlowOps(testFlow({ skill: { id: 'resistance' }, difficulty: 'intermediaire' }, EMPTY_FLOW, doOps(OPS)))).toBeUndefined();
    expect(certainFlowOps({ kind: 'choix', invite: 'Tenter ?', oui: doOps(OPS) })).toBeUndefined();
  });

  it('FAIL-CLOSED : une feuille qui n’est PAS une liste d’ops (transition, dialogue) ne se résume pas', () => {
    const f = { kind: 'effet', effet: { type: 'transition', to: 'scene-2' } } as unknown as Flow;
    expect(certainFlowOps(f)).toBeUndefined();
  });

  it('aucun flow du tout : rien à afficher', () => {
    expect(certainFlowOps(undefined)).toBeUndefined();
  });
});
