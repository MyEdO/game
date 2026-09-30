/**
 * #491 — Option « Vents Tourbillonnants » (LDB 46 l.179-190), câblage STATE : tirage à l'ouverture du
 * combat (`windsOfMagicAtCombatStart`), re-tirage au Round (grain `round`, `openRoundEndCascade`),
 * mod injecté aux Tests d'Incantation/Focalisation (`castRoll`/`focusRoll`), détection Seconde vue.
 * Le moteur PUR (table, tirage seedé, `hasSecondeVue`) est couvert par `engine/windsOfMagic.test.ts`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { advanceTurn } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import { pregen, PREGEN } from '../data/pregens';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

function wizardWithSecondeVue(): Combatant {
  const w = pregen(PREGEN.sorcier);
  w.skills = (w.skills as Combatant['skills']).filter((s) => s.id !== 'langue');
  w.skills.push({ id: 'langue', spec: 'magick', advances: 30 } as never);
  w.skills.push({ id: 'focalisation', spec: 'cieux', advances: 30 } as never); // domaine du sort de test (arc-de-t-essla)
  w.skills.push({ id: 'perception', advances: 60 } as never); // très haut : Facile (+40) quasi certaine
  w.characteristics = { ...w.characteristics, intelligence: 80, 'force-mentale': 80 };
  w.talents = [...w.talents, { talentId: 'seconde-vue', times: 1 }];
  return w;
}

/** La Perception de Seconde vue d'un héros tenu est SA fenêtre (#700) : on la joue d'office ici. */
function soldeLaCascade(): void {
  if (!useGame.getState().pendingCascade) return;
  useGame.getState().cascadeResolveAll();
  useGame.getState().cascadeFinish();
}

function setupCombat(): void {
  useGame.setState({ party: [wizardWithSecondeVue()] });
  useGame.getState().startScene(testScene());
}

/** Cible de Test MODÉRÉE (loin du plafond `targetMax` 99 de `testPolicy`, LDB 12 l.75, option
 *  `test-over-100` désactivée) — un lanceur trop puissant écrêterait le delta du mod des Vents sous
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
  useGame.setState({ party: [moderateCaster()] });
  useGame.getState().startScene(testScene());
}

describe('#491 — Vents Tourbillonnants, câblage state', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); resetRule('vents-tourbillonnants'); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('vents-tourbillonnants'); });

  it("option OFF (défaut) : aucun tirage, `battle.windsOfMagic` absent", () => {
    setupCombat();
    seedBattleRng(1);
    useGame.getState().startCombat('enc-mutants');
    expect(useGame.getState().battle!.windsOfMagic).toBeUndefined();
  });

  it('option `scene` : tirage 1d10 SEEDÉ à l’ouverture — même seed → même force', () => {
    setRule('vents-tourbillonnants', 'scene');
    setupCombat();
    seedBattleRng(99);
    useGame.getState().startCombat('enc-mutants');
    const first = useGame.getState().battle!.windsOfMagic;
    expect(first).toBeDefined();
    expect(first!.mod).toEqual(expect.any(Number));

    useGame.setState({ battle: null });
    setupCombat();
    seedBattleRng(99);
    useGame.getState().startCombat('enc-mutants');
    const again = useGame.getState().battle!.windsOfMagic;
    expect(again).toEqual(first); // déterminisme
  });

  it('Seconde vue : au moins un tirage RÉVÈLE la force (probabiliste, Perception massive → quasi-certain)', () => {
    setRule('vents-tourbillonnants', 'scene');
    let revealed = false;
    for (let seed = 1; seed <= 40 && !revealed; seed++) {
      useGame.setState({ battle: null });
      setupCombat();
      seedBattleRng(seed);
      useGame.getState().startCombat('enc-mutants');
      soldeLaCascade();
      revealed = !!useGame.getState().battle!.windsOfMagic?.revealed;
    }
    expect(revealed).toBe(true);
  });

  it('SANS le Talent Seconde vue : jamais révélé (aucun Test tenté)', () => {
    setRule('vents-tourbillonnants', 'scene');
    const w = wizardWithSecondeVue();
    w.talents = w.talents.filter((t) => t.talentId !== 'seconde-vue');
    useGame.setState({ party: [w] });
    useGame.getState().startScene(testScene());
    for (let seed = 1; seed <= 10; seed++) {
      useGame.setState({ battle: null });
      useGame.setState({ party: [w] });
      useGame.getState().startScene(testScene());
      seedBattleRng(seed);
      useGame.getState().startCombat('enc-mutants');
      expect(useGame.getState().battle!.windsOfMagic?.revealed).toBe(false);
    }
  });

  /** Un cast RÉEL (RNG) peut déclencher une Incantation Imparfaite → contrecoup persistant sur le
   *  lanceur (`castPenaltyMod`) : deux jets sur le MÊME lanceur contamineraient la comparaison. Une
   *  configuration FRAÎCHE par branche isole strictement le seul delta testé (le mod des Vents). */
  function castTargetWith(mod: number): number {
    useGame.setState({ battle: null });
    setupModerateCombat();
    seedBattleRng(1);
    useGame.getState().startCombat('enc-mutants');
    const battle = useGame.getState().battle!;
    useGame.setState({ battle: { ...battle, windsOfMagic: { roll: 5, mod, revealed: false } } });
    const w = battle.combatants.find((c) => c.kind === 'hero')!;
    useGame.setState({ pendingCast: { casterId: w.id, targetId: w.id, spellId: 'arc-de-t-essla', missile: false, focused: false, result: null } });
    useGame.getState().castRoll();
    return useGame.getState().pendingCast!.result!.target;
  }

  it("le mod reste appliqué au Test d'Incantation MÊME non révélé (on subit les Vents sans les avoir repérés)", () => {
    setRule('vents-tourbillonnants', 'scene');
    expect(castTargetWith(-30)).toBe(castTargetWith(0) - 30);
  });

  /** Idem, isolé par branche (le Test étendu de Focalisation accumule aussi du DR sur le lanceur). */
  function focusTargetWith(mod: number): number | undefined {
    useGame.setState({ battle: null });
    setupModerateCombat();
    seedBattleRng(1);
    useGame.getState().startCombat('enc-mutants');
    const battle = useGame.getState().battle!;
    const w = battle.combatants.find((c) => c.kind === 'hero')!;
    w.spells = ['arc-de-t-essla'];
    useGame.setState({ battle: { ...battle, windsOfMagic: { roll: 5, mod, revealed: false } } });
    useGame.setState({ pendingFocus: { casterId: w.id, spellId: 'arc-de-t-essla', result: null } });
    useGame.getState().focusRoll();
    return useGame.getState().pendingFocus!.result!.target;
  }

  it("le mod s'applique aussi au Test de Focalisation (resolveFocus extraMod)", () => {
    setRule('vents-tourbillonnants', 'scene');
    expect(focusTargetWith(30)).toBe(focusTargetWith(0)! + 30);
  });

  it('grain `round` : re-tirage à la frontière de Round (le grain `scene` NE re-tire PAS)', () => {
    setRule('vents-tourbillonnants', 'round');
    setupCombat();
    seedBattleRng(777);
    useGame.getState().startCombat('enc-mutants');
    soldeLaCascade();
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    // Sentinelle hors-table (1-10) : si le hook de Round tourne, elle disparaît forcément.
    useGame.setState({ battle: { ...useGame.getState().battle!, windsOfMagic: { roll: 999, mod: 0, revealed: false } } });
    seedBattleRng(4242);
    useGame.setState({ battle: { ...useGame.getState().battle!, turn: useGame.getState().battle!.order.length - 1 } });
    advanceTurn(useGame.getState, useGame.setState);
    expect(useGame.getState().battle!.windsOfMagic!.roll).not.toBe(999);
  });

  it('grain `scene` (défaut du mode actif) : PAS de re-tirage à la frontière de Round', () => {
    setRule('vents-tourbillonnants', 'scene');
    setupCombat();
    seedBattleRng(777);
    useGame.getState().startCombat('enc-mutants');
    soldeLaCascade();
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    useGame.setState({ battle: { ...useGame.getState().battle!, windsOfMagic: { roll: 999, mod: 0, revealed: false } } });
    seedBattleRng(4242);
    useGame.setState({ battle: { ...useGame.getState().battle!, turn: useGame.getState().battle!.order.length - 1 } });
    advanceTurn(useGame.getState, useGame.setState);
    expect(useGame.getState().battle!.windsOfMagic!.roll).toBe(999);
  });
});
