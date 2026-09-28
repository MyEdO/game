import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import '../combatFlow'; // effet de bord : installe l'applier `triggeredTest`, le routeur + le hook onGainCondition
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';
import { addCondition, stacks, hasCondition, combatTestPenalty, COND } from '../../engine/conditions';
import { rawCombatTestBase, skillBaseValue } from '../../engine/skills';
import { inexplique } from '../cascadeTestKit';
import { DIFFICULTY_MODIFIERS } from '../../engine/types';

import { testScene } from '../../scenes/test-fixture';
import { resetCadence, setCadence } from '../../engine/cadence';

/**
 * Mâchoires d'acier (LDB 10) en effet DÉCLENCHÉ `onGainCondition` data-driven, résolu cadence-aware
 * par la brique `combat/triggeredTest` : « chaque fois que vous gagnez un État Sonné… Test de
 * Résistance Intermédiaire → ignore 1 + DR ». On vérifie : (a) héros MANUEL gagnant Sonné en combat →
 * étape de cascade `triggeredTest` NON lancée (influençable) puis `cascadeRoll`+`cascadeNext` retire
 * 1 + DR ; (b) ENNEMI avec Mâchoires → résolu INLINE (jamais d'étape de cascade) ; (c) le filtre
 * `condition` : gagner un AUTRE État (Empoisonné) ne déclenche PAS Mâchoires.
 */
describe('Mâchoires d’acier — effet onGainCondition cadence-aware (brique triggeredTest)', () => {
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
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, E };
  }

  it('héros MANUEL gagne Sonné → étape de cascade triggeredTest (non lancée, influençable)', () => {
    seedBattleRng(7);
    const { H } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];

    addCondition(H, COND.sonne, 2); // déclenche onGainCondition → routé en cascade (héros manuel)

    const c = useGame.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('combat');
    expect(c.participants).toHaveLength(1);
    const step = c.participants[0];
    expect(step.kind).toBe('triggeredTest');
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy(); // pas encore lancé → Chance/Résilience possibles
    expect(step.meta?.onSuccess).toBeTruthy(); // la conséquence voyage dans le meta (sérialisable, coop)
    expect(step.meta?.onFail).toBeTruthy();
  });

  it('RAW : la pénalité d’État (Sonné ×2 = −20) est comptée UNE seule fois dans le Test (≠ testValue + combatTestPenalty = −40)', () => {
    seedBattleRng(7);
    const { H } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];
    // Effet ACTIF char-QUALIFIÉ : il vit dans la valeur TESTÉE de combat et PAS dans la valeur NUE. Sans
    // lui, `base` vaudrait `rawCombatTestBase` par coïncidence et l'assert ne discriminerait rien.
    H.activeEffects = [...(H.activeEffects ?? []), { id: 'fx-e', label: 'Mystracine', testModChar: 'endurance', testMod: -10 } as never];
    addCondition(H, COND.sonne, 2); // H porte Sonné AU MOMENT du Test → ancien double-compte de la pénalité
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    const nue = skillBaseValue(H, 'resistance');
    expect(nue, 'sonde inerte : sans écart nue/valeur testée, l’assert passerait par coïncidence').not.toBe(rawCombatTestBase(H, 'resistance'));
    // `base` = Niveau de Compétence NU (`LDB 09 l.17`) ; `target` = valeur TESTÉE de combat + Intermédiaire(0)
    // + `combatTestPenalty` (UNE fois) ; tout l'écart entre les deux est NOMMÉ en `mods` (zéro chip anonyme).
    expect(step.base).toBe(nue);
    expect(step.target).toBe(rawCombatTestBase(H, 'resistance') + DIFFICULTY_MODIFIERS.intermediaire + combatTestPenalty(H));
    expect(inexplique(step)).toBe(0);
    expect(combatTestPenalty(H)).toBe(-20); // 2 pions de Sonné : −10 par pion (LDB 16 l.11) — comptés une fois
  });

  it('héros MANUEL : cascadeRoll + cascadeNext retire 1 + DR États Sonné (Résistance réussie)', () => {
    seedBattleRng(5);
    const { H } = setup();
    H.characteristics.endurance = 90; // Endurance élevée → Test de Résistance réussi
    H.talents = [...(H.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];

    addCondition(H, COND.sonne, 2);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'triggeredTest')!;
    expect(step).toBeTruthy();

    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(stacks(h, COND.sonne)).toBeLessThan(2); // au moins 1 Sonné retiré (1 + DR)
  });

  it('ENNEMI avec Mâchoires gagne Sonné → résolu INLINE (jamais d’étape de cascade)', () => {
    seedBattleRng(5);
    const { E } = setup();
    E.characteristics.endurance = 90; // Résistance réussie → retrait inline
    E.talents = [...(E.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];

    addCondition(E, COND.sonne, 2); // ennemi → branche inline (jamais de cascade)

    expect(useGame.getState().pendingCascade).toBeNull(); // AUCUNE étape de cascade pour un ennemi
    const e = useGame.getState().battle!.combatants.find((x) => x.id === E.id)!;
    expect(stacks(e, COND.sonne)).toBeLessThan(2); // Sonné retiré inline (Résistance réussie)
    // La ligne de journal de l'effet inline part dans la file différée (drainée au rendu).
    expect(useGame.getState().pendingLogQueue.length).toBeGreaterThan(0);
  });

  it('filtre `condition` : un héros qui gagne un AUTRE État (Empoisonné) ne déclenche PAS Mâchoires', () => {
    seedBattleRng(7);
    const { H } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];

    addCondition(H, COND.empoisonne, 1); // gain d'un AUTRE État → le filtre `condition:'sonne'` bloque

    expect(useGame.getState().pendingCascade).toBeNull(); // pas de Mâchoires (condition ≠ sonne)
    expect(hasCondition(H, COND.empoisonne)).toBe(true);   // l'Empoisonné est bien posé
  });

  it('héros en cadence AUTO gagne Sonné → résolu INLINE (auto-piloté comme un monstre, pas de cascade)', () => {
    setCadence('auto');
    try {
      seedBattleRng(5);
      const { H } = setup();
      H.characteristics.endurance = 90;
      H.talents = [...(H.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];

      addCondition(H, COND.sonne, 2);

      expect(useGame.getState().pendingCascade).toBeNull(); // auto → pas d'étape influençable
      const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
      expect(stacks(h, COND.sonne)).toBeLessThan(2); // retrait inline
    } finally {
      resetCadence();
    }
  });
});
