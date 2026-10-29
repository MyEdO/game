import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from '../noyau/battleRng';
import { jouerLesTirsDeBordee } from '../noyau/combatFlow';
import { draineCascade } from '../noyau/cascade.testkit';
import { resolveVolley } from '../engine/volley';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, ShipPoste } from '../engine/types';
import { deFixe } from '../engine/dice.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { blessuresDeBase } from '../engine/characteristics';

/**
 * Chaque coup d'une bordée naît sur la cible VIVANTE, après l'application du coup précédent et de ses
 * fenêtres. MDG 14 l.128 ; AA 07 l.25, l.52 ; LDB 18 l.53, l.55.
 */
const chars = (end: number) => ({ 'capacite-de-combat': 30, 'capacite-de-tir': 40, force: 30, endurance: end, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 });
const artilleur = (id: string): Combatant => combattantDeTest({
  id, label: 'Artilleur ' + id, kind: 'hero', characteristics: chars(30), wounds: blessuresDeBase(10), advantage: 0, conditions: [], fortune: 2, resilience: 1,
  skills: [{ id: 'projectiles', spec: 'poudre-noire', characteristic: 'capacite-de-tir', advances: 30 }], talents: [], weapons: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 },
});
const piece = (uid: string, servant: string): ShipPoste => ({
  side: 'tribord', item: { uid, label: 'Canon moyen', kind: 'ranged', subType: 'armes-de-siege', damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'recharge', value: 6 }] }, crewIds: [servant],
}) as unknown as ShipPoste;
const fregate = (): Combatant => combattantDeTest({
  id: 'ship', label: 'Frégate', kind: 'npc', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille', crewIds: ['g1', 'g2'],
  postes: [piece('c1', 'g1'), piece('c2', 'g2')], pos: { x: 5, y: 5 }, wounds: blessuresDeBase(60), conditions: [], weapons: [],
});
/** BE 3, PA 2 partout. */
const pirate = (blessures: number, p: Partial<Combatant> = {}): Combatant => combattantDeTest({
  id: 'target', label: 'Pirate', kind: 'enemy', pos: { x: 9, y: 5 }, wounds: blessuresDeBase(30, blessures), advantage: 0, characteristics: chars(30),
  armour: { tete: 2, brasG: 2, brasD: 2, corps: 2, jambeG: 2, jambeD: 2 }, conditions: [], traits: [], talents: [], skills: [], weapons: [], ...p,
});
const mer = () => ({ id: 's', name: 's', dimensions: { w: 20, h: 20 }, ambiance: 'jour', metresPerTile: 10, layers: [{ z: 0, tiles: new Array(400).fill('eau') }], entities: [], dialogues: [], triggers: [], encounters: [] });
/** Le d100 de chaque pièce : 34, Bras droit, sans double. */
const fixe = deFixe;

/** Bordée de deux pièces sur `cible` au DR 3, drainée ; rend les lignes de touche du journal. */
function bordee(cible: Combatant, graine: number): string[] {
  seedBattleRng(graine);
  const ship = fregate();
  useGame.setState({
    battle: { combatants: [ship, artilleur('g1'), artilleur('g2'), cible], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never,
    party: [artilleur('g1'), artilleur('g2')], facing: { ship: 'N' }, pendingShipBattery: null, pendingCascade: null, suspendedCascades: [], scene: mer() as never,
  });
  const tirs = resolveVolley(ship, ship.postes!, 3, true, [artilleur('g1'), artilleur('g2')], fixe(34));
  jouerLesTirsDeBordee(useGame.getState, useGame.setState, { targetId: 'target', actedAvant: false, tirs: tirs.map((s) => ({ tireurId: s.tireur.id, weapon: s.weapon, jet: s.jet })) });
  draineCascade(useGame.getState);
  return useGame.getState().battle!.log.map((l) => l.text).filter((l) => l.includes(' touche Pirate'));
}

describe('bordée : chaque coup naît sur la cible vivante (MDG 14 l.128)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { resetRule('combat-aa-blessures'); vi.clearAllTimers(); vi.useRealTimers(); });

  for (const graine of [1, 7]) it(`ldb, graine ${graine} : le 2e coup compte la PA ôtée par la Déviation du 1er (LDB 63 l.30)`, () => {
    const [premier, second] = bordee(pirate(5, { important: true }), graine);
    expect(premier).toContain('17 dégâts − 4 (BE+PA) = 13 Blessures');
    expect(second, 'Bras droit : BE 3 + PA 0 après deux Déviations, la 2e recomptée sur la PA vivante').toContain('17 dégâts − 3 (BE+PA) = 14 Blessures');
  });

  for (const graine of [1, 2, 3, 7]) it(`aa, graine ${graine} : le 2e coup frappe une cible à 0 Blessure, sa Localisation est relancée (AA 07 l.25, l.52)`, () => {
    setRule('combat-aa-blessures', 'aa');
    const [premier, second] = bordee(pirate(1, { talents: [{ talentId: 'chanceux', times: 1 }] } as Partial<Combatant>), graine);
    expect(premier).toContain('(Bras droit)');
    expect(second).toMatch(/\(nouvelle Localisation : [^)]+\)/);
  });
});
