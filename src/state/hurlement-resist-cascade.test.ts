/**
 * PROBE — Hurlement fantomatique (LDB 85, `defense:'resist'`) sur un héros MANUEL : le « Test de
 * Résistance ou Brisé » est un nœud Flow `test` dans `def.effects` (maneuvers.json), routé par le
 * testRouter → étape de cascade `triggeredTest` INFLUENÇABLE. VÉRIFIE que le chemin RÉEL (attaque
 * gratuite IA → `aiCreatureFreeAttacks`) : (1) ouvre l'étape influençable (Brisé DIFFÉRÉ), (2) SUSPEND
 * le tour, (3) reprend proprement à la fermeture (pas de double, pas d'orphelin).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { aiCreatureFreeAttacks } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

import type { Combatant } from '../engine/types';
import { resetCadence } from '../engine/cadence';

describe('Hurlement fantomatique — Test de Résistance influençable (héros manuel)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); useGame.setState({ battle: null, pendingCascade: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); });

  function setup() {
    const H1 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H1', seed: 1 });
    const H2 = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H2', seed: 2 });
    useGame.setState({ party: [H1, H2] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    useGame.getState().seedRng(2);
    const b = useGame.getState().battle!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    E.traits = [{ id: 'hurlement-fantomatique' }]; E.advantage = 4; E.characteristics.initiative = 40; // portée 20 m
    E.pos = { x: 5, y: 5 };
    for (const h of b.combatants.filter((c) => c.kind === 'hero')) {
      h.wounds = { current: 40, max: 40, base: 40 } as Combatant['wounds'];
      h.characteristics.endurance = 1; // Résistance minime → échec quasi certain → Brisé attendu sur validation
      h.skills = h.skills.filter((s) => s.id !== 'resistance');
      h.conditions = [];
    }
    b.combatants.find((c) => c.label === 'H1')!.pos = { x: 6, y: 5 };
    b.combatants.find((c) => c.label === 'H2')!.pos = { x: 5, y: 6 };
    useGame.setState({ battle: { ...b, acted: true } });
    return { E };
  }

  it('ouvre une cascade de Test de Résistance INFLUENÇABLE, SUSPEND le tour, Brisé DIFFÉRÉ', () => {
    const { E } = setup();
    const suspended = aiCreatureFreeAttacks(useGame.getState, useGame.setState, E);

    // (2) le tour SUSPEND (une cascade est ouverte → l'appelant ne doit pas avancer).
    expect(suspended, 'le Hurlement ouvre un Test de Résistance influençable → le tour DOIT suspendre').toBe(true);
    const p = useGame.getState().pendingCascade;
    expect(p, 'une cascade de Test de Résistance doit être ouverte').toBeTruthy();
    expect(p!.purpose).toBe('combat');
    // (1) étapes `triggeredTest` influençables (Résistance), non encore lancées (result falsy).
    const tt = p!.participants.filter((s) => s.kind === 'triggeredTest');
    expect(tt.length, 'une étape de Résistance influençable par héros vivant').toBeGreaterThanOrEqual(1);
    for (const s of tt) { expect(s.result).toBeFalsy(); expect(s.target).toBeGreaterThan(0); }
    // Brisé DIFFÉRÉ : aucun héros n'est encore Brisé (les 1d10 auto sont appliqués, pas le Brisé).
    const live = () => useGame.getState().battle!.combatants;
    for (const h of live().filter((c) => c.kind === 'hero')) {
      expect(h.conditions.some((c) => c.id === 'brise'), `${h.label} ne doit PAS être Brisé avant validation`).toBe(false);
    }

    // Drive la cascade : chaque étape (Résistance ratée) → Brisé à la validation.
    let guard = 0;
    while (useGame.getState().pendingCascade && guard++ < 20) {
      const pc = useGame.getState().pendingCascade!;
      const cur = pc.participants[pc.cursor];
      if (cur && cur.target != null && !cur.result) useGame.getState().cascadeRoll(cur.id);
      useGame.getState().cascadeNext();
    }
    // (3) reprise propre : cascade fermée (pas d'orphelin).
    expect(useGame.getState().pendingCascade, 'la cascade doit se fermer proprement').toBeNull();
    // Brisé appliqué sur échec de Résistance + Assourdi (continuation `after`).
    const brise = live().filter((c) => c.kind === 'hero' && c.conditions.some((x) => x.id === 'brise'));
    expect(brise.length, 'Résistance ratée → Brisé appliqué à la validation').toBeGreaterThanOrEqual(1);
  });

  it('après l’ATTAQUE PRINCIPALE : le Hurlement gratuit APPEND ses Tests DERRIÈRE l’étape défense — le curseur AVANCE (anti soft-lock)', () => {
    // Séquence PRODUCTION : attaque de mêlée (étape `defenseJet` résolue) → `defenseConfirm` →
    // `aiCreatureFreeAttacks` → Hurlement gratuit → son nœud `test` APPEND des `triggeredTest` DERRIÈRE
    // la défense (via pushCombatStep, ≠ maybeOpenDefense qui REMPLACE). Sans avance du curseur, la fenêtre
    // reste bloquée sur la défense résolue (pendingDefense null → `useDefenseJetProps` rend null = vide).
    const { E } = setup();
    const b = useGame.getState().battle!;
    const H1 = b.combatants.find((c) => c.label === 'H1')!;
    E.pos = { x: 6, y: 5 }; // adjacent à H1 (attaque de mêlée)
    // Défense de l'attaque principale DÉJÀ résolue (raté → pas de Critique/Maladresse à folder) : on la pose
    // comme en jeu (calque store.test.ts) puis on valide → la reprise déclenche le Hurlement gratuit.
    const result = {
      hit: false, attackerRoll: 55, netSL: 0, critical: false, advantageTo: null, defenderDefeated: false,
      attackerDetail: { label: 'CC', base: 40, modifier: 0, target: 40, roll: 55, success: false, sl: -1 },
      defenderDetail: { label: 'Esquive', base: 40, modifier: 0, target: 40, roll: 30, success: true, sl: 1 },
      log: 'rate',
    } as never;
    useGame.setState({
      battle: { ...b, acted: true },
      pendingDefense: {
        attackerId: E.id, defenderId: H1.id, weapon: E.weapons[0], location: null,
        atk: { roll: 55, target: 40, success: false, sl: -1, isDouble: false },
        mode: 'esquive', def: { roll: 30, target: 40, success: true, sl: 1, isDouble: false }, result,
        suite: { mode: 'machine', coup: {} },
      } as never,
      pendingCascade: { title: 'Défense', purpose: 'combat', cursor: 0, log: [], participants: [{ id: 'defense-jet', kind: 'defenseJet', jet: 'defense', actorId: H1.id }] } as never,
    });
    useGame.getState().defenseConfirm();

    const p = useGame.getState().pendingCascade;
    expect(p, 'le Hurlement gratuit doit ouvrir/étendre une cascade').toBeTruthy();
    expect(useGame.getState().pendingDefense, 'la défense principale est résolue').toBeNull();
    // ANTI SOFT-LOCK : le curseur n'est PAS resté sur l'étape défense résolue.
    const cur = p!.participants[p!.cursor];
    expect(cur?.jet, `le curseur ne doit pas rester sur la défense résolue (jet=${cur?.jet})`).not.toBe('defense');
    expect(cur?.kind, 'le curseur pointe une étape RÉSOLUBLE (Test de Résistance influençable)').toBe('triggeredTest');
    expect(cur?.result, 'Test de Résistance non encore lancé (influençable)').toBeFalsy();
    // La cascade porte bien le tag de reprise du tour de la créature.
    expect(p!.maneuverResume?.attackerId).toBe(E.id);
  });
});
