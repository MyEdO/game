import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { draineCascade } from './cascadeTestKit';
import { applyAttackResult, checkBattleOver, firedAttackBlock, resolveAttack, doAttack } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { AttackResult } from '../engine/combat';
import type { Scene } from './scene';
import type { Weapon } from '../engine/types';

/**
 * DUEL JUDICIAIRE (#471, NADJ 06 l.175-192) — deux mécaniques indépendantes de `EncounterDef` :
 * `victoryCondition: { type: 'firstBlood' }` (premier sang, PAR-COUP, l.175-177) et `banRanged`
 * (restriction d'armes à distance, dérogeable, l.181). Patron calqué sur `woundsThreshold` (#215,
 * `victoryCondition.test.ts`) et le harnais `applyAttackResult` direct de `at-terre.test.ts`.
 */

/** Résout la cascade de fin de combat (Tests de Résistance influençables) — no-op si aucune. */
function drainCombatEndCascade(): void {
  for (let guard = 0; guard < 30; guard++) {
    const p = useGame.getState().pendingCascade;
    if (!p?.combatEndBoundary) break;
    const cur = p.participants[p.cursor];
    // Les jets de bilan de combat sont des BANDES (#1117 L4) : on lance chaque RANGÉE ; une étape MONO
    // (upkeep différé non bandable) garde son lancer d'étape.
    if (cur?.participants) { for (const row of cur.participants) if (!row.result) useGame.getState().cascadeBatchRoll(row.id); }
    else if (cur?.target != null && !cur.result) useGame.getState().cascadeRoll(cur.id);
    useGame.getState().cascadeNext();
  }
}

function setup(scene: Scene = testScene()) {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero], battle: null });
  useGame.getState().startScene(scene);
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const E = b.combatants.find((c) => c.kind === 'enemy')!;
  return { H, E };
}

describe('Duel judiciaire — premier sang (#471, NADJ 06 l.175-177)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("un coup à PILE le seuil (3 Blessures, défaut) → le combat CONTINUE (« plus de 3 »)", () => {
    const { H, E } = setup();
    E.wounds = { current: 10, max: 10, base: 10 } as never;
    useGame.setState({ battle: { ...useGame.getState().battle!, victoryCondition: { type: 'firstBlood' } } });
    const res: AttackResult = {
      hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 3, woundsLost: 3,
      critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    applyAttackResult(useGame.getState, useGame.setState, H, E, H.weapons[0], res);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.outOfRencontre).toBeFalsy();
    const over = checkBattleOver(useGame.getState, useGame.setState);
    expect(over).toBe(false);
    expect(useGame.getState().battle!.over).toBeNull();
  });

  it("un coup à seuil+1 (4 Blessures) → premier sang, la cible TOUCHÉE est le perdant, journal explicite", () => {
    const { H, E } = setup();
    E.wounds = { current: 10, max: 10, base: 10 } as never;
    useGame.setState({ battle: { ...useGame.getState().battle!, victoryCondition: { type: 'firstBlood' } } });
    const res: AttackResult = {
      hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 4, woundsLost: 4,
      critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    applyAttackResult(useGame.getState, useGame.setState, H, E, H.weapons[0], res);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.outOfRencontre).toBe(true);
    expect(e.exitReason).toBe('firstBlood');
    expect(useGame.getState().battle!.log.some((ev) => ev.text.includes('Premier sang'))).toBe(true);
    const over = checkBattleOver(useGame.getState, useGame.setState);
    drainCombatEndCascade();
    expect(over).toBe(true);
    expect(useGame.getState().battle!.over).toBe('victory');
  });

  it("0 Blessure (fin standard, RAW l.177) reste active en parallèle — même sous firstBlood, avec des coups ≤ seuil", () => {
    setup();
    // Tous les ennemis directement à 0 PB et morts : la fin STANDARD (incapacité), indépendante du premier sang.
    const b = useGame.getState().battle!;
    for (const c of b.combatants) if (c.kind === 'enemy') { c.dead = true; c.wounds = { ...c.wounds, current: 0 }; }
    useGame.setState({ battle: { ...b, victoryCondition: { type: 'firstBlood' } } });
    const over = checkBattleOver(useGame.getState, useGame.setState);
    drainCombatEndCascade();
    expect(over).toBe(true);
    expect(useGame.getState().battle!.over).toBe('victory');
  });

  it("seuil ÉDITÉ en donnée (5) → un coup à 5 continue, à 6 termine", () => {
    const { H, E } = setup();
    E.wounds = { current: 10, max: 10, base: 10 } as never;
    useGame.setState({ battle: { ...useGame.getState().battle!, victoryCondition: { type: 'firstBlood', threshold: 5 } } });
    const res5: AttackResult = {
      hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 5, woundsLost: 5,
      critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    applyAttackResult(useGame.getState, useGame.setState, H, E, H.weapons[0], res5);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.outOfRencontre).toBeFalsy();

    const res6: AttackResult = {
      hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 6, woundsLost: 6,
      critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    e.wounds = { current: 10, max: 10, base: 10 } as never; // frais : le 1er coup (≤ seuil) ne doit pas biaiser le 2e par clampage
    applyAttackResult(useGame.getState, useGame.setState, H, e, H.weapons[0], res6);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.exitReason).toBe('firstBlood');
  });
});

describe('Duel judiciaire — restriction d\'armes à distance (#471, NADJ 06 l.181)', () => {
  const RANGED: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [] };

  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('banRanged actif : resolveAttack REFUSE une arme à distance — chemin JOUEUR', () => {
    const { H, E } = setup();
    H.weapons = [RANGED];
    H.pos = { x: 0, y: 0 };
    E.pos = { x: 5, y: 0 };
    useGame.setState({ battle: { ...useGame.getState().battle!, banRanged: true } });
    const r = resolveAttack(useGame.getState, H, E);
    expect(r).toBeNull();
  });

  it("banRanged actif : firedAttackBlock refuse l'arme à distance pour le héros (affordance 'armeBannie')", () => {
    const { H, E } = setup();
    H.weapons = [RANGED];
    useGame.setState({ battle: { ...useGame.getState().battle!, banRanged: true } });
    const block = firedAttackBlock(useGame.getState, H, E);
    expect(block).toMatchObject({ reason: 'armeBannie' });
  });

  it('banRanged actif : resolveAttack REFUSE aussi une arme à distance — chemin IA (doAttack)', () => {
    const { H, E } = setup();
    E.weapons = [RANGED];
    E.pos = { x: 0, y: 0 };
    H.pos = { x: 5, y: 0 };
    useGame.setState({ battle: { ...useGame.getState().battle!, banRanged: true } });
    const woundsBefore = H.wounds.current;
    doAttack(useGame.getState, useGame.setState, E, H);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(woundsBefore);
  });

  it('banRanged absent (défaut) : une arme à distance tire normalement (comportement historique)', () => {
    const { H, E } = setup();
    H.weapons = [RANGED];
    H.pos = { x: 0, y: 0 };
    E.pos = { x: 5, y: 0 };
    const r = resolveAttack(useGame.getState, H, E);
    expect(r).not.toBeNull();
  });

  it("duel firstBlood SANS banRanged posé : interdit PAR DÉFAUT (#471 défaut 1, NADJ 06 l.181 « la plupart »)", () => {
    const { H, E } = setup();
    H.weapons = [RANGED];
    H.pos = { x: 0, y: 0 };
    E.pos = { x: 5, y: 0 };
    useGame.setState({ battle: { ...useGame.getState().battle!, victoryCondition: { type: 'firstBlood' } } });
    expect(resolveAttack(useGame.getState, H, E)).toBeNull();
    expect(firedAttackBlock(useGame.getState, H, E)).toMatchObject({ reason: 'armeBannie' });
  });

  it("duel firstBlood + banRanged:false EXPLICITE : dérogation, le tir passe (« pas toutes » les lois locales)", () => {
    const { H, E } = setup();
    H.weapons = [RANGED];
    H.pos = { x: 0, y: 0 };
    E.pos = { x: 5, y: 0 };
    useGame.setState({ battle: { ...useGame.getState().battle!, victoryCondition: { type: 'firstBlood' }, banRanged: false } });
    expect(resolveAttack(useGame.getState, H, E)).not.toBeNull();
    expect(firedAttackBlock(useGame.getState, H, E)).toBeNull();
  });
});

describe('Duel judiciaire — premier sang mesuré sur le coup FINALISÉ (#471 défaut 2, Blessures ajoutées par un Critique)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('coup base 2 Blessures + Critique qui en ajoute 2 (table LDB 18) = 4 > seuil 3 → premier sang déclenché', () => {
    const { H, E } = setup();
    E.wounds = { current: 20, max: 20, base: 20 } as never;
    E.armour = { corps: 0, testa: 0, brasD: 0, brasG: 0, jambeD: 0, jambeG: 0 } as never;
    useGame.getState().seedRng(8); // graine calibrée : table de Critique « Coupure profonde » ajoute exactement 2 Blessures
    useGame.setState({ battle: { ...useGame.getState().battle!, victoryCondition: { type: 'firstBlood' } } });
    const res: AttackResult = {
      hit: true, attackerRoll: 33, netSL: 1, location: 'corps', damage: 2, woundsLost: 2,
      critical: true, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    applyAttackResult(useGame.getState, useGame.setState, H, E, H.weapons[0], res);
    draineCascade(useGame.getState); // la sévérité du Critique se tire DANS la fenêtre (#1426)
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(20 - e.wounds.current).toBe(4); // 2 de base + 2 du Critique — la perte RÉELLE du coup, pas juste `res.woundsLost`
    expect(e.outOfRencontre).toBe(true);
    expect(e.exitReason).toBe('firstBlood');
  });
});
