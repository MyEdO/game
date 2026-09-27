import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { applyMiscast } from '../combatFlow';
import { seedBattleRng } from '../battleRng';
import { avanceEtapeCascade } from '../cascadeTestKit';
import { createHero } from '../../engine/character';
import { hasCondition } from '../../engine/conditions';

import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';
import { resetCadence } from '../../engine/cadence';

/**
 * Lot 4d — les Tests imbriqués des tables d'Imparfaites/Colère (« Résistance Accessible ou Sonné »,
 * « Purifier la chair » : échec à −4 DR → Inconscient EN PLUS) ne sont PLUS des op `test` (supprimée)
 * mais des nœuds de Flow `test` portés par `MiscastResult.testFlow`, résolus CADENCE-AWARE par
 * `applyMiscast`→`runCombatFlow` :
 *  (a) lanceur HÉROS MANUEL → étape de cascade `triggeredTest` INFLUENÇABLE (Chance/Pacte/Résilience),
 *      appendue APRÈS l'étape de révélation Imparfaite/Colère ; le palier `onFailHard` (Inconscient à
 *      −4 DR) est honoré à la validation via la Condition Flow `slThreshold ≤ −4` ;
 *  (b) lanceur ENNEMI → jet INLINE (pas de cascade), branche d'échec appliquée tout de suite.
 * Plus aucun jet de héros ne se résout en silence (fin du goal).
 */
describe('Maladresse — Test imbriqué routé cadence-aware (Lot 4d)', () => {
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
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.wounds.max = 200; H.wounds.current = 200;
    E.wounds.max = 200; E.wounds.current = 200;
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, E };
  }

  const live = (id: string): Combatant => useGame.getState().battle!.combatants.find((x) => x.id === id)!;

  /** Cherche la graine de `battleRng` qui, sur une Colère de `who`, produit une entrée À TEST (« Purifier
   *  la chair », « Visions sacrées »…) → une étape `triggeredTest` apparaît dans la cascade. Renvoie la
   *  graine ; on REJOUE ensuite proprement avec elle. (Le contrecoup tire d'abord le d100 de table.) */
  function seedYieldingTest(who: 'hero' | 'enemy'): number {
    for (let s = 0; s < 300; s++) {
      const { H, E } = setup();
      seedBattleRng(s);
      applyMiscast(useGame.getState, useGame.setState, who === 'hero' ? H : E, 'colere');
      avanceEtapeCascade(useGame.getState); // le dé du Tableau tombe à SON étape : la ligne n'existe qu'après
      const casc = useGame.getState().pendingCascade;
      const hasTestStep = !!casc?.participants.some((p) => p.kind === 'triggeredTest');
      // Héros : une étape influençable (suspendue) ; Ennemi : ligne « Résistance » dans la file différée.
      const inlineTest = useGame.getState().pendingLogQueue.some((q) => /Résistance/.test(q.line));
      if (who === 'hero' ? hasTestStep : inlineTest) return s;
    }
    throw new Error('aucune graine ne produit une entrée de Colère à Test');
  }

  it('(a) lanceur HÉROS MANUEL : étape triggeredTest INFLUENÇABLE appendue APRÈS la révélation', () => {
    const seed = seedYieldingTest('hero');
    const { H } = setup();
    seedBattleRng(seed);
    applyMiscast(useGame.getState, useGame.setState, H, 'colere');
    avanceEtapeCascade(useGame.getState); // dé du Tableau → révélation + Test imbriqué appendus

    const casc = useGame.getState().pendingCascade!;
    expect(casc.purpose).toBe('combat');
    // L'identité Colère vit sur une étape `miscast` (révélation), le Test imbriqué sur une étape SUIVANTE.
    const miscastIdx = casc.participants.findIndex((p) => p.kind === 'miscast');
    const testIdx = casc.participants.findIndex((p) => p.kind === 'triggeredTest');
    expect(miscastIdx).toBeGreaterThanOrEqual(0);
    expect(testIdx).toBeGreaterThan(miscastIdx); // le Test vient APRÈS la révélation (ordre du journal)
    const step = casc.participants[testIdx];
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy();            // pas encore lancé → Chance/Pacte/Résilience possibles
    expect(step.rollLabel).toBe('Résistance');  // Test de Résistance (cadre de jet réel)
    expect(step.meta?.onFail).toBeTruthy();     // la branche d'échec voyage dans le meta (sérialisable)
  });

  it('(a bis) « Purifier la chair » HÉROS : échec à −4 DR ou moins → Inconscient EN PLUS (onFailHard)', () => {
    // On force l'entrée « Purifier la chair » (81-87, Résistance Difficile + palier onFailHard −4 DR).
    let seed = -1;
    for (let s = 0; s < 400 && seed < 0; s++) {
      const { H } = setup();
      seedBattleRng(s);
      applyMiscast(useGame.getState, useGame.setState, H, 'colere');
      avanceEtapeCascade(useGame.getState);
      const casc = useGame.getState().pendingCascade;
      const m = casc?.participants.find((p) => p.kind === 'miscast');
      if (m?.outcome?.some((l) => /Purifier la chair/.test(l.text)) && casc?.participants.some((p) => p.kind === 'triggeredTest')) seed = s;
      useGame.setState({ pendingCascade: null });
    }
    expect(seed).toBeGreaterThanOrEqual(0);

    const { H } = setup();
    seedBattleRng(seed);
    applyMiscast(useGame.getState, useGame.setState, H, 'colere');
    avanceEtapeCascade(useGame.getState);
    const p0 = useGame.getState().pendingCascade!;
    const stepIdx = p0.participants.findIndex((s) => s.kind === 'triggeredTest');
    const step = p0.participants[stepIdx];
    // FORCE un échec à −4 DR ou pire (déterministe, indépendant du RNG) : jet 99 ÉCHOUÉ, DR = −5 (≤ −4 →
    // palier `slThreshold` honoré). `result` posé sur l'étape → l'applier joue la branche d'échec entière.
    useGame.setState({
      pendingCascade: { ...p0, participants: p0.participants.map((s, k) => (k === stepIdx ? { ...s, result: { roll: 99, target: step.base ?? 30, sl: -5, success: false } } : s)) },
    });
    // Valide toutes les étapes (révélation Imparfaite committée, PUIS l'étape de Test déjà résultée) → la
    // branche d'échec : Sonné, ET le palier `slThreshold ≤ −4` : Inconscient EN PLUS.
    useGame.getState().cascadeResolveAll();
    const h = live(H.id);
    expect(hasCondition(h, 'sonne')).toBe(true);        // onFail : Sonné
    expect(hasCondition(h, 'inconscient')).toBe(true);  // onFailHard (slThreshold ≤ −4) : Inconscient EN PLUS
  });

  it('(b) lanceur ENNEMI : jet INLINE (pas de cascade), branche d’échec appliquée tout de suite', () => {
    const seed = seedYieldingTest('enemy');
    const { E } = setup();
    E.characteristics.endurance = 1; // Résistance minimale → échec quasi sûr → Sonné posé inline
    seedBattleRng(seed);
    applyMiscast(useGame.getState, useGame.setState, E, 'colere');
    // La table de l'ennemi naît RÉSOLUE (nul siège ne le tient) ; la jouer dénoue tout, sans jamais
    // ouvrir d'étape INFLUENÇABLE : le Test imbriqué se roule inline.
    expect(useGame.getState().pendingCascade!.participants[0].table!.result).toBeTruthy();
    avanceEtapeCascade(useGame.getState);
    expect(useGame.getState().pendingCascade?.participants.some((p) => p.kind === 'triggeredTest') ?? false).toBe(false);
    // La ligne de parité du Test (traceLineOf) part dans la file différée.
    expect(useGame.getState().pendingLogQueue.some((q) => /Résistance/.test(q.line))).toBe(true);
  });
});
