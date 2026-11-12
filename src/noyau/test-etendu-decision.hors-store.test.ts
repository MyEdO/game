/**
 * La DÉCISION d'un Test ÉTENDU est celle d'un Test de flux (#1874 C3) : l'annonce de dialogue (`testAnnonce`) et
 * l'applier `extendedTest` (`combatEffects.ts`) la prennent de `resoudreFlowTest`, sur le même contexte. Une `gate`
 * fermée n'ouvre rien et la suite du Flow se joue. Chemin réel : `runFlow`. LDB 12 l.172-174 ; LDB 12 l.166.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { runFlow } from './combatEffects';
import { testAnnonce } from './dialogue';
import { condCtx } from './bourseFlow';
import type { Flow, TestEtendu } from '../data/schemas/defs-scenes/effets';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const get = () => banc.getState();
const heros = (seed: number, crocheteur = false) => {
  const h = { ...createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${seed}`, seed }), id: `h-${seed}` };
  if (crocheteur) h.skills = [...h.skills, { id: 'crochetage', characteristic: 'dexterite', advances: 5 }];
  return h;
};
const etendu = (over: Partial<TestEtendu> = {}): TestEtendu =>
  ({ type: 'extendedTest', characteristic: 'force', difficulty: 'difficile', label: 'Forcer la grille', drCible: 3, flag: 'cede', ...over });
const seul = (e: TestEtendu): Flow => ({ kind: 'effet', effet: e });
const puis = (e: TestEtendu): Flow => ({ kind: 'sequence', etapes: [seul(e), { kind: 'effet', effet: { type: 'setFlag', flag: 'apres' } }] });
const annonce = (e: TestEtendu) => testAnnonce(seul(e), { cc: condCtx(get), groupe: get().party });

/** La cible d'un Round que l'applier ouvre pour `e`, l'état rendu tel qu'avant. */
function cibleOuverte(e: TestEtendu): number | undefined {
  banc.setState({ pendingExtendedTest: null, pendingCascade: null });
  runFlow(get, banc.setState, seul(e));
  return get().pendingExtendedTest?.target;
}

beforeEach(() => {
  banc.setState({ battle: null, party: [heros(1), heros(2)], flags: {}, pendingExtendedTest: null, pendingCascade: null, suspendedCascades: [] } as never);
});

describe('Test étendu — la décision de `resoudreFlowTest`', () => {
  const allege = etendu({ easierIf: { hasSkill: { id: 'crochetage' } } });

  it.each([
    ['personne ne porte la Compétence', false, 'difficile'],
    ['un membre du groupe la porte', true, 'complexe'],
  ] as const)('annonce == applier sous `easierIf` — %s', (_cas, crocheteur, attendue) => {
    banc.setState({ party: [heros(1), heros(2, crocheteur)] });
    const dit = annonce(allege);
    expect(dit).toEqual({ characteristic: 'force', difficulty: attendue, drCible: 3 });
    expect(cibleOuverte(allege), 'la cible jouée est celle d’un Test déclaré à la Difficulté annoncée').toBe(cibleOuverte(etendu({ difficulty: dit!.difficulty })));
  });

  it('`difficultyBy` : la première Condition vraie décide, à l’annonce comme au jeu', () => {
    const dynamique = etendu({ difficultyBy: [{ cond: { kind: 'flag', expr: 'rouillee' }, difficulty: 'tresDifficile' }] });
    banc.setState({ flags: { rouillee: true } });
    expect(annonce(dynamique)?.difficulty).toBe('tresDifficile');
    expect(cibleOuverte(dynamique)).toBe(cibleOuverte(etendu({ difficulty: 'tresDifficile' })));
  });

  it('`gate` fermée : rien n’est annoncé, aucun Test ne s’ouvre, la suite du Flow se joue', () => {
    const garde = etendu({ gate: { kind: 'flag', expr: 'grille-atteinte' } });
    expect(annonce(garde)).toBeUndefined();
    runFlow(get, banc.setState, puis(garde));
    expect(get().pendingExtendedTest).toBeNull();
    expect(get().flags.apres).toBe(true);
  });

  it('`gate` ouverte : le Test s’ouvre et porte la suite', () => {
    const garde = etendu({ gate: { kind: 'flag', expr: 'grille-atteinte' } });
    banc.setState({ flags: { 'grille-atteinte': true } });
    expect(annonce(garde)?.difficulty).toBe('difficile');
    runFlow(get, banc.setState, puis(garde));
    expect(get().pendingExtendedTest).not.toBeNull();
    expect(get().flags.apres).toBeUndefined();
  });
});
