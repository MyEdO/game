/**
 * Chemin JOUEUR de la Détermination contre une cause d'inconscience qui COURT ENCORE (`LDB 16 l.117`) :
 * le retrait a bien lieu (dispatcher `battleSpendResolve`, geste de la pastille d'État), et la fin du
 * Round REPOSE l'État en NOMMANT sa cause. La cause est ici la rangée 81-87 de la Colère des dieux
 * (« Purifier la chair », `LDB 40 l.75`), lue dans la DONNÉE — pas un op forgé.
 *
 * `src/state/battleRng.ts` ensemence par l'horloge à l'import : toute sonde sème (`seedBattleRng`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import './combatFlow'; // effet de bord : enregistre les hooks de fin de Round (dont `end-of-round`)
import { runCombatHooks, type CombatHookCtx } from './combatHooks';
import { seedBattleRng } from './battleRng';
import { createHero } from '../engine/character';
import { makeRNG, type RNG } from '../engine/dice';
import { applyOps, type GameOp } from '../engine/ops';
import { rollMiscast } from '../engine/miscast';
import { hasCondition } from '../engine/conditions';
import { testScene } from '../scenes/test-fixture';
import type { Flow } from '../engine/flowCore';
import type { Combatant } from '../engine/types';

/** Les ops du palier « −4 DR ou moins » de la rangée, telles que la donnée les déplie (même extraction
 *  que `src/engine/miscast-ops.test.ts`, qui éprouve le moteur — ici on éprouve le chemin du STORE). */
function opsDuPalier(): GameOp[] {
  for (let seed = 0; seed < 600; seed++) {
    const r = rollMiscast('colere', makeRNG(seed), 0);
    if (!r.label.startsWith('Purifier la chair')) continue;
    const node: Flow = r.testFlow!;
    if (node.kind !== 'test' || node.fail.kind !== 'seq') throw new Error('structure de la rangée inattendue');
    const hard = node.fail.steps[1];
    if (hard.kind !== 'if' || hard.then.kind !== 'do' || hard.then.effect.type !== 'ops') throw new Error('palier onFailHard introuvable');
    return hard.then.effect.ops;
  }
  throw new Error('rangée « Purifier la chair » introuvable');
}

const troisRounds: RNG = { int: () => 3 }; // 1d10 → 3 : la cause court 3 Rounds

describe('Détermination contre une cause qui court (LDB 16 l.117) — chemin store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, pendingFateSave: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** Héros ACTIF en combat, frappé par le palier de « Purifier la chair » — le journal de pose est rendu. */
  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    seedBattleRng(7);
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    H.resolve = 1;
    const pose = applyOps(H, opsDuPalier(), { rng: troisRounds, label: 'Purifier la chair' });
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id) }, pendingCascade: null, pendingLogQueue: [] });
    return { H, pose };
  }

  /** Joue les hooks de fin de Round et rend les lignes de journal émises. */
  function finDeRound(): string[] {
    const lignes: string[] = [];
    const battle = useGame.getState().battle!;
    const ctx: CombatHookCtx = { get: useGame.getState, set: useGame.setState, battle, sink: (l: string, _c?: Combatant) => lignes.push(l) };
    runCombatHooks('onRoundEnd', ctx);
    return lignes;
  }

  it('la POSE annonce une re-prise conditionnelle, jamais « un État par Round »', () => {
    const { H, pose } = setup();
    expect(hasCondition(H, 'inconscient')).toBe(true);
    expect(pose).toContain("H regagnera l'État Inconscient à chaque fin de Round, tant que dure Purifier la chair (3 Rounds).");
  });

  it('Détermination dépensée : l’État est RETIRÉ, puis REGAGNÉ en fin de Round par sa cause NOMMÉE', () => {
    const { H } = setup();
    useGame.getState().battleSpendResolve('inconscient');
    const apres = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hasCondition(apres, 'inconscient'), 'le retrait A LIEU (LDB 17 l.61)').toBe(false);
    expect(apres.resolve).toBe(0);
    expect(useGame.getState().battle!.log.map((e) => e.text)).toContain("H puise dans sa Détermination : retire l'État Inconscient.");

    const lignes = finDeRound();
    expect(hasCondition(apres, 'inconscient'), '« vous gagnez un nouvel État Inconscient à la fin du Round »').toBe(true);
    expect(apres.conditions.find((x) => x.id === 'inconscient')!.value).toBe(1); // ne se cumule pas (LDB 16 l.115)
    expect(lignes).toContain('H regagne 1 État Inconscient : Purifier la chair le tient toujours.');
  });

  it('la cause ÉCOULÉE (3 fins de Round), la Détermination libère POUR DE BON', () => {
    const { H } = setup();
    for (let i = 0; i < 3; i++) finDeRound();
    expect((H.activeEffects ?? []).some((e) => e.opsPerRound), 'la cause a expiré').toBe(false);
    useGame.getState().battleSpendResolve('inconscient');
    const lignes = finDeRound();
    expect(hasCondition(H, 'inconscient')).toBe(false);
    expect(lignes.some((l) => l.includes('regagne') && l.includes('Inconscient'))).toBe(false);
  });
});
