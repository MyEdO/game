import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { maybeOpenDefense, openAttackCascade } from './combatFlow';
import { seedBattleRng } from '../noyau/battleRng';
import { createHero } from '../engine/character';
import { resetRule, setRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, HitLocation, Weapon } from '../engine/types';

/** La Localisation relancée se décide une fois par jet : LDB 18 l.53, l.55 ; LDB 17 l.68 ; LDB 23 l.209 ; AA 07 l.25, l.32 ; #1595. */

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [sword], advantage: 0, size: 'moyenne', pos, wounds: { current: 200, max: 200 }, fortune: 3,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 } as unknown as Combatant);

/** Un ennemi à CC 95 frappe un héros à CC/Ag 5 ; `gmSeat` pose un siège MJ (attaquant piloté). */
function duel(seed: number, gmSeat?: number) {
  seedBattleRng(seed);
  const enemy = mk('e', 'enemy', { x: 1, y: 0 });
  enemy.characteristics['capacite-de-combat'] = 95;
  const hero = mk('h', 'hero', { x: 0, y: 0 });
  hero.characteristics['capacite-de-combat'] = 5; hero.characteristics.agilite = 5;
  const battle = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat, ownership: {} },
  });
  return { enemy, hero };
}

describe('Localisation relancée — choix forcé puis +1 DR (T3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    setRule('combat-aa-blessures', 'aa');
    useGame.setState({ battle: null, pendingAttack: null });
  });
  afterEach(() => {
    resetRule('combat-aa-blessures');
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** Le héros force sa touche sur une cible déjà à 0, puis choisit une Localisation autre que celle tirée. */
  function forceEtChoisit(): HitLocation {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 10, y: 10 };
    H.resilience = 1;
    H.fortune = 2;
    E.pos = { x: 11, y: 10 };
    E.wounds = { current: 0, max: 30 } as never;
    E.talents = [{ talentId: 'chanceux', times: 1 }] as never; // AA 07 l.67
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id), movementUsed: 0, movedPreAction: false, acted: false } });
    useGame.getState().battleClickEntity(E.id, { confirm: true });
    seedBattleRng(3);
    useGame.getState().attackRoll();
    useGame.getState().attackForceSuccess();
    useGame.getState().attackSetForcedRoll(21);
    expect(useGame.getState().pendingAttack!.result!.critLocation, 'la touche relance la Localisation').toBeDefined();
    const choisie: HitLocation = useGame.getState().pendingAttack!.result!.critLocation === 'jambeG' ? 'brasD' : 'jambeG';
    useGame.getState().attackSetCritLocation(choisie);
    return choisie;
  }

  it("'aa', cible déjà à 0 : la Localisation choisie survit à la dépense de +1 DR", () => {
    const choisie = forceEtChoisit();
    const slAvant = useGame.getState().pendingAttack!.result!.netSL;
    useGame.getState().attackBonusSL();
    const res = useGame.getState().pendingAttack!.result!;
    expect(res.netSL, 'le +1 DR est bien dépensé').not.toBe(slAvant);
    expect(res.critLocation).toBe(choisie);
  });

  it("'aa', cible déjà à 0 : la Localisation choisie survit au changement du dé posé", () => {
    const choisie = forceEtChoisit();
    useGame.getState().attackSetForcedRoll(12);
    const res = useGame.getState().pendingAttack!.result!;
    expect(res.attackerRoll, 'le dé posé a changé').toBe(12);
    expect(res.critLocation).toBe(choisie);
  });
});

describe('Localisation relancée — la défense dépense +1 DR puis la Chance (T8)', () => {
  it("la Localisation de la touche reste celle du premier jet de défense", () => {
    let vus = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const { enemy, hero } = duel(seed);
      if (!maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)) continue;
      const g = useGame.getState;
      g().defenseRoll();
      const premier = g().pendingDefense!.result!.critLocation;
      if (!premier) continue;
      g().defenseBonusSL();
      const apresBonus = g().pendingDefense!.result!;
      g().defenseReroll();
      const apresChance = g().pendingDefense!.result!;
      if (!apresBonus.critLocation || !apresChance.critLocation) continue;
      vus++;
      expect(apresBonus.critLocation, `graine ${seed}, +1 DR`).toBe(premier);
      expect(apresChance.critLocation, `graine ${seed}, Chance`).toBe(premier);
    }
    expect(vus, 'des graines relancent la Localisation à travers les deux dépenses').toBeGreaterThan(3);
  });
});

describe('Localisation relancée — défense pilotée, `openSurfacedDefense` (T9)', () => {
  it("la Localisation à l'ouverture de la fenêtre est celle de la résolution", () => {
    let vus = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const { enemy, hero } = duel(seed, 0);
      const g = useGame.getState;
      openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
      g().attackRoll();
      const ouverture = g().pendingAttack?.result?.critLocation;
      g().attackConfirm();
      if (!ouverture || !g().pendingDefense) continue;
      g().defenseRoll();
      const resolue = g().pendingDefense!.result!.critLocation;
      if (!resolue) continue;
      vus++;
      expect(resolue, `graine ${seed}`).toBe(ouverture);
    }
    expect(vus, 'des graines relancent la Localisation à travers la fenêtre').toBeGreaterThan(3);
  });
});
