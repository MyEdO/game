import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { runCombatFlow } from './triggeredTest';
import { openCastCascade } from '../combatFlow'; // effet de bord : installe l'applier `testDeclenche` + le routeur + le hook onGainCondition
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';

import { testScene } from '../../scenes/test-fixture';
import type { Flow } from '../../data/schemas/defs-scenes/effets';
import type { Combatant } from '../../engine/types';
import { setCadence } from '../../engine/cadence';
import { blessuresDeBase } from '../../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * runCombatFlow — exécuteur à PILE d'un Flow EN COMBAT, cadence-aware, qui porte la CONTINUATION `after`.
 * Sur un nœud `test` ENFOUI dans un `sequence` :
 *  - HÉROS manuel → pousse une étape de cascade `testDeclenche` (influençable) dont le `meta.after` est
 *    le reste du `sequence` (le `effet` qui suivait) ; `jetLancer('cascade', id)`+`jetValider('cascade')` joue la BRANCHE puis le `effet`
 *    de continuation (preuve que `after` est repris) ;
 *  - ENNEMI → jet INLINE + branche + `after`, SANS étape de cascade.
 * Jumeau de `run-flow.hors-store.test` (scène) et de `round-upkeep-cascade.hors-store.test` (cascade).
 */
/** ENTITÉ PORTEUSE du Flow joué, comme en production : c'est d'elle que le Test muet DÉRIVE son enjeu
 *  (#1262 V2 L6d) — un Flow de combat n'est jamais orphelin, il est l'œuvre de quelque chose. */
const PORTEUR = { kind: 'sort', id: 'chute' } as const;

const wounds = (amount: number): Flow => ({ kind: 'effet', effet: { type: 'ops', on: 'target', ops: [{ op: 'wounds', amount }] } });

/** Flow `sequence[ effet(−pre PB), test{F → reussite/echec}, effet(−post PB) ]` — le `effet` final est la CONTINUATION
 *  `after` qui doit s'appliquer APRÈS la branche (jamais avalée par le test). */
function flow(pre: number, success: number, fail: number, post: number): Flow {
  return {
    kind: 'sequence',
    etapes: [
      wounds(pre),
      { kind: 'test', test: { characteristic: 'force', label: 'Force' }, reussite: wounds(success), echec: wounds(fail) },
      wounds(post), // CONTINUATION
    ],
  };
}

describe('runCombatFlow — test enfoui + continuation after (combat)', () => {
  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 20, y: 20 };
    // Beaucoup de PB pour que les pertes du Flow ne mettent personne hors de combat (pas d'À Terre à 0).
    H.wounds = blessuresDeBase(200, 200, H);
    E.wounds = blessuresDeBase(200, 200, E);
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, E };
  }

  const live = (id: string): Combatant => banc.getState().battle!.combatants.find((x) => x.id === id)!;

  it('HÉROS manuel : test enfoui → étape testDeclenche (after = le do final, non avalé)', () => {
    seedBattleRng(7);
    const { H } = setup();
    const before = live(H.id).wounds.current;

    runCombatFlow({ get: banc.getState, set: banc.setState, target: H, caster: H, label: 'Flux', opsCtx: { source: PORTEUR } }, flow(3, 5, 99, 7));

    // Le `effet` AVANT le test est appliqué tout de suite ; le test suspend ; la continuation attend.
    expect(live(H.id).wounds.current).toBe(before - 3);
    const c = banc.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('combat');
    const step = c.participants.find((s) => s.kind === 'testDeclenche')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy();           // pas encore lancé → influençable
    expect(step.meta?.onSuccess).toBeTruthy();
    expect(step.meta?.after).toBeTruthy();      // la continuation voyage dans le meta (sérialisable)
  });

  it('HÉROS manuel : jetLancer@cascade+jetValider@cascade joue la BRANCHE puis la continuation (Force élevée → succès)', () => {
    seedBattleRng(5);
    const { H } = setup();
    H.characteristics.force = 90; H.wounds = blessuresDeBase(200, 200, H); // Force élevée → Test réussi (branche success = −5)
    const before = live(H.id).wounds.current;

    runCombatFlow({ get: banc.getState, set: banc.setState, target: H, caster: H, label: 'Flux', opsCtx: { source: PORTEUR } }, flow(3, 5, 99, 7));
    const step = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'testDeclenche')!;
    banc.getState().jetLancer('cascade', step.id);
    banc.getState().jetValider('cascade');

    // pre(3) + branche succès(5) + continuation after(7) = 15 ; l'échec(99) n'est PAS pris.
    expect(live(H.id).wounds.current).toBe(before - (3 + 5 + 7));
  });

  // combatEffects.ts:123 (`drainPendingLog`) · cascade.ts:1339 (`consequences`)
  it('HÉROS manuel : les lignes de la continuation rejoignent les conséquences de l’étape, la file différée est vide', () => {
    seedBattleRng(5);
    const { H } = setup();
    H.characteristics.force = 90; H.wounds = blessuresDeBase(200, 200, H);
    runCombatFlow({ get: banc.getState, set: banc.setState, target: H, caster: H, label: 'Flux', opsCtx: { source: PORTEUR } }, flow(3, 5, 99, 7));
    const step = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'testDeclenche')!;
    banc.setState({ pendingLogQueue: [] });
    banc.getState().jetLancer('cascade', step.id);
    banc.getState().jetValider('cascade');

    expect(banc.getState().pendingLogQueue).toEqual([]);
    expect(banc.getState().battle!.log.map((e) => e.text).slice(-2)).toEqual([
      'H subit 5 Blessure(s) (ignorant BE et PA).',
      'H subit 7 Blessure(s) (ignorant BE et PA).',
    ]);
  });

  it('ENNEMI : test enfoui → INLINE (branche + after), aucune étape de cascade', () => {
    seedBattleRng(5);
    const { E } = setup();
    E.characteristics.force = 90; E.wounds = blessuresDeBase(200, 200, E); // Force élevée → succès inline (branche success = −5)
    const before = live(E.id).wounds.current;

    runCombatFlow({ get: banc.getState, set: banc.setState, target: E, caster: E, label: 'Flux' }, flow(3, 5, 99, 7));

    expect(banc.getState().pendingCascade).toBeNull(); // ennemi → jamais d'étape influençable
    // pre(3) + branche(5) + after(7) = 15, appliqués inline d'un coup.
    expect(live(E.id).wounds.current).toBe(before - (3 + 5 + 7));
    // La ligne de parité du Test (traceLineOf) + les conséquences partent dans la file différée.
    expect(banc.getState().pendingLogQueue.length).toBeGreaterThan(0);
  });

  it('HÉROS en cadence AUTO : test enfoui → INLINE comme un monstre (pas de cascade)', () => {
    setCadence('auto');
    seedBattleRng(5);
    const { H } = setup();
    H.characteristics.force = 90; H.wounds = blessuresDeBase(200, 200, H);
    const before = live(H.id).wounds.current;

    runCombatFlow({ get: banc.getState, set: banc.setState, target: H, caster: H, label: 'Flux', opsCtx: { source: PORTEUR } }, flow(3, 5, 99, 7));

    expect(banc.getState().pendingCascade).toBeNull(); // auto → inline
    expect(live(H.id).wounds.current).toBe(before - (3 + 5 + 7));
  });

  /**
   * Lot 2 — voie nested cast↔test : un sous-Flow de sort SYNTHÉTIQUE `seq[ do, test, do ]` lancé via
   * `runCombatFlow` EN CONTEXTE D'INCANTATION (cascade `jet:'incantation'` déjà OUVERTE par openCastCascade,
   * comme pendant un vrai `applyCast`). Le nœud `test` enfoui n'OUVRE PAS une seconde cascade : il
   * APPEND une étape `testDeclenche` à la MÊME cascade `cast` active (preuve « une seule cascade
   * enrichie »), comme Critique/Maladresse de sort. Sa validation (jetLancer('cascade', id)+jetValider('cascade')) joue la
   * branche PUIS la continuation `after` (le `effet` final). C'est la machinerie que le Lot 4 utilisera
   * quand un sort portera un nœud Flow `test` ; aucun sort n'en a ENCORE → la voie est juste prête. */
  it('CONTEXTE CAST : test enfoui APPEND à la cascade `cast` ouverte (une seule cascade enrichie)', () => {
    seedBattleRng(5);
    const { H } = setup();
    H.characteristics.force = 90; H.wounds = blessuresDeBase(200, 200, H); // Force élevée → branche succès (−5) à la validation
    const before = live(H.id).wounds.current;

    // Ordre des sites de DÉCLARATION d'incantation (`castSpell`, et le chemin de pose de zone) : le
    // `pendingCast` — la donnée que la fenêtre rend — est posé, PUIS la cascade `jet:'incantation'` l'hôte.
    // `applyCast`, lui, n'ouvre rien : il joue les effets DANS cette cascade déjà ouverte.
    banc.setState({ pendingCast: { casterId: H.id, targetId: H.id, spellId: 'chute', missile: false, focused: false, result: null } });
    openCastCascade(banc.getState, banc.setState, H);
    const castCasc = banc.getState().pendingCascade!;
    expect(castCasc.purpose).toBe('combat');
    expect(castCasc.participants).toHaveLength(1);
    expect(castCasc.participants[0].jet).toBe('incantation'); // l'étape d'incantation, curseur dessus

    // Le sous-Flow du sort (avec un Test interne) joué EN CONTEXTE CAST (opsCtx propagé : sl/label).
    runCombatFlow(
      { get: banc.getState, set: banc.setState, target: H, caster: H, label: 'Sort', opsCtx: { sl: 2, label: 'Sort', caster: H, source: PORTEUR } },
      flow(3, 5, 99, 7),
    );

    // Le `effet` AVANT le test s'applique tout de suite ; le test SUSPEND en appendant une étape à la
    // MÊME cascade (toujours `cast`, jamais une nouvelle) ; la continuation `after` attend dans le meta.
    expect(live(H.id).wounds.current).toBe(before - 3);
    const enriched = banc.getState().pendingCascade!;
    expect(enriched.purpose).toBe('combat');
    expect(enriched.participants).toHaveLength(2); // étape `cast` + étape `testDeclenche` APPENDUE (une seule cascade)
    expect(enriched.participants[0].jet).toBe('incantation');
    const step = enriched.participants[1];
    expect(step.kind).toBe('testDeclenche');
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy();        // pas encore lancé → influençable
    expect(step.meta?.after).toBeTruthy();  // la continuation voyage dans le meta (sérialisable, coop)

    // jetValider('incantation') (combatSlice:1771-1777) avance le curseur AU-DELÀ de l'étape `jet:'incantation'` quand des
    // conséquences se sont appendues (`participants.length > castStepIdx + 1`) → la cascade JOUE l'étape
    // `testDeclenche`. On reproduit ce seul pas d'orchestration (le test bypass `jetValider('incantation')`).
    expect(enriched.cursor).toBe(0); // curseur encore sur l'étape `cast` (résolue par CastModal, hors test)
    banc.setState({ pendingCascade: { ...enriched, cursor: 1 } }); // = jetValider('incantation') : cursor → castStepIdx + 1

    // Validation : la branche succès (−5) PUIS la continuation after (−7) s'appliquent.
    banc.getState().jetLancer('cascade', step.id);
    banc.getState().jetValider('cascade');
    expect(live(H.id).wounds.current).toBe(before - (3 + 5 + 7)); // pre + branche + continuation
    expect(banc.getState().pendingCascade).toBeNull();          // cascade enrichie close (toutes étapes jouées)
  });

  // flowEval.ts `combatConditionCtx` : SOURCE UNIQUE du `ConditionCtx`, nœud `si` d'un Flow routé compris.
  it('nœud `if` d’un Flow routé : la Condition `engagedAdvantageLead` lit l’avance RÉELLE de l’`OpsCtx`', () => {
    const { H } = setup();
    const before = live(H.id).wounds.current;
    const enTete: Flow = { kind: 'si', condition: { kind: 'engagedAdvantageLead', op: '>', value: 0 }, alors: wounds(4), sinon: wounds(1) };

    runCombatFlow({ get: banc.getState, set: banc.setState, target: H, caster: H, label: 'Flux', opsCtx: { source: PORTEUR, engagedAdvantageLead: 2 } }, enTete);

    expect(live(H.id).wounds.current).toBe(before - 4);
  });
});
