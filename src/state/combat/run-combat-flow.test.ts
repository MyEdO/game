import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { runCombatFlow } from './triggeredTest';
import { openCastCascade } from '../combatFlow'; // effet de bord : installe l'applier `triggeredTest` + le routeur + le hook onGainCondition
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';

import { testScene } from '../../scenes/test-fixture';
import type { Flow } from '../flow';
import type { Combatant } from '../../engine/types';
import { resetCadence, setCadence } from '../../engine/cadence';

/**
 * runCombatFlow — exécuteur à PILE d'un Flow EN COMBAT, cadence-aware, qui porte la CONTINUATION `after`.
 * Sur un nœud `test` ENFOUI dans un `seq` :
 *  - HÉROS manuel → pousse une étape de cascade `triggeredTest` (influençable) dont le `meta.after` est
 *    le reste du `seq` (le `do` qui suivait) ; `cascadeRoll`+`cascadeNext` joue la BRANCHE puis le `do`
 *    de continuation (preuve que `after` est repris) ;
 *  - ENNEMI → jet INLINE + branche + `after`, SANS étape de cascade.
 * Jumeau de `run-flow.test` (scène) et de `round-upkeep-cascade.test` (cascade).
 */
/** ENTITÉ PORTEUSE du Flow joué, comme en production : c'est d'elle que le Test muet DÉRIVE son enjeu
 *  (#1262 V2 L6d) — un Flow de combat n'est jamais orphelin, il est l'œuvre de quelque chose. */
const PORTEUR = { kind: 'spell', id: 'chute' } as const;

const wounds = (amount: number): Flow => ({ kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'wounds', amount }] } });

/** Flow `seq[ do(−pre PB), test{F → success/fail}, do(−post PB) ]` — le `do` final est la CONTINUATION
 *  `after` qui doit s'appliquer APRÈS la branche (jamais avalée par le test). */
function flow(pre: number, success: number, fail: number, post: number): Flow {
  return {
    kind: 'seq',
    steps: [
      wounds(pre),
      { kind: 'test', test: { characteristic: 'force', label: 'Force' }, success: wounds(success), fail: wounds(fail) },
      wounds(post), // CONTINUATION
    ],
  };
}

describe('runCombatFlow — test enfoui + continuation after (combat)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    resetCadence();
    useGame.setState({ pendingCascade: null, battle: null, pendingLogQueue: [] });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 20, y: 20 };
    // Beaucoup de PB pour que les pertes du Flow ne mettent personne hors de combat (pas d'À Terre à 0).
    H.wounds.max = 200; H.wounds.current = 200;
    E.wounds.max = 200; E.wounds.current = 200;
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, E };
  }

  const live = (id: string): Combatant => useGame.getState().battle!.combatants.find((x) => x.id === id)!;

  it('HÉROS manuel : test enfoui → étape triggeredTest (after = le do final, non avalé)', () => {
    seedBattleRng(7);
    const { H } = setup();
    const before = live(H.id).wounds.current;

    runCombatFlow({ mode: 'combat', get: useGame.getState, set: useGame.setState, target: H, caster: H, label: 'Flux', opsCtx: { source: PORTEUR } }, flow(3, 5, 99, 7));

    // Le `do` AVANT le test est appliqué tout de suite ; le test suspend ; la continuation attend.
    expect(live(H.id).wounds.current).toBe(before - 3);
    const c = useGame.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('combat');
    const step = c.participants.find((s) => s.kind === 'triggeredTest')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy();           // pas encore lancé → influençable
    expect(step.meta?.onSuccess).toBeTruthy();
    expect(step.meta?.after).toBeTruthy();      // la continuation voyage dans le meta (sérialisable)
  });

  it('HÉROS manuel : cascadeRoll+cascadeNext joue la BRANCHE puis la continuation (Force élevée → succès)', () => {
    seedBattleRng(5);
    const { H } = setup();
    H.characteristics.force = 90; // Force élevée → Test réussi (branche success = −5)
    const before = live(H.id).wounds.current;

    runCombatFlow({ mode: 'combat', get: useGame.getState, set: useGame.setState, target: H, caster: H, label: 'Flux', opsCtx: { source: PORTEUR } }, flow(3, 5, 99, 7));
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();

    // pre(3) + branche succès(5) + continuation after(7) = 15 ; l'échec(99) n'est PAS pris.
    expect(live(H.id).wounds.current).toBe(before - (3 + 5 + 7));
  });

  it('ENNEMI : test enfoui → INLINE (branche + after), aucune étape de cascade', () => {
    seedBattleRng(5);
    const { E } = setup();
    E.characteristics.force = 90; // Force élevée → succès inline (branche success = −5)
    const before = live(E.id).wounds.current;

    runCombatFlow({ mode: 'combat', get: useGame.getState, set: useGame.setState, target: E, caster: E, label: 'Flux' }, flow(3, 5, 99, 7));

    expect(useGame.getState().pendingCascade).toBeNull(); // ennemi → jamais d'étape influençable
    // pre(3) + branche(5) + after(7) = 15, appliqués inline d'un coup.
    expect(live(E.id).wounds.current).toBe(before - (3 + 5 + 7));
    // La ligne de parité du Test (traceLineOf) + les conséquences partent dans la file différée.
    expect(useGame.getState().pendingLogQueue.length).toBeGreaterThan(0);
  });

  it('HÉROS en cadence AUTO : test enfoui → INLINE comme un monstre (pas de cascade)', () => {
    setCadence('auto');
    try {
      seedBattleRng(5);
      const { H } = setup();
      H.characteristics.force = 90;
      const before = live(H.id).wounds.current;

      runCombatFlow({ mode: 'combat', get: useGame.getState, set: useGame.setState, target: H, caster: H, label: 'Flux', opsCtx: { source: PORTEUR } }, flow(3, 5, 99, 7));

      expect(useGame.getState().pendingCascade).toBeNull(); // auto → inline
      expect(live(H.id).wounds.current).toBe(before - (3 + 5 + 7));
    } finally {
      resetCadence();
    }
  });

  /**
   * Lot 2 — voie nested cast↔test : un sous-Flow de sort SYNTHÉTIQUE `seq[ do, test, do ]` lancé via
   * `runCombatFlow` EN CONTEXTE D'INCANTATION (cascade `jet:'cast'` déjà OUVERTE par openCastCascade,
   * comme pendant un vrai `applyCast`). Le nœud `test` enfoui n'OUVRE PAS une seconde cascade : il
   * APPEND une étape `triggeredTest` à la MÊME cascade `cast` active (preuve « une seule cascade
   * enrichie »), comme Critique/Maladresse de sort. Sa validation (cascadeRoll+cascadeNext) joue la
   * branche PUIS la continuation `after` (le `do` final). C'est la machinerie que le Lot 4 utilisera
   * quand un sort portera un nœud Flow `test` ; aucun sort n'en a ENCORE → la voie est juste prête. */
  it('CONTEXTE CAST : test enfoui APPEND à la cascade `cast` ouverte (une seule cascade enrichie)', () => {
    seedBattleRng(5);
    const { H } = setup();
    H.characteristics.force = 90; // Force élevée → branche succès (−5) à la validation
    const before = live(H.id).wounds.current;

    // Ordre des sites de DÉCLARATION d'incantation (`castSpell`, et le chemin de pose de zone) : le
    // `pendingCast` — la donnée que la fenêtre rend — est posé, PUIS la cascade `jet:'cast'` l'hôte.
    // `applyCast`, lui, n'ouvre rien : il joue les effets DANS cette cascade déjà ouverte.
    useGame.setState({ pendingCast: { casterId: H.id, targetId: H.id, spellId: 'chute', missile: false, focused: false, result: null } });
    openCastCascade(useGame.getState, useGame.setState, H);
    const castCasc = useGame.getState().pendingCascade!;
    expect(castCasc.purpose).toBe('combat');
    expect(castCasc.participants).toHaveLength(1);
    expect(castCasc.participants[0].jet).toBe('cast'); // l'étape d'incantation, curseur dessus

    // Le sous-Flow du sort (avec un Test interne) joué EN CONTEXTE CAST (opsCtx propagé : sl/label).
    runCombatFlow(
      { mode: 'combat', get: useGame.getState, set: useGame.setState, target: H, caster: H, label: 'Sort', opsCtx: { sl: 2, label: 'Sort', caster: H, source: PORTEUR } },
      flow(3, 5, 99, 7),
    );

    // Le `do` AVANT le test s'applique tout de suite ; le test SUSPEND en appendant une étape à la
    // MÊME cascade (toujours `cast`, jamais une nouvelle) ; la continuation `after` attend dans le meta.
    expect(live(H.id).wounds.current).toBe(before - 3);
    const enriched = useGame.getState().pendingCascade!;
    expect(enriched.purpose).toBe('combat');
    expect(enriched.participants).toHaveLength(2); // étape `cast` + étape `triggeredTest` APPENDUE (une seule cascade)
    expect(enriched.participants[0].jet).toBe('cast');
    const step = enriched.participants[1];
    expect(step.kind).toBe('triggeredTest');
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy();        // pas encore lancé → influençable
    expect(step.meta?.after).toBeTruthy();  // la continuation voyage dans le meta (sérialisable, coop)

    // castConfirm (combatSlice:1771-1777) avance le curseur AU-DELÀ de l'étape `jet:'cast'` quand des
    // conséquences se sont appendues (`participants.length > castStepIdx + 1`) → la cascade JOUE l'étape
    // `triggeredTest`. On reproduit ce seul pas d'orchestration (le test bypass `castConfirm`).
    expect(enriched.cursor).toBe(0); // curseur encore sur l'étape `cast` (résolue par CastModal, hors test)
    useGame.setState({ pendingCascade: { ...enriched, cursor: 1 } }); // = castConfirm : cursor → castStepIdx + 1

    // Validation : la branche succès (−5) PUIS la continuation after (−7) s'appliquent.
    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();
    expect(live(H.id).wounds.current).toBe(before - (3 + 5 + 7)); // pre + branche + continuation
    expect(useGame.getState().pendingCascade).toBeNull();          // cascade enrichie close (toutes étapes jouées)
  });
});
