/**
 * Porte-bouclier au chemin JOUEUR (AA 13 l.84 ; LDB 13 l.151) : popin de Défense, parade au Bouclier
 * déclarée, « Dégâts » déclarés, Défense gagnée par le jet nu, le dé fixé ou le forçage. #1093.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { itemFromTrappingById, weaponFromItem } from '../engine/items';
import { useGame } from './store';
import type { BattleState } from '../noyau/etat';
import { maybeOpenDefense } from '../noyau/combatFlow';
import { battleRng, seedBattleRng } from '../noyau/battleRng';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, Weapon } from '../engine/types';
import { testScene } from '../scenes/test-fixture';
import { avanceEtapeCascade, poseSurDeNonTombe } from '../noyau/cascade.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const chars = { 'capacite-de-combat': 50, 'capacite-de-tir': 30, force: 45, endurance: 40, initiative: 40, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const SHIELD: Weapon = { ...weaponFromItem(itemFromTrappingById('bouclier')!), name: 'Bouclier', label: 'Bouclier', uid: 'sh1', trappingId: 'bouclier', type: 'melee', damage: { plusBF: true, flat: 2, bare: false }, qualities: [] } as never;
const SWORD: Weapon = { name: 'Épée', label: 'Épée', uid: 'sw1', type: 'melee', damage: { plusBF: true, flat: 4, bare: false }, qualities: [] } as never;
const ARM0 = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
const PB_ORQUE = 20;
const RESERVE = 3;

const G = useGame.getState;
const S = useGame.setState;
const cur = (id: string): Combatant => G().battle!.combatants.find((c) => c.id === id)!;

function ouvreParadeAuBouclier(seed: number): void {
  seedBattleRng(seed);
  const hero = blessuresSurLeProfil({
    id: 'd1', name: 'Héros', label: 'Héros', kind: 'hero', important: true, characteristics: chars, wounds: blessuresDeBase(30),
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [{ talentId: 'porte-bouclier', times: 1 }], traits: [], engagedWith: ['a1'], pos: { x: 5, y: 5 },
    size: 'moyenne', weapons: [SWORD, SHIELD], armour: ARM0, items: [], fate: 0, resilience: 2, criticalWounds: 0, traumas: [],
  }) as unknown as Combatant;
  const orque = blessuresSurLeProfil({
    id: 'a1', name: 'Orque', label: 'Orque', kind: 'enemy', important: true, characteristics: chars, wounds: blessuresDeBase(PB_ORQUE),
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: [], engagedWith: ['d1'], pos: { x: 4, y: 5 },
    size: 'moyenne', weapons: [SWORD], items: [], criticalWounds: 0, traumas: [], armour: ARM0,
  }) as unknown as Combatant;
  const battle = {
    combatants: [hero, orque], order: ['a1', 'd1'], baseOrder: ['a1', 'd1'], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, advantagePools: { allies: RESERVE, foes: 0 },
  } as unknown as BattleState;
  S({
    battle, mode: 'battle', scene: testScene(), party: [hero], pendingDefense: null, pendingAttack: null, pendingCascade: null,
    suspendedCascades: [], pendingLogQueue: [], journal: [], net: { ...G().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  } as never);
  expect(maybeOpenDefense(G, S, cur('a1'), cur('d1'), SWORD, { enchainement: { mode: 'aucun' } } as never)).toBe(true);
  G().defenseSetMode('parade');
  G().defenseSetParryWeapon('sh1');
  G().defenseSetShieldReaction('damage');
}

/** `defenseConfirm` puis cascade vidée ; rend les bornes des tirages `rng.int` faits pendant la frappe. */
function confirme(): string[] {
  const rng = battleRng();
  const int0 = rng.int.bind(rng);
  const tirages: string[] = [];
  rng.int = (a: number, b: number) => { tirages.push(`${a}..${b}`); return int0(a, b); };
  try {
    G().defenseConfirm();
    for (let k = 0; k < 20 && G().pendingCascade; k++) avanceEtapeCascade(G, poseSurDeNonTombe(1), () => 'subir');
  } finally { rng.int = int0; }
  return tirages;
}

/** Frappe du bouclier : BF 4 + Dégâts 2 + DR opposé − BE 4 (PA 0), AA 13 l.84 ; LDB 13 l.151. */
function attendFrappe(): void {
  const res = G().pendingDefense!.result!;
  expect(res.advantageTo).toBe('defender');
  expect(res.parryWeapon?.uid).toBe('sh1');
  const netSL = res.netSL;
  const tirages = confirme();
  expect(tirages.filter((t) => t === '1..100'), 'aucun d100 neuf : la frappe EST le Test opposé').toEqual([]);
  expect(cur('a1').wounds.current).toBe(PB_ORQUE - (4 + 2 + netSL - 4));
  expect(G().battle!.advantagePools!.allies, '+1 de la défense gagnée, −2 de la réaction').toBe(RESERVE + 1 - 2);
  expect(cur('d1').usedShieldReactionRound).toBe(true);
}

describe('Porte-bouclier — chemin joueur, arme de parade déclarée sur tout chemin du jet (#1093)', () => {
  beforeEach(() => { S({ battle: null } as never); setRule('combat-aa-avantage-groupe', true); });
  afterEach(() => resetRule('combat-aa-avantage-groupe'));

  it('jet nu gagné : la frappe du bouclier part', () => {
    ouvreParadeAuBouclier(1);
    G().defenseRoll();
    attendFrappe();
  });

  it('dé fixé (Résilience) gagnant : parade au bouclier conservée, la frappe part', () => {
    ouvreParadeAuBouclier(1);
    G().defenseRoll();
    G().defenseSetForcedRoll(5);
    expect(G().pendingDefense!.def!.roll).toBe(5);
    attendFrappe();
  });

  it('forçage (« Je ne faillirai pas ! ») : parade au bouclier conservée, la frappe part', () => {
    ouvreParadeAuBouclier(5);
    G().defenseRoll();
    expect(G().pendingDefense!.result!.advantageTo).toBe('attacker');
    G().defenseForceSuccess();
    expect(G().pendingDefense!.forced).toBe(true);
    attendFrappe();
  });
});
