import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { runCombatHooks, type CombatHookCtx } from '../combatHooks';
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';
import { ev } from '../combatLog';
import { addCondition, hasCondition, COND } from '../../engine/conditions';
import { bonus, effectiveChar } from '../../engine/characteristics';
import { blessuresDeBase } from '../../engine/combattantDeTest.testkit';
import { setRule } from '../../engine/policy';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * #38 — AA 07 l.5 : le Test de Résistance de l'Hémorragique à 0 PB, porté par le hook `aa-bleed-unconscious`
 * (résolu AVANT `bleed-death`) pour les ENNEMIS/auto ; le héros manuel passe par la cascade. Le décompte de
 * `tick-death` (LDB 18 l.15) vaut aussi en mode AA : #1595 c.6219559935.
 */
describe('#38 — chute Inconscient par perte de sang AA (Aux Armes AA 07 l.5)', () => {
  beforeEach(() => {
    banc.setState({ pendingCascade: null, pendingFateSave: null, battle: null });
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source vivante → RNG déterministe
    // Hors Mort Subite, donc en jeu à 0 PB : PNJ important (LDB 18 l.46), à Talent Chanceux (AA 07 l.67).
    E.important = true;
    E.talents = [...(E.talents ?? []), { talentId: 'chanceux', times: 1 }];
    E.wounds = blessuresDeBase(20, 0, E);
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { E };
  }

  function roundEndHooksOnly() {
    const battle = banc.getState().battle!;
    const sink = (line: string, c?: Combatant) => battle.log.push(ev('condition', line, c?.id));
    const ctx: CombatHookCtx = { get: banc.getState, set: banc.setState, battle, sink };
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

  it('mode AA : Résistance RÉUSSIE (d100 bas), 1er Round à 0 → reste conscient', () => {
    setRule('combat-aa-blessures', 'aa');
    const { E } = setup();
    seedBattleRng(7); // d100 sous la cible → Test de Résistance réussi
    addCondition(E, COND.hemorragique, 1);
    roundEndHooksOnly();
    expect(hasCondition(E, COND.inconscient)).toBe(false);
  });

  it('mode AA : à 0 PB SANS Hémorragique, 1er Round à 0 → aucun Test, reste conscient', () => {
    setRule('combat-aa-blessures', 'aa');
    const { E } = setup();
    seedBattleRng(98);
    roundEndHooksOnly(); // pas d'Hémorragique → gate exclut
    expect(hasCondition(E, COND.inconscient)).toBe(false);
  });

  it('mode AA : à 0 PB SANS Hémorragique depuis BE Rounds → Inconscient par `tick-death` (LDB 18 l.15 ; #1595 c.6219559935)', () => {
    setRule('combat-aa-blessures', 'aa');
    const { E } = setup();
    E.roundsAtZero = bonus(effectiveChar(E, 'endurance'));
    roundEndHooksOnly();
    expect(hasCondition(E, COND.inconscient)).toBe(true);
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
