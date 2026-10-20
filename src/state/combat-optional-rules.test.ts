import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import type { BattleState } from '../noyau/etat';
import { draineCascade } from './cascade.testkit';
import { applyAttackResult, applyOpposedCritical, attackEnv } from '../noyau/combatFlow';
import { seedBattleRng } from '../noyau/battleRng';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { resolveMelee } from '../engine/combat';
import { makeRNG } from '../engine/dice';
import { emptyScene } from '../noyau/monde/scene';
import { OPS_DIFFEREES } from '../noyau/combatEffects';

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h1', name: 'Hardi', kind: 'hero', characteristics: CHARS,
    wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [], fate: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as unknown as Combatant);

const enemy = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'e1', name: 'Brute', kind: 'enemy', important: true /* LDB 18 l.44 : hors Mort subite */, characteristics: CHARS,
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 1, y: 0 }, size: 'moyenne',
    weapons: [{ label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] } as Weapon], items: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as unknown as Combatant);

function setBattle(combatants: Combatant[]): BattleState {
  const battle: BattleState = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene('scene-test'), gameTime: 12 * 60, pendingCascade: null, pendingFateSave: null });
  return battle;
}

// ── Règle 1 : « Sur la Défensive » (combat-defensive-stance, LDB 13 l.118) ──
describe('combat-defensive-stance — Action « Sur la Défensive » (LDB 13 l.118)', () => {
  beforeEach(() => { seedBattleRng(1); });
  afterEach(() => resetRule('combat-defensive-stance'));

  it('défaut (true) : battleDefendTotal pose defensiveStance et consomme l’Action', () => {
    const h = hero({});
    setBattle([h, enemy({})]);
    useGame.getState().battleDefendTotal();
    const st = useGame.getState().battle!;
    expect(st.combatants.find((c) => c.id === 'h1')!.defensiveStance).toBe(true);
    expect(st.acted).toBe(true);
  });

  it('désactivée : l’Action est refusée (pas de defensiveStance, Action intacte)', () => {
    setRule('combat-defensive-stance', false);
    const h = hero({});
    setBattle([h, enemy({})]);
    useGame.getState().battleDefendTotal();
    const st = useGame.getState().battle!;
    expect(st.combatants.find((c) => c.id === 'h1')!.defensiveStance).toBeFalsy();
    expect(st.acted).toBe(false); // Action non consommée
  });
});

// ── Règle 2 : « Déviation Critique » (combat-critical-deflect, LDB 63 l.30) ──
describe('combat-critical-deflect — offre de Déviation Critique (LDB 63 l.30)', () => {
  beforeEach(() => { seedBattleRng(424242); });
  afterEach(() => resetRule('combat-critical-deflect'));

  const critWeapon: Weapon = { label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };
  // `critLocation: 'corps'` fige la localisation re-tirée du Critique (LDB 18 l.55, #80) sur la zone armée
  // → la Déviation (#43.2, gatée sur cette localisation) y est offerte/sacrifiée de façon déterministe.
  const critRes = (): AttackResult => ({
    hit: true, attackerRoll: 12, netSL: 4, location: 'corps', critLocation: 'corps', damage: 8, woundsLost: 3,
    critical: true, advantageTo: null, defenderDefeated: false, log: 'Coup Critique (corps)',
  });

  it('défaut (true) : un héros blindé encaissant un Critique → SUSPEND (étape de déviation)', () => {
    const e = enemy({});
    const h = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    setBattle([e, h]);
    const suspended = applyAttackResult(useGame.getState, useGame.setState, e, h, critWeapon, critRes());
    expect(suspended).toBe(OPS_DIFFEREES);
    const dev = useGame.getState().pendingCascade?.participants.find((s) => s.kind === 'deviation');
    expect(dev).toBeTruthy();
  });

  it('désactivée : pas d’offre de déviation → le Critique est subi directement (criticalWounds +1)', () => {
    setRule('combat-critical-deflect', false);
    const e = enemy({});
    const h = hero({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 }, criticalWounds: 0 });
    setBattle([e, h]);
    const suspended = applyAttackResult(useGame.getState, useGame.setState, e, h, critWeapon, critRes());
    // La sévérité se tire toujours dans SA fenêtre (#1426) ; c'est la DÉCISION qui disparaît : l'étape
    // ne porte AUCUNE voie, donc le Critique est subi tel quel.
    expect(suspended).toBe(OPS_DIFFEREES);
    const dev = useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
    expect(dev).toHaveLength(1);
    expect(dev[0].options, 'règle désactivée → aucune voie de Déviation').toBeUndefined();
    draineCascade(useGame.getState);
    const hh = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(hh.criticalWounds ?? 0).toBe(1); // Critique subi
    expect(hh.armour.corps).toBe(3);        // PA intacte (pas de déviation)
  });

  it('désactivée : un ENNEMI blindé ne dévie plus automatiquement (subit le Critique)', () => {
    setRule('combat-critical-deflect', false);
    const e = enemy({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 }, criticalWounds: 0 });
    const h = hero({});
    setBattle([h, e]);
    applyAttackResult(useGame.getState, useGame.setState, h, e, critWeapon, critRes());
    draineCascade(useGame.getState); // aucun siège ne tient l'ennemi : sa table est résolue d'office
    const ee = useGame.getState().battle!.combatants.find((c) => c.id === 'e1')!;
    expect(ee.armour.corps).toBe(3);          // PA intacte (pas d'auto-déviation)
    expect(ee.criticalWounds ?? 0).toBe(1);   // Critique subi
  });

  // Test OPPOSÉ (LDB 14 l.3) : la déviation auto de l'ENNEMI y était jadis INLINE et NON rule-gated.
  // Mutualisée via `enemyAutoDeviate`, elle respecte désormais la règle (bug rule-gate corrigé). Armure
  // uniforme sur toutes les localisations → la loc 1d100 frais du Critique sec porte toujours de la PA.
  const armoured = { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 };
  const apSum = (c: Combatant) => Object.values(c.armour).reduce((a, b) => a + b, 0);

  it('opposé : ENNEMI blindé dévie AUTO quand la règle est ON (−1 PA, Critique ignoré)', () => {
    const e = enemy({ armour: { ...armoured }, criticalWounds: 0 });
    setBattle([hero({}), e]);
    applyOpposedCritical(useGame.getState, useGame.setState, e, 11, { attackerId: 'h1' }, []);
    const ee = useGame.getState().battle!.combatants.find((c) => c.id === 'e1')!;
    expect(ee.criticalWounds ?? 0).toBe(0); // Critique dévié
    expect(apSum(ee)).toBe(17);             // une zone −1 PA
  });

  it('opposé désactivé : ENNEMI blindé ne dévie PLUS (subit le Critique sec — bug rule-gate)', () => {
    setRule('combat-critical-deflect', false);
    const e = enemy({ armour: { ...armoured }, criticalWounds: 0 });
    setBattle([hero({}), e]);
    applyOpposedCritical(useGame.getState, useGame.setState, e, 11, { attackerId: 'h1' }, []);
    const ee = useGame.getState().battle!.combatants.find((c) => c.id === 'e1')!;
    expect(ee.criticalWounds ?? 0).toBe(1); // Critique subi (pas d'auto-déviation)
    expect(apSum(ee)).toBe(18);             // PA toute intacte
  });
});

// ── Règle 3 : « Tir dans un corps à corps » (combat-ranged-melee-penalty, LDB 14 l.112-116) ──
describe('combat-ranged-melee-penalty — −20 + tir égaré (LDB 14 l.112-116)', () => {
  beforeEach(() => { seedBattleRng(1); });
  afterEach(() => resetRule('combat-ranged-melee-penalty'));

  const bow: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 7 }, range: 30, qualities: [] } as Weapon;

  // « Tir dans la mêlée » = la cible est Engagée avec un ALLIÉ du tireur. Tireur HÉROS (arc), cible
  // ENNEMIE engagée avec un autre HÉROS (le combattant de mêlée du groupe).
  function meleeShotSetup() {
    const shooter = hero({ id: 'h1', pos: { x: 0, y: 0 }, weapons: [bow] });
    const targetEnemy = enemy({ id: 'e1', pos: { x: 5, y: 0 }, engagedWith: ['h2'] });
    const allyHero = hero({ id: 'h2', label: 'Allié', pos: { x: 6, y: 0 } });
    setBattle([shooter, targetEnemy, allyHero]);
    return { shooter, targetEnemy, allyHero };
  }

  it('défaut (true) : la cible Engagée avec un allié → inMelee + ligne −20', () => {
    const { shooter, targetEnemy } = meleeShotSetup();
    const e = attackEnv(useGame.getState, shooter, targetEnemy, bow);
    expect(e.inMelee).toBe(true);
    expect(e.env.some((m) => m.value === -20 && /mêlée/i.test(m.label))).toBe(true);
  });

  it('désactivée : pas de −20 NI artefact d’aperçu (inMelee reste false)', () => {
    setRule('combat-ranged-melee-penalty', false);
    const { shooter, targetEnemy } = meleeShotSetup();
    const e = attackEnv(useGame.getState, shooter, targetEnemy, bow);
    expect(e.inMelee).toBe(false); // pas d'artefact d'affichage
    expect(e.env.some((m) => /Tir dans la mêlée/i.test(m.label))).toBe(false); // pas de malus
  });
});

// ── Règle 4 : « Cible Inconsciente » (combat-helpless-mode, LDB 16 l.113) ──
describe('combat-helpless-mode — cible Inconsciente (LDB 16 l.113)', () => {
  beforeEach(() => { seedBattleRng(7); });
  afterEach(() => resetRule('combat-helpless-mode'));

  const sword: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 3 }, qualities: [] } as Weapon;

  it('défaut (critique) : resolveMelee NE marque PAS autoKill (comportement RAW = Critique)', () => {
    const atk = enemy({});
    const def = hero({ conditions: [{ id: 'inconscient', value: 1 }] });
    const res = resolveMelee(atk, def, sword, makeRNG(1), { defense: 'none' });
    expect(res.autoKill).toBeFalsy();
    expect(res.hit).toBe(true);
    expect(res.critical).toBe(true); // helpless → réussite critique (RAW)
  });

  it('mort-auto : resolveMelee marque autoKill sur une cible Inconsciente en MÊLÉE', () => {
    setRule('combat-helpless-mode', 'mort-auto');
    const atk = enemy({});
    const def = hero({ conditions: [{ id: 'inconscient', value: 1 }] });
    const res = resolveMelee(atk, def, sword, makeRNG(1), { defense: 'none' });
    expect(res.autoKill).toBe(true);
    expect(res.hit).toBe(true);
  });

  it('mort-auto + mêlée : applyAttackResult TUE une cible SANS Destin (dead via chemin normal)', () => {
    setRule('combat-helpless-mode', 'mort-auto');
    const atk = hero({ id: 'h1', pos: { x: 0, y: 0 } });
    const victim = enemy({ id: 'e1', pos: { x: 1, y: 0 }, wounds: { current: 20, max: 20 }, conditions: [{ id: 'inconscient', value: 1 }] });
    setBattle([atk, victim]);
    const res: AttackResult = {
      hit: true, attackerRoll: 10, netSL: 5, location: 'tete', damage: 12, woundsLost: 5,
      critical: true, advantageTo: null, defenderDefeated: false, autoKill: true, log: 'Achève',
    };
    const suspended = applyAttackResult(useGame.getState, useGame.setState, atk, victim, sword, res);
    expect(suspended).toBeUndefined();
    const v = useGame.getState().battle!.combatants.find((c) => c.id === 'e1')!;
    expect(v.dead).toBe(true);            // mort par le chemin normal (finalizeHeroDeath)
    expect(v.wounds.current).toBe(0);
    expect(useGame.getState().pendingFateSave).toBeNull(); // ennemi : pas de Destin
  });

  it('mort-auto + mêlée : un HÉROS à Destin déclenche le sauvetage (pendingFateSave), pas une mort sèche', () => {
    setRule('combat-helpless-mode', 'mort-auto');
    const atk = enemy({ id: 'e1', pos: { x: 0, y: 0 } });
    const victim = hero({ id: 'h1', pos: { x: 1, y: 0 }, fate: 2, wounds: { current: 12, max: 12 }, conditions: [{ id: 'inconscient', value: 1 }] });
    setBattle([atk, victim]);
    const res: AttackResult = {
      hit: true, attackerRoll: 10, netSL: 5, location: 'tete', damage: 12, woundsLost: 5,
      critical: true, advantageTo: null, defenderDefeated: false, autoKill: true, log: 'Achève',
    };
    const suspended = applyAttackResult(useGame.getState, useGame.setState, atk, victim, sword, res);
    expect(suspended).toBeUndefined();
    const v = useGame.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(v.dead).toBeFalsy();                                    // pas de mort sèche
    expect(useGame.getState().pendingFateSave).not.toBeNull();    // sauvetage par Destin proposé
    expect(useGame.getState().pendingFateSave!.heroId).toBe('h1');
    expect(useGame.getState().pendingFateSave!.source).toBe('hit');
  });
});
