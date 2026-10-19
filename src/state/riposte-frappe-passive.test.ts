/**
 * LA FRAPPE PASSIVE (Riposte LDB 10 l.1037, Champion LDB 85 l.71) passe par l'applicateur de la touche, au
 * temps `reaction` de l'après-coup du coup qui la provoque (#1595 c.6234104573) : dépassement des PB et Mort
 * subite (LDB 18 l.17, l.46), arme de la défense, plafond du Round, déclaration, Coup Critique (LDB 13 l.183),
 * Avantage (LDB 14 l.208-209), suspension puis reprise de la suite.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { applyAttackResult } from './combatFlow';
import { seedBattleRng } from '../noyau/battleRng';
import { resetRule } from '../engine/policy';
import { resolveMeleePassive, type AttackResult } from '../engine/combat';
import { isOutOfAction } from '../engine/conditions';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';
import { avanceEtapeCascade, poseSurDeNonTombe } from './cascadeTestKit';
import { unarmedWeapon } from '../engine/items';
import { weaponsFromTraits } from '../engine/creatureEquip';
import { findCritEntrySuffered } from '../engine/critical';
import { makeRNG } from '../engine/dice';

const g = useGame.getState;
const CH = { 'capacite-de-combat': 60, 'capacite-de-tir': 30, force: 60, endurance: 20, initiative: 40, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const arme = (uid: string, flat: number, qualities: { id: string }[]): Weapon =>
  ({ uid, name: uid, label: uid, type: 'melee', damage: { plusBF: true, flat, bare: false }, qualities }) as unknown as Weapon;
const RAPIERE = arme('rapiere', 4, [{ id: 'rapide' }]);
const HACHE = arme('hache', 9, []);
const EPEE = arme('epee', 4, []);
const ARM0 = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

/** `d` (Riposte, niveau `niveau`) s'est défendu contre `a`, qui frappait à l'Épée. */
function monte(o: { pbAttaquant: number; important?: boolean; armes?: Weapon[]; niveau?: number; traitsAttaquant?: { id: string; value?: number }[]; champion?: boolean; riposte?: boolean; traitsDefenseur?: { id: string; value?: number }[] }): void {
  seedBattleRng(5);
  const d = {
    id: 'd', name: 'd', label: 'Défenseur', kind: 'enemy', important: true, characteristics: { ...CH }, wounds: { current: 30, max: 30 },
    advantage: 0, conditions: [], movement: 4, skills: [], talents: o.champion && !o.riposte ? [] : [{ talentId: 'riposte', times: o.niveau ?? 1 }], traits: [...(o.champion ? [{ id: 'champion' }] : []), ...(o.traitsDefenseur ?? [])],
    engagedWith: ['a'], pos: { x: 1, y: 0 }, size: 'moyenne', weapons: o.armes ?? [RAPIERE], armour: ARM0, items: [], criticalWounds: 0, traumas: [],
  } as unknown as Combatant;
  const a = {
    id: 'a', name: 'a', label: 'Attaquant', kind: 'enemy', important: o.important ?? true, characteristics: { ...CH },
    wounds: { current: o.pbAttaquant, max: 30 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: o.traitsAttaquant ?? [],
    engagedWith: ['d'], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [EPEE], armour: ARM0, items: [], criticalWounds: 0, traumas: [],
  } as unknown as Combatant;
  const h = { ...a, id: 'h', name: 'h', label: 'Témoin', kind: 'hero', important: true, wounds: { current: 30, max: 30 }, engagedWith: [], pos: { x: 6, y: 6 }, traits: [] } as unknown as Combatant;
  const battle = {
    combatants: [a, d, h], order: ['a', 'd', 'h'], baseOrder: ['a', 'd', 'h'], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), party: [h], pendingDefense: null, pendingAttack: null, pendingCascade: null,
    suspendedCascades: [], pendingLogQueue: [], journal: [], net: { ...g().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  } as never);
}

/** Test opposé GAGNÉ par la défense, au jet `roll` (réussi sauf `success: false`), parade à `parade`. */
const defenseGagnee = (parade: Weapon, roll = 12, success = true): AttackResult => ({
  hit: false, attackerRoll: 64, defenderRoll: roll, netSL: 4, critical: false, advantageTo: 'defender', defenderDefeated: false, log: 'Attaquant manque Défenseur.',
  parryWeapon: parade,
  defenderDetail: { label: 'Corps à corps', base: 60, target: 60, roll, success, sl: success ? 5 : -1, mods: [], mode: 'parade' },
  attackerDetail: { label: 'Corps à corps', base: 60, target: 60, roll: 64, success: false, sl: -1, mods: [] },
} as unknown as AttackResult);

const cur = (id: string): Combatant => g().battle!.combatants.find((c) => c.id === id)!;
/** Joue chaque fenêtre du coup (Blessure critique, sauvegarde) au dé 1, Critique subi. */
const draine = (): void => { for (let k = 0; k < 20 && g().pendingCascade; k++) avanceEtapeCascade(g, poseSurDeNonTombe(1), () => 'subir'); };
const coup = (res: AttackResult, suite: Record<string, unknown> = {}) =>
  applyAttackResult(g, useGame.setState, cur('a'), cur('d'), EPEE, res, { suite: { enchainement: { mode: 'aucun' }, ...suite } });

describe('frappe passive — Riposte par l’applicateur de la touche', () => {
  beforeEach(() => { useGame.setState({ battle: null }); });
  afterEach(() => { resetRule('combat-sudden-death'); });

  it('R1 — dépassement des PB : Blessure critique appliquée, PB à 0 (LDB 18 l.17)', () => {
    monte({ pbAttaquant: 2 });
    coup(defenseGagnee(RAPIERE)); draine();
    expect(cur('a').wounds.current).toBe(0);
    expect(cur('a').criticalWounds ?? 0).toBeGreaterThan(0);
  });

  it('R2 — dépassement d’un PNJ mineur, Mort subite active : hors de combat (LDB 18 l.46)', () => {
    monte({ pbAttaquant: 2, important: false });
    coup(defenseGagnee(RAPIERE)); draine();
    expect(isOutOfAction(cur('a'))).toBe(true);
  });

  it('R3 — frappe avec l’arme de PARADE Rapide, jamais `weapons[0]` (LDB 10 l.1037)', () => {
    monte({ pbAttaquant: 30, armes: [HACHE, RAPIERE] });
    const attendu = resolveMeleePassive(cur('d'), cur('a'), RAPIERE, { roll: 12, target: 60, success: true, sl: 4, isDouble: false }, { rng: makeRNG(1595) }).woundsLost!;
    const hache = resolveMeleePassive(cur('d'), cur('a'), HACHE, { roll: 12, target: 60, success: true, sl: 4, isDouble: false }, { rng: makeRNG(1595) }).woundsLost!;
    expect(attendu).not.toBe(hache);
    coup(defenseGagnee(RAPIERE)); draine();
    expect(30 - cur('a').wounds.current).toBe(attendu);
  });

  it('R4 — Niveau 1 : deux défenses gagnées dans le Round, une seule Riposte', () => {
    monte({ pbAttaquant: 30 });
    coup(defenseGagnee(RAPIERE)); draine();
    const apres1 = cur('a').wounds.current;
    expect(apres1).toBeLessThan(30);
    coup(defenseGagnee(RAPIERE)); draine();
    expect(cur('a').wounds.current).toBe(apres1);
  });

  it('R5 — Riposte refusée (`riposte: false`) : aucune frappe', () => {
    monte({ pbAttaquant: 30 });
    coup(defenseGagnee(RAPIERE), { riposte: false });
    expect(cur('a').wounds.current).toBe(30);
  });

  it('R6 — Empaleuse, jet de défense réussi sur un multiple de 10 : Coup Critique de la frappe (LDB 62 l.248)', () => {
    const empaleuse = arme('estoc', 3, [{ id: 'rapide' }, { id: 'empaleuse' }]);
    monte({ pbAttaquant: 30, armes: [empaleuse] });
    coup(defenseGagnee(empaleuse, 30)); draine();
    expect(cur('a').criticalWounds ?? 0).toBeGreaterThan(0);
  });

  it('R7 — aucun Avantage en plus de celui de la défense gagnée (LDB 14 l.208-209)', () => {
    monte({ pbAttaquant: 30 });
    coup(defenseGagnee(RAPIERE)); draine();
    expect(cur('a').wounds.current).toBeLessThan(30);
    expect(cur('d').advantage).toBe(1);
  });

  it('R8 — frappe suspendue par une sauvegarde, puis reprise : la suite du coup reprend une fois', () => {
    monte({ pbAttaquant: 30, traitsAttaquant: [{ id: 'demoniaque', value: 9 }] });
    coup(defenseGagnee(RAPIERE), { enchainement: { mode: 'aucun' }, restitution: { prevActed: false } });
    expect(g().pendingCascade, 'la sauvegarde de l’attaquant tient la main').not.toBeNull();
    expect(g().battle!.acted, 'la suite du coup attend la reprise').toBe(true);
    draine();
    expect(cur('a').wounds.current).toBeLessThan(30);
    expect(g().battle!.acted, 'la suite du coup a rendu l’Action').toBe(false);
  });

  it('R9 — double RÉUSSI au Test de défense : UN Critique, celui de la défense, la frappe n’en ajoute pas (LDB 13 l.183 ; LDB 14 l.3)', () => {
    monte({ pbAttaquant: 30 });
    coup(defenseGagnee(RAPIERE, 11)); draine();
    expect(cur('a').wounds.current).toBeLessThan(30);
    expect(cur('a').criticalWounds).toBe(1);
  });

  it('R10 — Empaleuse, défense RATÉE sur un multiple de 10 mais gagnée : frappe sans Critique (LDB 13 l.183 ; LDB 62 l.248)', () => {
    const empaleuse = arme('estoc', 3, [{ id: 'rapide' }, { id: 'empaleuse' }]);
    monte({ pbAttaquant: 30, armes: [empaleuse] });
    coup(defenseGagnee(empaleuse, 70, false)); draine();
    expect(cur('a').wounds.current).toBeLessThan(30);
    expect(cur('a').criticalWounds ?? 0).toBe(0);
  });

  // LDB 14 l.3 ; LDB 85 l.71 ; #1595 c.6240485441 Q4.
  it('R12 — double de l’attaquant qui PERD : son Critique met le défenseur hors de combat, aucune frappe passive', () => {
    monte({ pbAttaquant: 30 });
    seedBattleRng(37);
    const res = defenseGagnee(RAPIERE);
    coup({ ...res, attackerDetail: { ...res.attackerDetail!, roll: 33, success: true, sl: 2 } }); draine();
    const [ligne] = cur('d').critEntriesSuffered ?? [];
    expect(findCritEntrySuffered(ligne)?.entry.lethal, `la graine 37 tire une ligne létale (${ligne})`).toBe(true);
    expect(isOutOfAction(cur('d'))).toBe(true);
    expect(cur('a').wounds.current).toBe(30);
    expect(cur('d').ripostesThisRound ?? 0).toBe(0);
  });

  it('R11 — Champion (trait) : la frappe part sans déclaration, à l’arme non Rapide (LDB 85 l.71)', () => {
    monte({ pbAttaquant: 30, champion: true, armes: [EPEE] });
    coup(defenseGagnee(EPEE), { riposte: false }); draine();
    expect(cur('a').wounds.current).toBeLessThan(30);
  });
});

/** Test opposé GAGNÉ par une ESQUIVE au jet `roll`, DR opposé `dr`. */
const esquiveGagnee = (roll = 12, dr = 4): AttackResult => ({
  hit: false, attackerRoll: 64, defenderRoll: roll, netSL: dr, critical: false, advantageTo: 'defender', defenderDefeated: false, log: 'Attaquant manque Défenseur.',
  defenderDetail: { label: 'Esquive', base: 60, target: 60, roll, success: true, sl: 5, mods: [], mode: 'esquive' },
  attackerDetail: { label: 'Corps à corps', base: 60, target: 60, roll: 64, success: false, sl: -1, mods: [] },
} as unknown as AttackResult);
/** Blessures de la frappe de `d` à l'arme `w`, au jet `roll` et au DR `dr`. */
const blessures = (w: Weapon, dr = 4, roll = 12): number =>
  resolveMeleePassive(cur('d'), cur('a'), w, { roll, target: 60, success: true, sl: dr, isDouble: false }, { rng: makeRNG(1595) }).woundsLost!;

describe('frappe passive — Champion (LDB 85 l.71), arbitre c.6237601266', () => {
  beforeEach(() => { useGame.setState({ battle: null }); });

  it('C1 — Esquive gagnée sur un double : frappe à l’arme de main principale, sans Critique (LDB 13 l.183 ; LDB 10 l.500)', () => {
    const secondaire = { ...HACHE, hand: 'off' } as Weapon;
    monte({ pbAttaquant: 30, champion: true, armes: [secondaire, EPEE] });
    expect(blessures(EPEE)).not.toBe(blessures(HACHE));
    coup(esquiveGagnee(11)); draine();
    expect(30 - cur('a').wounds.current).toBe(blessures(EPEE));
    expect(cur('a').criticalWounds ?? 0).toBe(0);
  });

  it('C2 — mains vides, Esquive gagnée : frappe à Mains nues (LDB 14 l.139)', () => {
    monte({ pbAttaquant: 30, champion: true, armes: [] });
    coup(esquiveGagnee()); draine();
    expect(30 - cur('a').wounds.current).toBe(blessures(unarmedWeapon()));
  });

  it('C3 — trait Arme +8, Esquive gagnée à DR égal : Dégâts = l’Indice (LDB 85 l.35)', () => {
    const traits = [{ id: 'arme', value: 8 }];
    monte({ pbAttaquant: 30, champion: true, armes: weaponsFromTraits(traits), traitsDefenseur: traits });
    coup(esquiveGagnee(12, 0)); draine();
    expect(30 - cur('a').wounds.current).toBe(8 - 2);
  });

  it('C4 — Champion et Riposte, Parade gagnée : une seule frappe, la Riposte ne décompte rien', () => {
    monte({ pbAttaquant: 30, champion: true, riposte: true });
    coup(defenseGagnee(RAPIERE)); draine();
    expect(30 - cur('a').wounds.current).toBe(blessures(RAPIERE));
    expect(cur('d').ripostesThisRound ?? 0).toBe(0);
  });

  it('C5 — défense gagnée à DR égal, départagée par la Compétence : la Riposte frappe aux Dégâts d’Arme (LDB 12 l.160)', () => {
    monte({ pbAttaquant: 30 });
    coup({ ...defenseGagnee(RAPIERE), netSL: 0 }); draine();
    expect(30 - cur('a').wounds.current).toBe(blessures(RAPIERE, 0));
  });

  it('C5 — défense gagnée à DR égal : le Champion frappe aux Dégâts d’Arme (LDB 12 l.160 ; LDB 13 l.123)', () => {
    monte({ pbAttaquant: 30, champion: true, armes: [EPEE] });
    coup({ ...defenseGagnee(EPEE), netSL: 0 }); draine();
    expect(30 - cur('a').wounds.current).toBe(blessures(EPEE, 0));
  });

  it('C6 — Riposte, Esquive gagnée : aucune frappe (LDB 10 l.1032)', () => {
    monte({ pbAttaquant: 30 });
    coup(esquiveGagnee()); draine();
    expect(cur('a').wounds.current).toBe(30);
  });

  it('C7 — défense gagnée contre un tir : aucune frappe du Champion (LDB 85 l.71)', () => {
    const ARC = { ...EPEE, uid: 'arc', type: 'ranged', range: 60 } as Weapon;
    monte({ pbAttaquant: 30, champion: true, armes: [EPEE] });
    applyAttackResult(g, useGame.setState, cur('a'), cur('d'), ARC, esquiveGagnee(), { suite: { enchainement: { mode: 'aucun' } } }); draine();
    expect(cur('a').wounds.current).toBe(30);
  });

  it('C1 — Empaleuse, Esquive réussie sur un multiple de 10 : frappe sans Critique (LDB 13 l.183 ; LDB 62 l.248)', () => {
    const empaleuse = arme('estoc', 3, [{ id: 'empaleuse' }]);
    monte({ pbAttaquant: 30, champion: true, armes: [empaleuse] });
    coup(esquiveGagnee(30)); draine();
    expect(cur('a').wounds.current).toBeLessThan(30);
    expect(cur('a').criticalWounds ?? 0).toBe(0);
  });

  it('Empaleuse, défense sociale réussie sur un multiple de 10 : frappe sans Critique (LDB 13 l.161-167, l.183 ; LDB 62 l.248)', () => {
    const empaleuse = arme('estoc', 3, [{ id: 'empaleuse' }]);
    monte({ pbAttaquant: 30, champion: true, armes: [empaleuse] });
    const sociale = esquiveGagnee(30);
    coup({ ...sociale, defenderDetail: { ...sociale.defenderDetail!, label: 'Intimidation', mode: 'social' } }); draine();
    expect(cur('a').wounds.current).toBeLessThan(30);
    expect(cur('a').criticalWounds ?? 0).toBe(0);
  });
});
