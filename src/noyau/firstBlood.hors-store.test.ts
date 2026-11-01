import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { applyAttackResult, checkBattleOver, firedAttackBlock, resolveAttack, doAttack } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { AttackResult } from '../engine/combat';
import type { Scene } from './monde/scene';
import type { Weapon } from '../engine/types';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * DUEL JUDICIAIRE (#471, NADJ 06 l.175-192) — deux mécaniques indépendantes de `EncounterDef` :
 * `victoryCondition: { type: 'firstBlood' }` (premier sang, PAR-COUP, l.175-177) et `banRanged`
 * (restriction d'armes à distance, dérogeable, l.181). Patron calqué sur `woundsThreshold` (#215,
 * `victoryCondition.hors-store.test.ts`) et le harnais `applyAttackResult` direct de `at-terre.hors-store.test.ts`.
 */

function setup(scene: Scene = testScene()) {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero], battle: null });
  banc.getState().startScene(scene);
  banc.getState().startCombat('enc-mutants');
  banc.getState().confirmRoundStart();
  banc.abandonner();
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const E = b.combatants.find((c) => c.kind === 'enemy')!;
  return { H, E };
}

describe('Duel judiciaire — premier sang (#471, NADJ 06 l.175-177)', () => {
  it("un coup à PILE le seuil (3 Blessures, défaut) → le combat CONTINUE (« plus de 3 »)", () => {
    const { H, E } = setup();
    E.wounds = blessuresDeBase(10, 10, E);
    banc.setState({ battle: { ...banc.getState().battle!, victoryCondition: { type: 'firstBlood' } } });
    const res: AttackResult = {
      hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 3, woundsLost: 3,
      critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    applyAttackResult(banc.getState, banc.setState, H, E, H.weapons[0], res);
    const e = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.outOfRencontre).toBeFalsy();
    const over = checkBattleOver(banc.getState, banc.setState);
    expect(over).toBe(false);
    expect(banc.getState().battle!.over).toBeNull();
  });

  it("un coup à seuil+1 (4 Blessures) → premier sang, la cible TOUCHÉE est le perdant, journal explicite", () => {
    const { H, E } = setup();
    E.wounds = blessuresDeBase(10, 10, E);
    banc.setState({ battle: { ...banc.getState().battle!, victoryCondition: { type: 'firstBlood' } } });
    const res: AttackResult = {
      hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 4, woundsLost: 4,
      critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    applyAttackResult(banc.getState, banc.setState, H, E, H.weapons[0], res);
    const e = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e.outOfRencontre).toBe(true);
    expect(e.exitReason).toBe('firstBlood');
    expect(banc.getState().battle!.log.some((ev) => ev.text.includes('Premier sang'))).toBe(true);
    const over = checkBattleOver(banc.getState, banc.setState);
    draineCascade(banc.getState);
    expect(over).toBe(true);
    expect(banc.getState().battle!.over).toBe('victory');
  });

  it("0 Blessure (fin standard, RAW l.177) reste active en parallèle — même sous firstBlood, avec des coups ≤ seuil", () => {
    setup();
    // Tous les ennemis directement à 0 PB et morts : la fin STANDARD (incapacité), indépendante du premier sang.
    const b = banc.getState().battle!;
    for (const c of b.combatants) if (c.kind === 'enemy') { c.dead = true; c.wounds = { ...c.wounds, current: 0 }; }
    banc.setState({ battle: { ...b, victoryCondition: { type: 'firstBlood' } } });
    const over = checkBattleOver(banc.getState, banc.setState);
    draineCascade(banc.getState);
    expect(over).toBe(true);
    expect(banc.getState().battle!.over).toBe('victory');
  });

  it("seuil ÉDITÉ en donnée (5) → un coup à 5 continue, à 6 termine", () => {
    const { H, E } = setup();
    E.wounds = blessuresDeBase(10, 10, E);
    banc.setState({ battle: { ...banc.getState().battle!, victoryCondition: { type: 'firstBlood', threshold: 5 } } });
    const res5: AttackResult = {
      hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 5, woundsLost: 5,
      critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    applyAttackResult(banc.getState, banc.setState, H, E, H.weapons[0], res5);
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.outOfRencontre).toBeFalsy();

    const res6: AttackResult = {
      hit: true, attackerRoll: 40, netSL: 1, location: 'corps', damage: 6, woundsLost: 6,
      critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    const e = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    e.wounds = blessuresDeBase(10, 10, e); // frais : le 1er coup (≤ seuil) ne doit pas biaiser le 2e par clampage
    applyAttackResult(banc.getState, banc.setState, H, e, H.weapons[0], res6);
    expect(banc.getState().battle!.combatants.find((c) => c.id === E.id)!.exitReason).toBe('firstBlood');
  });
});

describe('Duel judiciaire — restriction d\'armes à distance (#471, NADJ 06 l.181)', () => {
  const RANGED: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [] };

  it('banRanged actif : resolveAttack REFUSE une arme à distance — chemin JOUEUR', () => {
    const { H, E } = setup();
    H.weapons = [RANGED];
    H.pos = { x: 0, y: 0 };
    E.pos = { x: 5, y: 0 };
    banc.setState({ battle: { ...banc.getState().battle!, banRanged: true } });
    const r = resolveAttack(banc.getState, H, E);
    expect(r).toBeNull();
  });

  it("banRanged actif : firedAttackBlock refuse l'arme à distance pour le héros (affordance 'armeBannie')", () => {
    const { H, E } = setup();
    H.weapons = [RANGED];
    banc.setState({ battle: { ...banc.getState().battle!, banRanged: true } });
    const block = firedAttackBlock(banc.getState, H, E);
    expect(block).toMatchObject({ reason: 'armeBannie' });
  });

  it('banRanged actif : resolveAttack REFUSE aussi une arme à distance — chemin IA (doAttack)', () => {
    const { H, E } = setup();
    E.weapons = [RANGED];
    E.pos = { x: 0, y: 0 };
    H.pos = { x: 5, y: 0 };
    banc.setState({ battle: { ...banc.getState().battle!, banRanged: true } });
    const woundsBefore = H.wounds.current;
    doAttack(banc.getState, banc.setState, E, H);
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(woundsBefore);
  });

  it('banRanged absent (défaut) : une arme à distance tire normalement (comportement historique)', () => {
    const { H, E } = setup();
    H.weapons = [RANGED];
    H.pos = { x: 0, y: 0 };
    E.pos = { x: 5, y: 0 };
    const r = resolveAttack(banc.getState, H, E);
    expect(r).not.toBeNull();
  });

  it("duel firstBlood SANS banRanged posé : interdit PAR DÉFAUT (#471 défaut 1, NADJ 06 l.181 « la plupart »)", () => {
    const { H, E } = setup();
    H.weapons = [RANGED];
    H.pos = { x: 0, y: 0 };
    E.pos = { x: 5, y: 0 };
    banc.setState({ battle: { ...banc.getState().battle!, victoryCondition: { type: 'firstBlood' } } });
    expect(resolveAttack(banc.getState, H, E)).toBeNull();
    expect(firedAttackBlock(banc.getState, H, E)).toMatchObject({ reason: 'armeBannie' });
  });

  it("duel firstBlood + banRanged:false EXPLICITE : dérogation, le tir passe (« pas toutes » les lois locales)", () => {
    const { H, E } = setup();
    H.weapons = [RANGED];
    H.pos = { x: 0, y: 0 };
    E.pos = { x: 5, y: 0 };
    banc.setState({ battle: { ...banc.getState().battle!, victoryCondition: { type: 'firstBlood' }, banRanged: false } });
    expect(resolveAttack(banc.getState, H, E)).not.toBeNull();
    expect(firedAttackBlock(banc.getState, H, E)).toBeNull();
  });
});

describe('Duel judiciaire — premier sang mesuré sur le coup FINALISÉ (#471 défaut 2, Blessures ajoutées par un Critique)', () => {
  it('coup relancé au Bras gauche (1 Blessure) + Coupure profonde (+3, LDB 18) = 4 > seuil 3 → premier sang déclenché', () => {
    const { H, E } = setup();
    E.important = true; // LDB 18 l.44 : hors Mort subite
    E.wounds = blessuresDeBase(20, 20, E);
    E.armour = { corps: 0, tete: 0, brasD: 0, brasG: 0, jambeD: 0, jambeG: 0 } as never;
    banc.getState().seedRng(1); // graine calibrée : table du Bras, « Coupure profonde » (+3 Blessures)
    banc.setState({ battle: { ...banc.getState().battle!, victoryCondition: { type: 'firstBlood' } } });
    const res: AttackResult = {
      hit: true, attackerRoll: 33, netSL: 1, location: 'corps', critLocation: 'brasG', damage: 2, woundsLost: 2,
      critical: true, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    applyAttackResult(banc.getState, banc.setState, H, E, H.weapons[0], res);
    draineCascade(banc.getState); // la sévérité du Critique se tire DANS la fenêtre (#1426)
    const e = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(20 - e.wounds.current).toBe(4); // 1 de base (relancée au Bras gauche) + 3 du Critique
    expect(e.outOfRencontre).toBe(true);
    expect(e.exitReason).toBe('firstBlood');
  });
});
