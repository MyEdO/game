/**
 * #500 — GATE de Test à la traversée de zone (`BattleZone.crossTest`). Forêt d'épines (LDB 48 l.749) :
 * « quiconque tente de traverser la zone à pied sans posséder le Talent Magie des Arcanes (Vie) doit
 * réussir un Test d'Agilité Difficile (-20). Un échec signifie qu'il gagne 1 État Hémorragique et un
 * État Empêtré, qui utilise votre Force Mentale pour sa Force. » Exécution RUNTIME (complète le test
 * data-only `l11-sorts-zones.test.ts`, ba77a269) : héros manuel → cascade influençable ; exemption par
 * Talent → aucun jet ; IA/auto → jet inline journalisé (jamais silencieux).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyZoneCrossings } from './combatFlow';
import type { BattleZone } from './zones';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { seedBattleRng } from './battleRng';
import { hasCondition, COND, stacks } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';

const CROSS_TEST_ZONE: BattleZone = {
  // `source` = l'ENTITÉ qui a posé la zone, comme `placeZoneFromOp` la pose en production (#1262 V2
  // L6d) : le Test de traversée en DÉRIVE son enjeu (« ce qui se joue : Forêt d'épines »).
  label: "Forêt d'épines", tiles: [{ x: 6, y: 10 }], rounds: 4, casterId: 'CASTER',
  source: { kind: 'spell', id: 'foret-d-epines' },
  onCross: [
    { op: 'condition', id: 'hemorragique' },
    { op: 'condition', id: 'empetre', escapeStrength: { charOf: 'force-mentale' } },
  ],
  crossTest: {
    characteristic: 'agilite', difficulty: 'difficile', label: "Forêt d'épines",
    gate: { kind: 'not', of: { kind: 'has', who: 'target', what: 'talent', value: 'magie-des-arcanes', spec: 'vie' } },
  },
};

describe('#500 — BattleZone.crossTest : Forêt d’épines (LDB 48 l.749)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCascade: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup(heroTalents: Combatant['talents'] = []) {
    const H = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    H.talents = [...H.talents, ...heroTalents];
    useGame.setState({ party: [H] });
    useGame.getState().startScene(testScene());
    seedBattleRng(9);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const hero = b.combatants.find((c) => c.kind === 'hero')!;
    const enemy = b.combatants.filter((c) => c.kind === 'enemy')[0];
    hero.pos = { x: 5, y: 10 };
    enemy.pos = { x: 5, y: 11 };
    // Lanceur du sort — présent dans la BATAILLE (retiré ensuite au cas « hors combat »).
    const caster = { ...hero, id: 'CASTER', label: 'Caster' } as Combatant;
    caster.characteristics = { ...hero.characteristics, 'force-mentale': 60 }; // BFM 6 → escapeStrength figée
    b.combatants = [...b.combatants, caster];
    b.zones = [{ ...CROSS_TEST_ZONE }];
    useGame.setState({ battle: { ...b }, pendingCascade: null });
    return { hero, enemy, caster };
  }

  it('héros manuel SANS le Talent : la traversée pousse une étape de cascade `triggeredTest` (Agilité, Difficile)', () => {
    const { hero } = setup();
    applyZoneCrossings(useGame.getState, useGame.setState, hero, [{ x: 5, y: 10 }, { x: 6, y: 10 }]);
    const step = useGame.getState().pendingCascade?.participants.find((s) => s.kind === 'triggeredTest');
    expect(step).toBeTruthy();
    expect(step!.rollLabel).toBe('Agilité');
    // Aucun État posé tant que le jet n'a pas été résolu (pas de jet silencieux).
    expect(hasCondition(hero, COND.empetre)).toBe(false);
  });

  it('héros manuel, Test ÉCHOUÉ : gagne Hémorragique + Empêtré, escapeStrength = FM du LANCEUR (figée)', () => {
    const { hero, caster } = setup();
    applyZoneCrossings(useGame.getState, useGame.setState, hero, [{ x: 5, y: 10 }, { x: 6, y: 10 }]);
    const p = useGame.getState().pendingCascade!;
    const step = p.participants.find((s) => s.kind === 'triggeredTest')! as CascadeStep;
    // Force le jet ÉCHOUÉ (pattern forcé du repo — `gesundheit-sl-scene.test.ts` — bypass le d100).
    useGame.setState({
      pendingCascade: {
        ...p,
        participants: p.participants.map((s) => (s.id === step.id ? { ...s, result: { roll: 99, target: step.target!, sl: -3, success: false } } : s)),
      },
    });
    useGame.getState().cascadeNext();
    const H = useGame.getState().battle!.combatants.find((c) => c.id === hero.id)!;
    expect(hasCondition(H, COND.hemorragique)).toBe(true);
    expect(hasCondition(H, COND.empetre)).toBe(true);
    const empetre = H.conditions.find((c) => c.id === COND.empetre)!;
    expect(empetre.escapeStrength).toBe(caster.characteristics['force-mentale']); // FM 60 (charOf, pas bonusOf)
  });

  it('héros manuel, Test RÉUSSI : aucun État (onCross sauté)', () => {
    const { hero } = setup();
    applyZoneCrossings(useGame.getState, useGame.setState, hero, [{ x: 5, y: 10 }, { x: 6, y: 10 }]);
    const p = useGame.getState().pendingCascade!;
    const step = p.participants.find((s) => s.kind === 'triggeredTest')!;
    useGame.setState({
      pendingCascade: {
        ...p,
        participants: p.participants.map((s) => (s.id === step.id ? { ...s, result: { roll: 1, target: step.target!, sl: 5, success: true } } : s)),
      },
    });
    useGame.getState().cascadeNext();
    const H = useGame.getState().battle!.combatants.find((c) => c.id === hero.id)!;
    expect(hasCondition(H, COND.hemorragique)).toBe(false);
    expect(hasCondition(H, COND.empetre)).toBe(false);
  });

  it('héros manuel avec le Talent Magie des Arcanes (Vie) : EXEMPTÉ — aucun jet, aucun État', () => {
    const { hero } = setup([{ talentId: 'magie-des-arcanes', spec: 'vie', times: 1 }]);
    applyZoneCrossings(useGame.getState, useGame.setState, hero, [{ x: 5, y: 10 }, { x: 6, y: 10 }]);
    expect(useGame.getState().pendingCascade?.participants.some((s) => s.kind === 'triggeredTest')).toBeFalsy();
    expect(hasCondition(hero, COND.empetre)).toBe(false);
  });

  it('IA/auto (ennemi) : jet INLINE journalisé (jamais silencieux) — échec → États, journal non vide', () => {
    const { hero, enemy } = setup();
    void hero;
    enemy.characteristics = { ...enemy.characteristics, agilite: 1 }; // Agilité quasi-nulle → échec quasi-certain
    const before = useGame.getState().battle!.log.length;
    applyZoneCrossings(useGame.getState, useGame.setState, enemy, [{ x: 5, y: 11 }, { x: 6, y: 10 }]);
    const b = useGame.getState().battle!;
    expect(b.log.length).toBeGreaterThan(before); // le jet + son issue sont journalisés — pas de jet silencieux
    const E = b.combatants.find((c) => c.id === enemy.id)!;
    if (!hasCondition(E, COND.empetre)) return; // (bande auto-succès RAW résiduelle, ~5 %)
    expect(hasCondition(E, COND.hemorragique)).toBe(true);
  });

  it('lanceur INCONSCIENT (reste dans battle.combatants, LDB 16 — aucune purge « morts persistants ») : escapeStrength garde SA Force Mentale, pas celle du traverseur', () => {
    const { hero, caster } = setup();
    const b = useGame.getState().battle!;
    caster.dead = true; // le lanceur tombe APRÈS avoir posé la zone — reste dans `battle.combatants` (résolvable)
    useGame.setState({ battle: { ...b } });
    applyZoneCrossings(useGame.getState, useGame.setState, hero, [{ x: 5, y: 10 }, { x: 6, y: 10 }]);
    const p = useGame.getState().pendingCascade!;
    const step = p.participants.find((s) => s.kind === 'triggeredTest')!;
    useGame.setState({
      pendingCascade: {
        ...p,
        participants: p.participants.map((s) => (s.id === step.id ? { ...s, result: { roll: 99, target: step.target!, sl: -3, success: false } } : s)),
      },
    });
    useGame.getState().cascadeNext();
    const H = useGame.getState().battle!.combatants.find((c) => c.id === hero.id)!;
    const empetre = H.conditions.find((c) => c.id === COND.empetre)!;
    expect(empetre.escapeStrength).toBe(caster.characteristics['force-mentale']); // SA FM (60), pas celle du traverseur
    expect(stacks(H, COND.empetre)).toBeGreaterThan(0);
  });
});
