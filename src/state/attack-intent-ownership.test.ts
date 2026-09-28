/**
 * #1013 — possession des verbes d'INFLUENCE d'attaque/défense : elle suit le PORTEUR DU JET
 * (`FLOW_VERBS.attack/defense.jetOwner`), jamais le owner de la FENÊTRE ACTIVE.
 *
 * Défaut mesuré avant la correction, sur le flux RÉEL (attaque pilotée par le siège MJ, défense
 * SURFACÉE du héros du siège 1, #989) : pendant l'étape `jet:'defense'` le owner de modale est le
 * DÉFENSEUR, donc `attack*` retombait sur LUI — possession exactement inversée (le défenseur
 * dépensait la Chance/la Résilience/le Pacte de l'ATTAQUANT). Miroir mesuré pendant l'étape
 * `jet:'attack'` : les verbes `defense*` étaient acceptés du siège de l'ATTAQUANT.
 *
 * Les intents HORS verbes de flux (`attackRoll`/`attackConfirm`/`defenseConfirm`,
 * `MANUAL_COMBAT_INTENTS`) ne passent pas par cette route : la fenêtre de Défense interposée (#989 :
 * `defenseConfirm` ré-entre dans `attackConfirm`) est inchangée — vérifié ci-dessous.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { openAttackCascade, maybeOpenDefense } from './combatFlow';
import { intentAllowedFor, modalOwnerOf } from './netOwnership';
import { jetOwnedIntents } from './flowVerbs';
import { COMBAT_INTENTS, MANUAL_COMBAT_INTENTS } from '../net/intents';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';

const NET0 = useGame.getState().net;
const MODE0 = useGame.getState().mode;
const SCENE0 = useGame.getState().scene;
afterEach(() => {
  useGame.setState({
    net: NET0, mode: MODE0, scene: SCENE0,
    battle: null, pendingAttack: null, pendingDefense: null, pendingCascade: null,
  });
});

// Fixture mk()/setup() de `defense-surfacage.test.ts` (#989) — même arène, mêmes sièges.
const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, weapons: Weapon[]): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons, advantage: 0, size: 'moyenne', pos, wounds: { current: 18, max: 18 },
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 } as unknown as Combatant);
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;

/** Siège 0 = hôte spectateur, siège 1 = joueur du héros `h`, siège 2 = MJ (conduit l'ennemi `e`). */
function setup(net: Record<string, unknown> = {}) {
  seedBattleRng(7);
  const enemy = mk('e', 'enemy', { x: 1, y: 0 }, [sword]);
  const hero = mk('h', 'hero', { x: 0, y: 0 }, [sword]);
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null,
    net: { ...NET0, mode: 'host', mySeat: 0, gmSeat: 2, ownership: { h: 1 }, slots: [0, 1, 0, 0], seatNames: { 0: 'Hôte', 1: 'Joueur', 2: 'MJ' }, ...net },
  });
  return { enemy, hero };
}

const g = useGame.getState;
const ATTACK_VERBS = ['attackReroll', 'attackBonusSL', 'attackDarkPact', 'attackForceSuccess', 'attackSetForcedRoll', 'attackReverse'];
const DEFENSE_VERBS = ['defenseReroll', 'defenseBonusSL', 'defenseDarkPact', 'defenseForceSuccess', 'defenseSetForcedRoll', 'defenseReverse'];
const argsOf = (intent: string) => (intent.endsWith('SetForcedRoll') ? [42] : []);
/** Verdict des 3 sièges pour un intent : [hôte, joueur du héros, MJ]. */
const seats = (intent: string) => [0, 1, 2].map((seat) => intentAllowedFor(g(), seat, intent, argsOf(intent)));

/** Attaque PILOTÉE par le siège MJ jusqu'à l'interposition de la défense SURFACÉE du héros (#989). */
function playToDefenseWindow() {
  const { enemy, hero } = setup();
  openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
  g().attackRoll();
  g().attackConfirm();
  return { enemy, hero };
}

describe('#1013 — la table DÉRIVE les intents d’attaque/défense', () => {
  it('les verbes d’influence des deux flux sont routés par porteur (sinon les gardes ne mesurent rien)', () => {
    const map = jetOwnedIntents();
    expect(map.attackForceSuccess).toEqual({ pending: 'pendingAttack', field: 'attackerId' });
    expect(map.defenseForceSuccess).toEqual({ pending: 'pendingDefense', field: 'defenderId' });
    for (const i of [...ATTACK_VERBS, ...DEFENSE_VERBS]) {
      expect(map[i], `${i} routé par porteur`).toBeTruthy();
      expect(COMBAT_INTENTS.has(i), `${i} exposé comme intent invité`).toBe(true);
    }
    // `attackCancel` (verbe `cancel`) ferme la situation : il ne dépense rien, mais il est routé par
    // le porteur comme les autres (#1017) — sur une fenêtre PARTAGÉE (`'*'`), le repli `modalOwnerOf`
    // laissait n'importe quel siège fermer le jet d'autrui.
    expect(map.attackCancel).toEqual({ pending: 'pendingAttack', field: 'attackerId' });
  });
});

describe('#1013 — fenêtre de DÉFENSE ouverte : les verbes `attack*` n’appartiennent PLUS au défenseur', () => {
  it('sonde A — défense SURFACÉE interposée (attaque du siège MJ sur le héros du siège 1)', () => {
    const { hero } = playToDefenseWindow();
    expect(g().pendingDefense, 'précondition : la fenêtre de défense s’est interposée').toBeTruthy();
    expect(modalOwnerOf(g()), 'le owner de la fenêtre est le DÉFENSEUR').toBe(hero.id);
    expect(g().pendingAttack, 'le jet d’attaque est CLOS pendant la fenêtre du défenseur').toBeNull();
    for (const i of ATTACK_VERBS) {
      expect(seats(i), `${i} : aucun siège ne dépense les ressources de l’attaquant par la fenêtre du défenseur`).toEqual([false, false, false]);
    }
  });

  it('sonde A bis — défense RÉACTIVE (`maybeOpenDefense`) : même verdict', () => {
    const { enemy, hero } = setup();
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    expect(modalOwnerOf(g())).toBe(hero.id);
    for (const i of ATTACK_VERBS) expect(seats(i), i).toEqual([false, false, false]);
  });

  it('sonde A ter — défense de l’ENNEMI (attaque du héros du siège 1) : l’attaquant ne récupère rien non plus', () => {
    const { enemy, hero } = setup();
    useGame.setState({ battle: { ...g().battle!, turn: 1 } });
    openAttackCascade(g, useGame.setState, { attackerId: hero.id, targetId: enemy.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    g().attackConfirm();
    expect(g().pendingDefense!.defenderId).toBe(enemy.id);
    for (const i of ATTACK_VERBS) expect(seats(i), i).toEqual([false, false, false]);
  });
});

describe('#1013 — symétrique : fenêtre d’ATTAQUE ouverte, les verbes `defense*` n’appartiennent PLUS à l’attaquant', () => {
  it('aucune défense n’est en jeu : les trois sièges sont refusés', () => {
    const { enemy, hero } = setup();
    openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    expect(modalOwnerOf(g()), 'le owner de la fenêtre est l’ATTAQUANT').toBe(enemy.id);
    expect(g().pendingDefense).toBeNull();
    for (const i of DEFENSE_VERBS) expect(seats(i), `${i} : le siège de l’attaquant ne tient pas les verbes de défense`).toEqual([false, false, false]);
  });
});

describe('#1013 — quadrants du POSSESSEUR LÉGITIME (la correction ne ferme rien de dû)', () => {
  it('fenêtre d’attaque : seul le siège du porteur (MJ, qui conduit l’ennemi) dépense', () => {
    const { enemy, hero } = setup();
    openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    for (const i of ATTACK_VERBS) expect(seats(i), i).toEqual([false, false, true]);
  });

  it('fenêtre d’attaque d’un HÉROS : son siège dépense, l’hôte et le MJ non', () => {
    const { enemy, hero } = setup();
    useGame.setState({ battle: { ...g().battle!, turn: 1 } });
    openAttackCascade(g, useGame.setState, { attackerId: hero.id, targetId: enemy.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    for (const i of ATTACK_VERBS) expect(seats(i), i).toEqual([false, true, false]);
  });

  it('fenêtre de défense : seul le siège du DÉFENSEUR dépense (héros du siège 1)', () => {
    playToDefenseWindow();
    for (const i of DEFENSE_VERBS) expect(seats(i), i).toEqual([false, true, false]);
  });

  it('fenêtre de défense de l’ENNEMI : seul le siège MJ dépense', () => {
    const { enemy, hero } = setup();
    useGame.setState({ battle: { ...g().battle!, turn: 1 } });
    openAttackCascade(g, useGame.setState, { attackerId: hero.id, targetId: enemy.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    g().attackConfirm();
    for (const i of DEFENSE_VERBS) expect(seats(i), i).toEqual([false, false, true]);
  });

  it('SOLO : l’attaquant du joueur garde ses dépenses, la défense aussi', () => {
    const { enemy, hero } = setup({ mode: 'local', mySeat: 0, gmSeat: 0, ownership: {}, slots: [0, 0, 0, 0] });
    useGame.setState({ battle: { ...g().battle!, turn: 1 } });
    openAttackCascade(g, useGame.setState, { attackerId: hero.id, targetId: enemy.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    for (const i of ATTACK_VERBS) expect(intentAllowedFor(g(), 0, i, argsOf(i)), i).toBe(true);
    g().attackConfirm();
    expect(g().pendingDefense, 'l’ennemi conduit par le MJ local défend').toBeTruthy();
    for (const i of DEFENSE_VERBS) expect(intentAllowedFor(g(), 0, i, argsOf(i)), i).toBe(true);
  });
});

describe('#1013 — NON-RÉGRESSION : le jet, l’application et la reprise d’attaque ne sont pas gatés par le porteur', () => {
  it('`attackRoll`/`attackConfirm`/`defenseConfirm` restent des intents MANUELS (hors verbes de flux)', () => {
    const map = jetOwnedIntents();
    for (const i of ['attackRoll', 'attackConfirm', 'defenseConfirm']) {
      expect(MANUAL_COMBAT_INTENTS).toContain(i);
      expect(map[i], `${i} n’est pas routé par porteur`).toBeUndefined();
    }
  });

  it('la fenêtre interposée se joue de bout en bout : le défenseur roule, applique, et le tour n’avance pas', () => {
    const { hero } = playToDefenseWindow();
    const turnBefore = g().battle!.turn;
    expect(intentAllowedFor(g(), 1, 'defenseRoll'), 'le siège du défenseur roule SA défense').toBe(true);
    expect(intentAllowedFor(g(), 2, 'defenseRoll'), 'le MJ ne roule pas la défense du héros').toBe(false);
    expect(intentAllowedFor(g(), 1, 'defenseConfirm'), 'l’Appliquer reste au owner de la fenêtre').toBe(true);
    g().defenseRoll();
    g().defenseConfirm();
    expect(g().pendingDefense, 'la fenêtre est refermée').toBeNull();
    expect(g().battle!.turn, 'la reprise `attackConfirm` n’a pas fait avancer le tour').toBe(turnBefore);
    expect(g().battle!.combatants.some((c) => c.id === hero.id)).toBe(true);
  });
});
