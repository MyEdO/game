/**
 * « Comment ça a pu rater ? » (LDB 17 l.32) : le héros qui dépense son Destin sur le coup qui le tue
 * « parvient à éviter complètement les Dégâts […] sans subir aucune pénalité » — il redevient celui
 * d'avant le coup, Destin −1. Un cas par chemin qui ouvre le sauvetage sur le coup (`finalizeHeroDeath`).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from '../store';
import type { BattleState } from '../../noyau/etat';
import { applyAttackResult, applyCast, applyOpposedCritical, releaseSeatsOfDowned } from '../../noyau/combatFlow';
import { evaluateMissile, type CastResult } from '../../engine/magic';
import { draineCascade, type PoseDe } from '../cascade.testkit';
import { seedBattleRng } from '../../noyau/battleRng';
import { emptyScene } from '../../noyau/monde/scene';
import { setRule, resetRule } from '../../engine/policy';
import type { AttackResult } from '../../engine/combat';
import type { Combatant, Weapon } from '../../engine/types';

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 };

const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  ({
    id, label: id, kind, characteristics: { ...CHARS },
    wounds: { current: 30, max: 30 }, advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne', important: true,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  } as unknown as Combatant);

/** Ilyanwe : héroïne à 3 PB, 2 Avantages, 2 Points de Destin, aucun État. */
const ilyanwe = (over: Partial<Combatant> = {}): Combatant =>
  mk('hero', 'ilyanwe', { label: 'Ilyanwe', wounds: { current: 3, max: 30 }, advantage: 2, fate: 2, pos: { x: 1, y: 0 }, ...over });

function setBattle(combatants: Combatant[]): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene('scene-test'), gameTime: 720, party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [] });
}

const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;

/** Les dés des tables de Critiques, posés dans l'ordre : 05 (Blessure spectaculaire, Hémorragique) puis
 *  100 (létal) — LDB 18 l.57. */
function critiquesSaigneePuisMort(): PoseDe {
  const des = [5, 100];
  return (etape) => ((etape.table && !etape.table.result) || (etape.de && !etape.de.result) ? des.shift() ?? 100 : undefined);
}

const vivant = (id: string): Combatant => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

/** Le héros que le coup a tué, sauvé par « Comment ça a pu rater ? ». */
function negation(id: string): Combatant {
  expect(useGame.getState().pendingFateSave?.heroId, 'témoin : le coup a ouvert le sauvetage par le Destin').toBe(id);
  useGame.getState().fateNegate();
  return vivant(id);
}

beforeEach(() => {
  seedBattleRng(1);
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCascade: null, pendingFateSave: null });
});
afterEach(() => { resetRule('combat-helpless-mode'); resetRule('combat-critical-deflect'); });

describe('LDB 17 l.32 — le Destin annule le coup entier', () => {
  it('coup d’arme : Critique saigné puis létal → ni Traumatisme, ni Hémorragique, ni Inconscient, ni À Terre', () => {
    const e = mk('enemy', 'e');
    const h = ilyanwe();
    setBattle([e, h]);
    const res: AttackResult = {
      hit: true, attackerRoll: 11, netSL: 4, location: 'tete', damage: 10, woundsLost: 10,
      critical: true, advantageTo: 'attacker', defenderDefeated: false, log: '',
    };
    applyAttackResult(useGame.getState, useGame.setState, e, h, epee, res);
    draineCascade(useGame.getState, 200, critiquesSaigneePuisMort());
    expect(vivant('ilyanwe').conditions.map((c) => c.id), 'témoin : le coup l’a saignée').toContain('hemorragique');
    const apres = negation('ilyanwe');
    expect({ pb: apres.wounds.current, avantage: apres.advantage, destin: apres.fate, etats: apres.conditions, traumas: apres.traumas, critiques: apres.criticalWounds, mort: !!apres.dead })
      .toEqual({ pb: 3, avantage: 2, destin: 1, etats: [], traumas: [], critiques: 0, mort: false });
  });

  it('Projectile magique : Critique saigné puis létal → le héros d’avant le Projectile', () => {
    const mage = mk('enemy', 'mage');
    const h = ilyanwe();
    setBattle([mage, h]);
    const dard = { id: 'dard-test', label: 'Dard', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: 1, duration: null, desc: '', source: { book: 'LDB', page: 0 }, missile: true, damage: 8 } as never;
    const lancer = { cast: true, roll: 44, target: 60, sl: 4, isCritical: true, isFumble: false, log: '' } as unknown as CastResult;
    applyCast(useGame.getState, useGame.setState, mage, h, dard, evaluateMissile(mage, h, dard, lancer), true, false, undefined, undefined);
    draineCascade(useGame.getState, 200, critiquesSaigneePuisMort());
    expect(vivant('ilyanwe').conditions.map((c) => c.id), 'témoin : le Projectile l’a saignée').toContain('hemorragique');
    const apres = negation('ilyanwe');
    expect({ pb: apres.wounds.current, avantage: apres.advantage, destin: apres.fate, etats: apres.conditions, traumas: apres.traumas, critiques: apres.criticalWounds })
      .toEqual({ pb: 3, avantage: 2, destin: 1, etats: [], traumas: [], critiques: 0 });
  });

  it('mort-auto sur un héros Inconscient (LDB 16 l.113) : PB et Engagement d’avant le coup', () => {
    setRule('combat-helpless-mode', 'mort-auto');
    const e = mk('enemy', 'e');
    const h = ilyanwe({ wounds: { current: 12, max: 30 }, conditions: [{ id: 'inconscient', value: 1 }] });
    setBattle([e, h]);
    const res: AttackResult = {
      hit: true, attackerRoll: 10, netSL: 5, location: 'tete', damage: 12, woundsLost: 5,
      critical: false, advantageTo: null, defenderDefeated: false, autoKill: true, log: '',
    };
    applyAttackResult(useGame.getState, useGame.setState, e, h, epee, res);
    const apres = negation('ilyanwe');
    expect({ pb: apres.wounds.current, destin: apres.fate, etats: apres.conditions.map((c) => c.id) }).toEqual({ pb: 12, destin: 1, etats: ['inconscient'] });
    expect({ heros: vivant('ilyanwe').engagedWith, attaquant: vivant('e').engagedWith }, 'LDB 13 l.169-171 : l’Engagement du coup tient, des deux côtés').toEqual({ heros: ['e'], attaquant: ['ilyanwe'] });
  });

  it('Critique du Test opposé (LDB 13 l.183), létal → le héros d’avant le Critique', () => {
    const e = mk('enemy', 'e');
    const h = ilyanwe();
    setBattle([e, h]);
    seedBattleRng(37); // localisation et sévérité tirées par le dé de bataille : 100, létal (LDB 18 l.57)
    applyOpposedCritical(useGame.getState, useGame.setState, h, 44, { attackerId: 'e', weapon: 'Épée', weaponObj: epee }, []);
    draineCascade(useGame.getState);
    const apres = negation('ilyanwe');
    expect({ pb: apres.wounds.current, avantage: apres.advantage, destin: apres.fate, etats: apres.conditions, critiques: apres.criticalWounds })
      .toEqual({ pb: 3, avantage: 2, destin: 1, etats: [], critiques: 0 });
  });

  it('Critique du Test opposé subi après l’offre de Déviation (LDB 63 l.30), létal → le héros d’avant le Critique', () => {
    setRule('combat-critical-deflect', true);
    const e = mk('enemy', 'e');
    const h = ilyanwe({ armour: { tete: 1, brasG: 1, brasD: 1, corps: 1, jambeG: 1, jambeD: 1 } });
    setBattle([e, h]);
    seedBattleRng(37); // même dé de bataille : le Critique pré-tiré de l'offre est létal
    applyOpposedCritical(useGame.getState, useGame.setState, h, 44, { attackerId: 'e', weapon: 'Épée', weaponObj: epee }, []);
    const etapes = draineCascade(useGame.getState, 200, undefined, (etape) => (etape.options?.some((o) => o.key === 'subir') ? 'subir' : undefined));
    expect(etapes, 'témoin : la Déviation a été offerte').toContain('deviation');
    const apres = negation('ilyanwe');
    expect({ pb: apres.wounds.current, avantage: apres.advantage, destin: apres.fate, etats: apres.conditions, critiques: apres.criticalWounds })
      .toEqual({ pb: 3, avantage: 2, destin: 1, etats: [], critiques: 0 });
  });
});

/** Le coup d'arme létal de `e` sur Ilyanwe, en présence de `f`, qui l'Engage et la craint. */
function chuteDIlyanwe(over: { e?: Partial<Combatant>; h?: Partial<Combatant> } = {}): void {
  const e = mk('enemy', 'e', { engagedWith: ['ilyanwe'], ...over.e });
  const f = mk('enemy', 'f', { engagedWith: ['ilyanwe'], psychState: [{ type: 'peur', sourceId: 'ilyanwe' }] } as Partial<Combatant>);
  const h = ilyanwe({ engagedWith: ['e', 'f'], ...over.h });
  setBattle([e, f, h]);
  useGame.setState({ scene: { ...emptyScene('scene-test'), seatAssignments: { banc: { 'place-1': { kind: 'entity', entityId: 'ilyanwe' } } } } as never });
  const res: AttackResult = {
    hit: true, attackerRoll: 11, netSL: 4, location: 'tete', damage: 10, woundsLost: 10,
    critical: true, advantageTo: 'attacker', defenderDefeated: false, log: '',
  };
  applyAttackResult(useGame.getState, useGame.setState, e, h, epee, res);
  draineCascade(useGame.getState, 200, critiquesSaigneePuisMort());
  expect(useGame.getState().pendingFateSave?.heroId, 'témoin : le coup a ouvert le sauvetage').toBe('ilyanwe');
}

describe('LDB 17 l.32 — les conséquences de la chute attendent le choix du Destin', () => {
  const issues = [
    ['négation', () => useGame.getState().fateNegate(), false],
    ['« Meurs un autre jour » (LDB 17 l.31)', () => useGame.getState().fateSurvive(), true],
    ['refus', () => useGame.getState().fateAccept(), true],
  ] as const;

  it.each(issues)('%s : Engagement chez les autres (LDB 13 l.169-171)', (_, choisir, chute) => {
    chuteDIlyanwe();
    choisir();
    expect(vivant('f').engagedWith).toEqual(chute ? [] : ['ilyanwe']);
  });

  it.each(issues)('%s : psychologie qui la visait (LDB 21)', (_, choisir, chute) => {
    chuteDIlyanwe();
    choisir();
    expect(vivant('f').psychState).toEqual(chute ? [] : [{ type: 'peur', sourceId: 'ilyanwe' }]);
  });

  it.each(issues)('%s : effet « à la mort » de la cible (Charnier, LDB 85)', (_, choisir, chute) => {
    chuteDIlyanwe({ h: { traits: [{ id: 'charnier' }] } as Partial<Combatant> });
    choisir();
    expect(useGame.getState().battle!.combatants.some((c) => c.summon)).toBe(chute);
  });

  it.each(issues)('%s : siège de la cible', (_, choisir, chute) => {
    chuteDIlyanwe();
    choisir();
    expect(useGame.getState().scene!.seatAssignments).toEqual(chute ? {} : { banc: { 'place-1': { kind: 'entity', entityId: 'ilyanwe' } } });
  });

  it('en attente du choix, la libération des sièges d’une autre chute laisse le sien', () => {
    chuteDIlyanwe();
    releaseSeatsOfDowned(useGame.getState, useGame.setState);
    expect(useGame.getState().scene!.seatAssignments).toEqual({ banc: { 'place-1': { kind: 'entity', entityId: 'ilyanwe' } } });
  });

  it('en attente du choix, un héros du groupe assis garde aussi le sien', () => {
    chuteDIlyanwe();
    const assis = { banc: { 'place-1': { kind: 'party', rang: 1 } } };
    useGame.setState({ party: [vivant('ilyanwe')], scene: { ...useGame.getState().scene!, seatAssignments: assis } as never });
    releaseSeatsOfDowned(useGame.getState, useGame.setState);
    expect(useGame.getState().scene!.seatAssignments).toEqual(assis);
  });

  it.each(issues)('%s : effet « à la mise hors de combat » de l’auteur (Affamé, LDB 85)', (_, choisir, chute) => {
    chuteDIlyanwe({ e: { traits: [{ id: 'affame' }], characteristics: { ...CHARS, 'force-mentale': 0 } } as Partial<Combatant> });
    seedBattleRng(3);
    choisir();
    expect([!!vivant('e').loseNextAction, !!vivant('e').loseNextMovement], 'Test de Force Mentale raté (FM 0, graine 3) : festin').toEqual([chute, chute]);
  });

  it.each(issues)('%s : issue du combat', (_, choisir, chute) => {
    chuteDIlyanwe();
    expect(useGame.getState().battle!.over, 'le combat attend le choix').toBeFalsy();
    choisir();
    expect(useGame.getState().battle!.over ?? null).toBe(chute ? 'defeat' : null);
  });
});
