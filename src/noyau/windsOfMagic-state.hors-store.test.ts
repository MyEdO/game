/**
 * #491 — Option « Vents Tourbillonnants » (LDB 46 l.179-190), câblage STATE : tirage à l'ouverture du
 * combat (`windsOfMagicAtCombatStart`), re-tirage au Round (grain `round`, `combat/roundHooks.ts`),
 * mod injecté aux Tests d'Incantation/Focalisation (`jetLancer('incantation')`/`jetLancer('focalisation')`), détection Seconde vue.
 * Le moteur PUR (table, tirage seedé, `hasSecondeVue`) est couvert par `engine/windsOfMagic.test.ts`.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { advanceTurn } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import { herosDeScenario } from '../scenes/test-scenarios/_heros';
import { setRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function wizardWithSecondeVue(): Combatant {
  const w = herosDeScenario(idsDeTest, 'sorcier');
  w.skills = (w.skills as Combatant['skills']).filter((s) => s.id !== 'langue');
  w.skills.push({ id: 'langue', spec: 'magick', advances: 30 } as never);
  w.skills.push({ id: 'focalisation', spec: 'cieux', advances: 30 } as never); // domaine du sort de test (arc-de-t-essla)
  w.skills.push({ id: 'perception', advances: 60 } as never); // très haut : Facile (+40) quasi certaine
  w.characteristics = { ...w.characteristics, intelligence: 80, 'force-mentale': 80 };
  w.talents = [...w.talents, { talentId: 'seconde-vue', times: 1 }];
  return w;
}

function setupCombat(): void {
  banc.setState({ party: [wizardWithSecondeVue()] });
  banc.getState().lancerLaScene(testScene());
}

/** Cible de Test MODÉRÉE (loin du plafond `targetMax` 99 de `testPolicy`, LDB 12 l.75, option
 *  `test-plus-de-100` désactivée) — un lanceur trop puissant écrêterait le delta du mod des Vents sous
 *  le plafond et fausserait la comparaison (`clamp`, `engine/tests.ts`). */
function moderateCaster(): Combatant {
  const w = wizardWithSecondeVue();
  w.skills = (w.skills as Combatant['skills']).filter((s) => s.id !== 'langue' && s.id !== 'focalisation');
  w.skills.push({ id: 'langue', spec: 'magick', advances: 5 } as never);
  w.skills.push({ id: 'focalisation', spec: 'cieux', advances: 5 } as never);
  w.characteristics = { ...w.characteristics, intelligence: 45, 'force-mentale': 45 };
  return w;
}

function setupModerateCombat(): void {
  banc.setState({ party: [moderateCaster()] });
  banc.getState().lancerLaScene(testScene());
}

describe('#491 — Vents Tourbillonnants, câblage state', () => {
  it("option OFF (défaut) : aucun tirage, `battle.windsOfMagic` absent", () => {
    setupCombat();
    seedBattleRng(1);
    banc.getState().lancerLeCombat('enc-mutants');
    expect(banc.getState().battle!.windsOfMagic).toBeUndefined();
  });

  it('option `scene` : tirage 1d10 SEEDÉ à l’ouverture — même seed → même force', () => {
    setRule('vents-tourbillonnants', 'scene');
    setupCombat();
    seedBattleRng(99);
    banc.getState().lancerLeCombat('enc-mutants');
    const first = banc.getState().battle!.windsOfMagic;
    expect(first).toBeDefined();
    expect(first!.mod).toEqual(expect.any(Number));

    banc.setState({ battle: null });
    setupCombat();
    seedBattleRng(99);
    banc.getState().lancerLeCombat('enc-mutants');
    const again = banc.getState().battle!.windsOfMagic;
    expect(again).toEqual(first); // déterminisme
  });

  it('Seconde vue : au moins un tirage RÉVÈLE la force (probabiliste, Perception massive → quasi-certain)', () => {
    setRule('vents-tourbillonnants', 'scene');
    let revealed = false;
    for (let seed = 1; seed <= 40 && !revealed; seed++) {
      banc.setState({ battle: null });
      setupCombat();
      seedBattleRng(seed);
      banc.getState().lancerLeCombat('enc-mutants');
      revealed = !!banc.getState().battle!.windsOfMagic?.revealed;
    }
    expect(revealed).toBe(true);
  });

  it('SANS le Talent Seconde vue : jamais révélé (aucun Test tenté)', () => {
    setRule('vents-tourbillonnants', 'scene');
    const w = wizardWithSecondeVue();
    w.talents = w.talents.filter((t) => t.talentId !== 'seconde-vue');
    banc.setState({ party: [w] });
    banc.getState().lancerLaScene(testScene());
    for (let seed = 1; seed <= 10; seed++) {
      banc.setState({ battle: null });
      banc.setState({ party: [w] });
      banc.getState().lancerLaScene(testScene());
      seedBattleRng(seed);
      banc.getState().lancerLeCombat('enc-mutants');
      expect(banc.getState().battle!.windsOfMagic?.revealed).toBe(false);
    }
  });

  /** Un cast RÉEL (RNG) peut déclencher une Incantation Imparfaite → contrecoup persistant sur le
   *  lanceur (`castPenaltyMod`) : deux jets sur le MÊME lanceur contamineraient la comparaison. Une
   *  configuration FRAÎCHE par branche isole strictement le seul delta testé (le mod des Vents). */
  function castTargetWith(mod: number): number {
    banc.setState({ battle: null });
    setupModerateCombat();
    seedBattleRng(1);
    banc.getState().lancerLeCombat('enc-mutants');
    const battle = banc.getState().battle!;
    banc.setState({ battle: { ...battle, windsOfMagic: { roll: 5, mod, revealed: false } } });
    const w = battle.combatants.find((c) => c.kind === 'heros')!;
    banc.setState({ pendingCast: { casterId: w.id, targetId: w.id, spellId: 'arc-de-t-essla', missile: false, focused: false, result: null } });
    banc.getState().jetLancer('incantation');
    return banc.getState().pendingCast!.result!.target;
  }

  it("le mod reste appliqué au Test d'Incantation MÊME non révélé (on subit les Vents sans les avoir repérés)", () => {
    setRule('vents-tourbillonnants', 'scene');
    expect(castTargetWith(-30)).toBe(castTargetWith(0) - 30);
  });

  /** Idem, isolé par branche (le Test étendu de Focalisation accumule aussi du DR sur le lanceur). */
  function focusTargetWith(mod: number): number | undefined {
    banc.setState({ battle: null });
    setupModerateCombat();
    seedBattleRng(1);
    banc.getState().lancerLeCombat('enc-mutants');
    const battle = banc.getState().battle!;
    const w = battle.combatants.find((c) => c.kind === 'heros')!;
    w.spells = ['arc-de-t-essla'];
    banc.setState({ battle: { ...battle, windsOfMagic: { roll: 5, mod, revealed: false } } });
    banc.setState({ pendingFocus: { casterId: w.id, spellId: 'arc-de-t-essla', result: null } });
    banc.getState().jetLancer('focalisation');
    return banc.getState().pendingFocus!.result!.target;
  }

  it("le mod s'applique aussi au Test de Focalisation (resolveFocus extraMod)", () => {
    setRule('vents-tourbillonnants', 'scene');
    expect(focusTargetWith(30)).toBe(focusTargetWith(0)! + 30);
  });

  it('grain `round` : re-tirage à la frontière de Round (le grain `scene` NE re-tire PAS)', () => {
    setRule('vents-tourbillonnants', 'round');
    setupCombat();
    seedBattleRng(777);
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    // Sentinelle hors-table (1-10) : si le hook de Round tourne, elle disparaît forcément.
    banc.setState({ battle: { ...banc.getState().battle!, windsOfMagic: { roll: 999, mod: 0, revealed: false } } });
    seedBattleRng(4242);
    banc.setState({ battle: { ...banc.getState().battle!, turn: banc.getState().battle!.order.length - 1 } });
    advanceTurn(banc.getState, banc.setState);
    expect(banc.getState().battle!.windsOfMagic!.roll).not.toBe(999);
  });

  it('grain `scene` (défaut du mode actif) : PAS de re-tirage à la frontière de Round', () => {
    setRule('vents-tourbillonnants', 'scene');
    setupCombat();
    seedBattleRng(777);
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.setState({ battle: { ...banc.getState().battle!, windsOfMagic: { roll: 999, mod: 0, revealed: false } } });
    seedBattleRng(4242);
    banc.setState({ battle: { ...banc.getState().battle!, turn: banc.getState().battle!.order.length - 1 } });
    advanceTurn(banc.getState, banc.setState);
    expect(banc.getState().battle!.windsOfMagic!.roll).toBe(999);
  });
});
