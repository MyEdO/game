import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import '../combatFlow'; // effet de bord : enregistre les hooks de fin de Round (dont `aa-bleed-unconscious`)
import { runCombatHooks, type CombatHookCtx } from '../combatHooks';
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';
import { ev } from '../combatLog';
import { addCondition, hasCondition, COND } from '../../engine/conditions';
import { setRule, resetRule } from '../../engine/policy';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';

/**
 * #38 — Aux Armes (AA 07 l.5) : en mode AA, à 0 PB un combattant porteur de l'État Hémorragique ne tombe PAS
 * Inconscient d'office (le décompte LDB de `tick-death` est neutralisé) — il fait chaque Round un Test de
 * Résistance Intermédiaire (+0) sous peine de subir l'État Inconscient. Le hook `aa-bleed-unconscious` (résolu
 * AVANT `bleed-death`) porte cette règle pour les ENNEMIS/auto ; le héros manuel passe par la cascade.
 */
describe('#38 — chute Inconscient par perte de sang AA (Aux Armes AA 07 l.5)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, pendingFateSave: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    resetRule('combat-aa-blessures');
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source vivante → RNG déterministe
    E.important = true; // pas de Mort Subite → À Terre à 0 PB, soumis au Test de Résistance (pas hors-jeu)
    E.wounds = { current: 0, max: 20 };
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { E };
  }

  function roundEndHooksOnly() {
    const battle = useGame.getState().battle!;
    const sink = (line: string, c?: Combatant) => battle.log.push(ev('condition', line, c?.id));
    const ctx: CombatHookCtx = { get: useGame.getState, set: useGame.setState, battle, sink };
    runCombatHooks('onRoundEnd', ctx);
    return battle;
  }

  it('mode AA : Résistance RATÉE (d100 haut) → Inconscient', () => {
    setRule('combat-aa-blessures', 'aa');
    const { E } = setup();
    seedBattleRng(98); // d100 élevé → Test de Résistance raté
    addCondition(E, COND.hemorragique, 1);
    roundEndHooksOnly();
    expect(hasCondition(E, COND.inconscient)).toBe(true);
  });

  it('mode AA : Résistance RÉUSSIE (d100 bas) → reste conscient (pas d’Inconscient auto)', () => {
    setRule('combat-aa-blessures', 'aa');
    const { E } = setup();
    seedBattleRng(7); // d100 sous la cible → Test de Résistance réussi
    addCondition(E, COND.hemorragique, 1);
    roundEndHooksOnly();
    expect(hasCondition(E, COND.inconscient)).toBe(false);
  });

  it('mode AA : à 0 PB SANS Hémorragique → aucun Test, reste conscient', () => {
    setRule('combat-aa-blessures', 'aa');
    const { E } = setup();
    seedBattleRng(98);
    roundEndHooksOnly(); // pas d'Hémorragique → gate exclut
    expect(hasCondition(E, COND.inconscient)).toBe(false);
  });

  it('mode LDB (défaut) : le hook AA est inerte — pas d’Inconscient par ce chemin (parité, non régressé)', () => {
    const { E } = setup(); // rule ldb par défaut
    seedBattleRng(98);
    addCondition(E, COND.hemorragique, 1);
    roundEndHooksOnly();
    // En LDB, la chute Inconscient à 0 PB passe par `tick-death` (roundsAtZero > BE), pas par le hook AA :
    // au 1er Round à 0 PB (roundsAtZero 0→1 ≤ BE), l'ennemi reste conscient.
    expect(hasCondition(E, COND.inconscient)).toBe(false);
  });
});
