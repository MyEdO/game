/**
 * Les conséquences d'une mise hors de combat se règlent au point canonique (`reglerLesChutes`), quel que
 * soit le chemin de la chute : l'Engagement (LDB 13 l.169-171), la psychologie qui visait le combattant
 * (LDB 21 l.75), l'effet « à la mise hors de combat » de l'auteur imputé (Affamé, LDB 85 l.16), le siège,
 * l'effet « à la mort » (Charnier, LDB 85). L'auteur est celui dont le coup a mis la victime hors de combat,
 * Critique de parade compris (LDB 13 l.183), avec ou sans Destin (LDB 17 l.29-32).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from '../store';
import type { BattleState } from '../../noyau/etat';
import { applyAttackResult, applyCast } from '../../noyau/combatFlow';
import { resolveWeaponArea, areaTargets } from '../../noyau/combatArea';
import { applyManeuverEffects } from '../../noyau/combatManeuvers';
import { runCombatHooks } from '../../noyau/combatHooks';
import { pushChoice } from '../../noyau/rollSeam';
import { seedBattleRng, battleRng } from '../../noyau/battleRng';
import { emptyScene } from '../../noyau/monde/scene';
import { findManeuverById } from '../../data';
import { setRule, resetRule } from '../../engine/policy';
import { isOutOfAction } from '../../engine/conditions';
import { parseQualityInstance } from '../../engine/qualities/normalize';
import { fixtureText } from '../../i18n/fixtureText';
import { draineCascade } from '../cascade.testkit';
import type { AttackResult } from '../../engine/combat';
import type { CastResult } from '../../engine/magic';
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

/** L'auteur : un héros Affamé (LDB 85 l.16), dont le Test de Force Mentale passe par sa fenêtre. */
const affame = (id: string, over: Partial<Combatant> = {}): Combatant =>
  mk('hero', id, { traits: [{ id: 'affame' }], ...over } as Partial<Combatant>);
/** Les dés de la cascade posés à 100 : Test de Force Mentale raté (festin), Critique de table létal (LDB 18 l.57). */
const cent = (): number => 100;

/** La victime : Charnier, à `pb` PB, Engagée avec `t` (témoin) qui la craint, assise au banc. */
const victime = (over: Partial<Combatant> = {}): Combatant =>
  mk('enemy', 'v', { traits: [{ id: 'charnier' }], wounds: { current: 5, max: 30 }, engagedWith: ['t'], pos: { x: 3, y: 0 }, ...over } as Partial<Combatant>);
const temoin = (): Combatant =>
  mk('hero', 't', { engagedWith: ['v'], psychState: [{ type: 'peur', sourceId: 'v' }], pos: { x: 4, y: 0 } } as Partial<Combatant>);

const ASSIS = { banc: { 'place-1': { kind: 'entity', entityId: 'v' } } };

/** Un adversaire à l'écart : le combat continue après la chute. */
const reste = (): Combatant => mk('enemy', 'x', { pos: { x: 9, y: 9 } });

function setBattle(combatants: Combatant[]): void {
  combatants = [...combatants, reste()];
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, zones: [],
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: { ...emptyScene('scene-test'), seatAssignments: ASSIS } as never, gameTime: 720,
    party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [], facing: {},
  });
}

const combattant = (id: string): Combatant => useGame.getState().battle!.combatants.find((c) => c.id === id)!;
/** L'écriture qui suit toute résolution (le propriétaire de l'état règle les chutes à chacune). */
const ecriture = (): void => { useGame.setState({ battle: { ...useGame.getState().battle! } }); draineCascade(useGame.getState, 200, cent); };

/** Les cinq conséquences de la chute de `v`, imputée à `auteurId`. */
function consequences(auteurId: string | null) {
  const s = useGame.getState();
  return {
    horsDeCombat: isOutOfAction(combattant('v')),
    engagement: combattant('t').engagedWith,
    psychologie: combattant('t').psychState ?? [],
    siege: s.scene!.seatAssignments,
    charnier: s.battle!.combatants.some((c) => c.summon),
    festin: auteurId ? !!combattant(auteurId).loseNextAction : null,
  };
}
const toutes = (auteurId: string | null) => ({ horsDeCombat: true, engagement: [], psychologie: [], siege: {}, charnier: true, festin: auteurId ? true : null });

const epee = (qualities: string[] = []): Weapon =>
  ({ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: qualities.map((q) => parseQualityInstance(q)!), uid: `epee-${qualities.join('-')}` } as unknown as Weapon);

beforeEach(() => {
  seedBattleRng(1);
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCascade: null, pendingFateSave: null });
});
afterEach(() => { resetRule('combat-aa-blessures'); });

describe('LDB 85 l.16 — les conséquences de la chute, quel qu’en soit le chemin', () => {
  it('Critique du Piège-lame refusé (LDB 62 l.278-280) : la Blessure critique de la parade', () => {
    const v = victime({ wounds: { current: 0, max: 30 }, conditions: [{ id: 'a-terre', value: 1 }] });
    const d = affame('d', { pos: { x: 2, y: 0 } });
    setBattle([v, temoin(), d]);
    seedBattleRng(37);
    pushChoice(useGame.setState, {
      id: 'cons-bladetrap', kind: 'bladeTrap', actorId: 'd', icon: 'item/weapon', label: fixtureText('Parade — piéger la lame ?'),
      options: [{ key: 'trap', label: fixtureText('Piéger la lame') }, { key: 'crit', label: fixtureText('Coup Critique') }],
      defaultChoice: 'crit', bladeTrap: { defenderId: 'd', attackerId: 'v', weapon: epee(), parryWeaponUid: 'parade', defSL: 2, roll: 44 },
    });
    draineCascade(useGame.getState, 200, cent, () => 'crit');
    expect(consequences('d')).toEqual(toutes('d'));
  });

  it('arme de zone (Tir de zone, AA 10) : la cible secondaire prise dans la gerbe', () => {
    const v = victime({ conditions: [{ id: 'hemorragique', value: 1 }] });
    const a = affame('a', { pos: { x: 0, y: 0 } });
    const primaire = mk('enemy', 'p', { pos: { x: 3, y: 1 } });
    setBattle([v, temoin(), a, primaire]);
    const arme = { label: 'Tromblon', type: 'ranged', range: 60, damage: { flat: 12, plusBF: false }, qualities: [{ id: 'tir-de-zone', value: 3 }] } as unknown as Weapon;
    resolveWeaponArea(useGame.getState, useGame.setState, { attacker: a, primaryTarget: primaire, weapon: arme, damage: 12, location: 'corps', distanceTiles: 10 },
      areaTargets(useGame.getState().battle!.combatants, 2), battleRng());
    ecriture();
    expect(consequences('a')).toEqual(toutes('a'));
  });

  it('manœuvre (Souffle de feu, LDB 85) : les Dégâts de la donnée', () => {
    const v = victime({ conditions: [{ id: 'hemorragique', value: 1 }] });
    const a = affame('a', { pos: { x: 2, y: 0 } });
    setBattle([v, temoin(), a]);
    applyManeuverEffects(useGame.getState, useGame.setState, a, findManeuverById('souffle-feu')!, v, 15, undefined, battleRng());
    ecriture();
    expect(consequences('a')).toEqual(toutes('a'));
  });

  it('sort hors Projectile : les Dégâts de son Flow', () => {
    const v = victime({ conditions: [{ id: 'hemorragique', value: 1 }] });
    const a = affame('a', { pos: { x: 2, y: 0 } });
    setBattle([v, temoin(), a]);
    const sort = {
      id: 'brulure-test', label: 'Brûlure', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: 1, duration: null, desc: '',
      source: { book: 'LDB', page: 0 }, curated: true,
      effects: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'wounds', amount: 10, ignoreTB: true, ignoreAP: true }] } },
    } as never;
    const lancer = { cast: true, roll: 44, target: 60, sl: 4, isCritical: false, isFumble: false, log: '' } as unknown as CastResult;
    applyCast(useGame.getState, useGame.setState, a, v, sort, lancer, false, false);
    draineCascade(useGame.getState, 200, cent);
    expect(consequences('a')).toEqual(toutes('a'));
  });

  it('perte de sang de fin de Round (AA 07 l.5) : sans coup, aucun auteur, même passé l’ancien coup', () => {
    setRule('combat-aa-blessures', 'aa');
    // Chanceux : à 0 PB, hors de la Mort subite d'AA (AA 07 l.65, l.67).
    const v = victime({ wounds: { current: 3, max: 30 }, conditions: [{ id: 'hemorragique', value: 1 }], talents: [{ talentId: 'chanceux', times: 1 }] } as Partial<Combatant>);
    const a = affame('a', { pos: { x: 2, y: 0 } });
    setBattle([v, temoin(), a]);
    const coup: AttackResult = { hit: true, attackerRoll: 30, netSL: 1, location: 'corps', damage: 3, woundsLost: 3, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '' };
    applyAttackResult(useGame.getState, useGame.setState, a, v, epee(), coup);
    draineCascade(useGame.getState, 200, cent);
    expect(isOutOfAction(combattant('v')), 'témoin : le coup de `a` la laisse debout (AA 07 l.5)').toBe(false);
    seedBattleRng(2); // dé de bataille 2 : le Test de Résistance de la perte de sang est raté
    const battle = useGame.getState().battle!;
    runCombatHooks('onRoundEnd', { get: useGame.getState, set: useGame.setState, battle, sink: () => {} });
    ecriture();
    expect(consequences('a')).toEqual({ ...toutes('a'), festin: false });
  });
});

describe('LDB 13 l.183 — l’auteur du Critique de parade, avec ou sans Destin (LDB 17 l.29-32)', () => {
  /** L'attaque de `h` parée d'un double par `d` (Affamé), dont le Critique tue `h` (dé de bataille 37 :
   *  Éventré, LDB 18 l.57). */
  function parade(fate: number): void {
    const h = mk('hero', 'h', { wounds: { current: 1, max: 30 }, fate, pos: { x: 1, y: 0 }, engagedWith: ['d'] });
    const d = affame('d', { pos: { x: 2, y: 0 }, engagedWith: ['h'] });
    setBattle([h, d]);
    seedBattleRng(37);
    const res: AttackResult = {
      hit: false, attackerRoll: 70, netSL: -2, critical: false, advantageTo: 'defender', defenderDefeated: false, log: '',
      attackerDetail: { roll: 70, target: 45, sl: -2, success: false } as never,
      defenderDetail: { roll: 22, target: 45, sl: 2, success: true, mode: 'parade' } as never,
      parryWeapon: epee(),
    };
    applyAttackResult(useGame.getState, useGame.setState, h, d, epee(), res);
    draineCascade(useGame.getState, 200, cent);
    if (fate) {
      expect(useGame.getState().pendingFateSave?.heroId, 'témoin : le Critique de parade ouvre le sauvetage').toBe('h');
      useGame.getState().fateAccept();
      draineCascade(useGame.getState, 200, cent);
    }
  }

  it.each([[0], [1]])('Destin %i : l’auteur de la parade festoie', (fate) => {
    parade(fate);
    expect({ mort: !!combattant('h').dead, festin: !!combattant('d').loseNextAction }).toEqual({ mort: true, festin: true });
  });
});
