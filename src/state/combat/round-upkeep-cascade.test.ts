import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { openRoundEndCascade } from '../combatFlow';
import { startCascade } from '../cascade';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { seedBattleRng } from '../battleRng';
import { addCondition, stacks, hasCondition, endOfRound, COND } from '../../engine/conditions';
import { fireConditionEffects } from '../triggeredEffects';
import { setRule, resetRule } from '../../engine/policy';
import { testScene } from '../../scenes/test-fixture';
import { resetCadence, setCadence } from '../../engine/cadence';
import { runCombatHooks } from '../combatHooks';
import './roundHooks';

/**
 * Jets d'upkeep de fin de Round concernant un HÉROS → étapes de CASCADE influençable (Mâchoires
 * d'acier / récupération du Brisé / se-fatiguer). On vérifie : (a) un héros DÛ ouvre une cascade de
 * fin de Round avec la bonne étape (kind), non encore lancée ; (b) l'ENNEMI équivalent reste résolu
 * EN SILENCE (jamais une étape de cascade) ; (c) la validation applique bien la conséquence.
 */
describe('Upkeep de fin de Round — héros en cascade, ennemis en silence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    resetRule('combat-se-fatiguer');
    useGame.setState({ pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source ennemie
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 20, y: 20 }; // loin (pas de Peur de Taille, LoS dégagée)
    useGame.setState({ battle: { ...b }, pendingCascade: null });
    return { H, E };
  }

  // (Mâchoires d'acier n'est plus un Test de FIN de Round : c'est un effet `onGainCondition` data-driven,
  //  déclenché À L'ACQUISITION du Sonné — couvert par `triggered-test.test.ts` (brique cadence-aware).)

  it('Récupération du Brisé : héros Brisé (non Engagé) → étape de Test (Calme) ; succès retire ≥ 1 Brisé', () => {
    seedBattleRng(2); // seed donnant une réussite du Calme (le −10 du Brisé lui-même s'applique, LDB 16 l.52)
    const { H } = setup();
    H.characteristics['force-mentale'] = 95; // Calme élevé → Test réussi malgré le −10 de l'État Brisé
    addCondition(H, COND.brise, 2);

    openRoundEndCascade(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade!;
    // Récupération du Brisé en DONNÉES (etats.json) → étape GÉNÉRIQUE `triggeredTest` (plus de kind dédié).
    const step = c.participants.find((s) => s.kind === 'triggeredTest' && s.rollLabel === 'Calme')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);

    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(stacks(h, COND.brise)).toBeLessThan(2); // au moins 1 Brisé retiré
  });

  it('Se-fatiguer : héros au seuil → étape fatigue (règle ON) ; rien si la règle est OFF', () => {
    const { H } = setup();
    H.effortRounds = 9; // bien au-dessus du seuil (Bonus d'Endurance)

    // Règle OFF (défaut) : aucune étape de fatigue.
    openRoundEndCascade(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingCascade).toBeNull();

    // Règle ON : étape de fatigue émise pour le héros.
    setRule('combat-se-fatiguer', true);
    openRoundEndCascade(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade!;
    const step = c.participants.find((s) => s.kind === 'fatigue')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);
  });

  it('Empoisonné : héros → étape poisonResist (influençable, non lancée) ; ennemi JAMAIS une étape (silence)', () => {
    seedBattleRng(3);
    const { H, E } = setup();
    addCondition(H, COND.empoisonne, 2);
    addCondition(E, COND.empoisonne, 2);

    openRoundEndCascade(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('combat');
    expect(c.roundBoundary).toBe(true);
    // UNE seule étape de récupération (le héros) — l'ennemi n'est JAMAIS une étape (silence côté hook).
    expect(c.participants).toHaveLength(1);
    const step = c.participants[0];
    expect(step.kind).toBe('triggeredTest'); // étape GÉNÉRIQUE data-driven (plus de kind `poisonResist` par-nom)
    expect(step.actorId).toBe(H.id);
    expect(step.rollLabel).toBe('Résistance');
    expect(step.result).toBeFalsy(); // pas encore lancé → influençable (Chance/Résilience)
    expect(c.participants.some((s) => s.actorId === E.id)).toBe(false);
  });

  it('Empoisonné : la validation de l’étape applique le retrait (E élevé → Résistance réussie + Exténué)', () => {
    seedBattleRng(5); // graine où le Test (cible 85) réussit (roll 9)
    const { H } = setup();
    H.characteristics.endurance = 90; // Endurance élevée → Test de Résistance réussi
    addCondition(H, COND.empoisonne, 1);

    openRoundEndCascade(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade!;
    const step = c.participants.find((s) => s.kind === 'triggeredTest')!;
    expect(step).toBeTruthy();

    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(hasCondition(h, COND.empoisonne)).toBe(false); // poison surmonté (branche success de la donnée : retire 1+DR)
    expect(hasCondition(h, COND.extenue)).toBe(true);      // … vidé → 1 Exténué (LDB 16 l.72, via `if`/`condition`)
  });

  it('Sonné data-driven : héros → étape triggeredTest ; succès → Sonné vidé + 1 Exténué (RAW l.125-129)', () => {
    seedBattleRng(5);
    const { H } = setup();
    H.characteristics.endurance = 90; // Résistance haute → réussite
    addCondition(H, COND.sonne, 1);

    openRoundEndCascade(useGame.getState, useGame.setState);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    expect(step).toBeTruthy();
    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(hasCondition(h, COND.sonne)).toBe(false);  // 1+DR retiré → vidé
    expect(hasCondition(h, COND.extenue)).toBe(true); // vidé → 1 Exténué
  });

  it('Sonné : caveat RAW « 1 Exténué si pas déjà » — déjà Exténué → la Résistance vide le Sonné SANS empiler d’Exténué (l.127)', () => {
    const { H } = setup();
    H.characteristics.endurance = 90;
    addCondition(H, COND.sonne, 1);
    addCondition(H, COND.extenue, 1); // DÉJÀ Exténué
    // Résolution INLINE (hors cascade) avec un jet réussi forcé → on isole le caveat sur l’Exténué.
    fireConditionEffects(useGame.getState, H, 'onRoundEnd', { rng: { int: () => 1 } as never });
    expect(hasCondition(H, COND.sonne)).toBe(false); // Sonné vaincu
    expect(stacks(H, COND.extenue)).toBe(1);         // PAS de 2ᵉ Exténué (caveat `if all[sonne<=0, extenue<=0]`)
  });

  it('Empoisonné data-driven : fireConditionEffects applique les DÉGÂTS puis résout le Test de Résistance INLINE (hors-combat, RAW l.66-72)', () => {
    const { H } = setup();
    addCondition(H, COND.empoisonne, 2);
    const hpBefore = H.wounds.current;
    endOfRound(H, makeRNG(1));                             // endOfRound ne touche plus le poison (ni dégâts ni Test)
    expect(H.wounds.current).toBe(hpBefore);              // endOfRound seul : rien
    // Sans `set` (= entretien HORS COMBAT) : le dispatcher applique les dégâts PUIS résout le Test inline.
    // RNG forcé à l'ÉCHEC (jet 99) → la Résistance rate, le poison persiste : on isole les dégâts.
    fireConditionEffects(useGame.getState, H, 'onRoundEnd', { rng: { int: () => 99 } as never });
    expect(H.wounds.current).toBe(hpBefore - 2);          // 2 Blessures subies (Empoisonné×2), dégâts data-driven
    expect(stacks(H, COND.empoisonne)).toBe(2);           // Résistance ratée → aucun pion retiré
    expect(hasCondition(H, COND.extenue)).toBe(false);    // poison non vidé → pas d'Exténué
  });

  it('cadence AUTO : un héros empoisonné N’ouvre PAS d’étape de cascade (auto-résolu comme un monstre — `surfaceOf` exige la cadence manuelle)', () => {
    setCadence('auto');
    try {
      const { H } = setup();
      addCondition(H, COND.empoisonne, 1);
      openRoundEndCascade(useGame.getState, useGame.setState);
      const c = useGame.getState().pendingCascade;
      // En rapide/auto le héros est joué/auto-résolu → son Test ne passe PAS par la cascade (résolu inline).
      expect(c?.participants.some((s) => s.kind === 'triggeredTest')).toBeFalsy();
    } finally {
      resetCadence();
    }
  });

  /**
   * Anti DOUBLE-RÉSOLUTION (#918 phase 2a) : le hook inline (`se-fatiguer`, roundHooks) et l'étape de
   * cascade (`collectHeroRoundEndUpkeep`) sont EXCLUSIFS — le gate `surfaceOf` du hook ROUTE, il
   * ne fait pas que protéger le jet. La séquence réelle est jouée (hooks PUIS collecte), aux DEUX
   * cadences : Exténué ne doit jamais s'empiler deux fois pour un seul franchissement de Round.
   */
  for (const cad of ['manuel', 'auto'] as const) {
    it(`se-fatiguer, cadence ${cad} : UNE seule application de l’Exténué (hook inline XOR étape de cascade)`, () => {
      seedBattleRng(4);
      const { H } = setup();
      setRule('combat-se-fatiguer', true);
      setCadence(cad);
      try {
        H.characteristics.endurance = 1; // seuil d'effort bas + Résistance ratée garantie (cible ≤ 1)
        H.effortRounds = 9;
        const battle = useGame.getState().battle!;
        runCombatHooks('onRoundEnd', { get: useGame.getState, set: useGame.setState, battle, sink: () => {} } as never);
        openRoundEndCascade(useGame.getState, useGame.setState);
        const step = useGame.getState().pendingCascade?.participants.find((s) => s.kind === 'fatigue');
        // Cadence manuelle → l'étape existe (le hook a sauté le héros) ; en auto → aucune étape (hook inline).
        expect(!!step).toBe(cad === 'manuel');
        if (step) {
          useGame.getState().cascadeRoll(step.id);
          useGame.getState().cascadeNext();
        }
        const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
        expect(stacks(h, COND.extenue)).toBe(1); // jamais 2 : une seule voie a résolu le Test
      } finally {
        resetRule('combat-se-fatiguer');
        resetCadence();
      }
    });
  }

  // Deux BORNES de dénouement sur la MÊME séquence (#942 L1 : `startCascade` appende à même `purpose`
  // au lieu d'écraser → une séquence FUSIONNÉE porte la borne de Round ET la reprise de tour). La chaîne
  // `else if` de `dispatchCascadeDone` n'en jouait qu'UNE, dans un ordre qui affamait la reprise de tour.
  it('bornes FUSIONNÉES : la reprise du tour (maneuverResume) passe AVANT la pause de début de Round', () => {
    seedBattleRng(4);
    const { H, E } = setup();
    // Fragment 1 : la séquence de fin de Round, telle que l'ouvre `openRoundEndCascade` (combatFlow).
    startCascade(useGame.getState, useGame.setState, {
      title: 'Fin de Round', icon: 'time/clock', purpose: 'combat', roundBoundary: true,
      steps: [{ id: 'fear', kind: 'note', actorId: H.id, outcome: [{ text: 'Peur de fin de Round' }]}],
    });
    // Fragment 2 : la défense de manœuvre de zone de la créature, appendue à la séquence en vol.
    startCascade(useGame.getState, useGame.setState, {
      title: 'Manœuvre', purpose: 'combat',
      steps: [{ id: 'zone-def', kind: 'note', actorId: H.id, outcome: [{ text: 'Défense de zone' }]}],
    });
    const merged = useGame.getState().pendingCascade!;
    expect(merged.participants.map((s) => s.id)).toEqual(['fear', 'zone-def']); // fusion, aucun fragment perdu
    // `maneuverResume` est posé par son UNIQUE producteur de la même façon (combatManeuvers.ts:461/:506 :
    // tag sur la séquence `purpose:'combat'` en cours).
    useGame.setState({ pendingCascade: { ...merged, maneuverResume: { attackerId: E.id, free: true } } });
    vi.clearAllTimers();

    useGame.getState().cascadeResolveAll();
    useGame.getState().cascadeFinish(); // « Terminer » → dispatchCascadeDone

    // La reprise de tour a joué : la machinerie de tours est RÉ-ARMÉE (timer d'avance posé) et la pause
    // de début de Round n'a PAS gelé le combat. Précédence `maneuverResume` > `roundBoundary` (#942 L1,
    // site canonique `dispatchCascadeDone`, `state/combatSlice.ts`) : cette pause et son reset per-Round
    // sont SACRIFIÉS pour le Round courant — les décomptes de fin de Round, eux, ont déjà été joués par
    // `advanceTurn` AVANT l'ouverture de la séquence.
    expect(useGame.getState().pendingRoundStart, 'la pause de Round ne doit pas geler la reprise de tour').toBeNull();
    expect(vi.getTimerCount(), 'la machinerie de tours doit avoir la main').toBeGreaterThan(0);
    expect(useGame.getState().battle!.turn).not.toBe(-1); // `enterRoundStartPause` aurait posé turn -1
  });
});
