import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyTurnInput } from './ai';
import { aiDriven } from './netOwnership';
import { structureCombatant, structureAimCell } from '../engine/structures';
import { applyShipPostes } from './shipPostes';
import { itemFromTrappingById } from '../engine/items';
import { findStructureById } from '../data';
import type { Combatant, ShipPoste, Weapon } from '../engine/types';
import type { Scene } from './scene';
import { losClear } from './lineOfSight';
import type { GameState } from './store';

/**
 * SIÈGE-B — l'IA ennemie prend les STRUCTURES (porte/mur) pour cible avec ses armes de siège (AA 10 l.138 :
 * « grosses cibles statiques »). L'Atout Siège (×2, `woundsFromHit`) rend la valeur élevée → le canon
 * BRÈCHE la porte ; une arme ordinaire ne l'abîme pas (`structureImmune`). SIÈGE-A — un PNJ allié `aiControlled`
 * est piloté par l'IA (`aiDriven`) en jeu manuel, là où un héros du groupe reste manuel.
 */

const CHARS = (CT = 70) => ({ 'capacite-de-combat': 35, 'capacite-de-tir': CT, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 });

const mkActor = (id: string, kind: 'hero' | 'npc' | 'enemy', pos: { x: number; y: number }, weapons: Weapon[] = []): Combatant =>
  ({ id, name: id, kind, characteristics: CHARS(), wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    skills: [], talents: [], weapons, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 0, pos, loaded: true }) as unknown as Combatant;

// Mur d'enceinte sur l'arête N de (14,38) : champ au nord (y<38), cour au sud. Porte de ville (Impénétrable).
const GATE = 'porte-de-ville';
const siegeScene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 30, h: 46 }, ambiance: 'jour', metresPerTile: 2,
    layers: [{ z: 0, tiles: new Array(30 * 46).fill('herbe') }],
    walls: [{ x: 14, y: 38, side: 'N', structure: GATE }],
    entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

const mkGate = (): Combatant => {
  const c = structureCombatant(findStructureById(GATE)!, 'gate');
  c.pos = { x: 14, y: 38 };
  c.structureEdge = { x: 14, y: 38, side: 'N', z: 0 };
  return c;
};

/** Canonnier ENNEMI loin au nord (14,2) servant un canon de siège braqué vers la porte (14,38) — 36 cases
 *  = 72 m, dans la bande Longue de la portée 50 m. Un héros est tapi DERRIÈRE le mur (cour) → hors LdV. */
const mkGunner = (): Combatant => {
  const g = mkActor('gunner', 'enemy', { x: 14, y: 2 });
  g.postes = [{ item: itemFromTrappingById('canon-petit')!, crewIds: ['gunner'] } as ShipPoste];
  applyShipPostes([g]); // sert le canon au chef → g.weapons porte la pièce dérivée (ranged, Atout Siège)
  return g;
};

const input = (enemy: Combatant, structures: Combatant[]): EnemyTurnInput =>
  ({ enemy, heroes: [mkActor('hero', 'hero', { x: 14, y: 42 })], scene: siegeScene(),
    blocked: new Set(), movement: 0, spells: [], structures });

describe('SIÈGE-B — armes de siège ciblent les structures', () => {
  it('canon de siège ennemi → BRÈCHE la porte (le héros derrière le mur est hors LdV)', () => {
    const gunner = mkGunner();
    expect(gunner.weapons.some((w) => w.type === 'ranged')).toBe(true); // sanity : la pièce est servie
    const action = chooseEnemyAction(input(gunner, [mkGate()]));
    expect(action).toEqual({ kind: 'shoot', targetId: 'gate' });
  });

  it('on vise la FACE exposée de la porte (case côté champ), pas la case derrière le mur', () => {
    expect(structureAimCell({ x: 14, y: 2 }, mkGate())).toEqual({ x: 14, y: 37 }); // face nord (côté tireur)
    expect(structureAimCell({ x: 14, y: 44 }, mkGate())).toEqual({ x: 14, y: 38 }); // face sud (côté cour)
  });

  it('arme ORDINAIRE (arc, sans Atout Siège) → ne cible PAS la porte Impénétrable', () => {
    const archer = mkActor('archer', 'enemy', { x: 14, y: 2 },
      [{ uid: 'arc', name: 'Arc', type: 'ranged', damage: { literal: '+7' }, range: 60, qualities: [] } as unknown as Weapon]);
    const action = chooseEnemyAction(input(archer, [mkGate()]));
    expect(action.kind).not.toBe('shoot'); // Impénétrable + non-Siège → aucune attaque jouable (immobile → end)
  });

  it('aucune structure dans l\'entrée (fixture standard) → comportement inchangé (pas de candidat structure)', () => {
    const gunner = mkGunner();
    const action = chooseEnemyAction({ ...input(gunner, []), structures: undefined });
    expect(action.kind).not.toBe('shoot'); // le seul héros est hors LdV (derrière le mur) → pas de tir
  });
});

/**
 * #1883 — l'IA et la résolution du tir (`resolveAttack`, `losTo`) jugent la MÊME case : la face de la
 * structure à l'étage de SON arête. Porte à z=1 au-dessus d'un mur plein à z=0 qui coupe la vue au sol :
 * la face d'étage se voit (tir inter-étages), la case de sol à ses pieds non.
 */
describe('SIÈGE-B — structure d’étage : l’IA vise la case que la résolution juge', () => {
  const sceneEtage = (): Scene => {
    const s = siegeScene();
    const n = s.dimensions.w * s.dimensions.h;
    s.layers = [...s.layers, { z: 1, tiles: new Array(n).fill('herbe'), height: new Array(n).fill(3) }];
    s.walls = [{ x: 14, y: 38, side: 'N', z: 1, structure: GATE }, { x: 14, y: 20, side: 'N' }];
    return s;
  };
  const gateZ1 = (): Combatant => {
    const c = mkGate();
    c.pos = { x: 14, y: 38, z: 1 };
    c.structureEdge = { x: 14, y: 38, side: 'N', z: 1 };
    return c;
  };

  it('la résolution voit la face d’étage ; l’IA tire donc la porte', () => {
    const gunner = mkGunner();
    const scene = sceneEtage();
    const cible = structureAimCell(gunner.pos!, gateZ1());
    expect(cible).toEqual({ x: 14, y: 37, z: 1 });
    expect(losClear(scene, gunner.pos!, cible), 'la résolution voit la face d’étage').toBe(true);
    expect(losClear(scene, gunner.pos!, { x: 14, y: 37 }), 'la case de sol est masquée — sinon le contrat ne distingue rien').toBe(false);
    expect(chooseEnemyAction({ ...input(gunner, [gateZ1()]), scene })).toEqual({ kind: 'shoot', targetId: 'gate' });
  });
});

describe('SIÈGE-A — drapeau allié-IA (aiControlled) piloté par aiDriven', () => {
  const localState = { net: { mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] } } as unknown as GameState;
  const c = (over: Partial<Combatant>): Combatant => ({ id: 'a', kind: 'hero', ...over }) as Combatant;

  it('un PNJ allié `aiControlled` est piloté par l\'IA même en jeu manuel', () => {
    expect(aiDriven(localState, c({ kind: 'hero', aiControlled: true }))).toBe(true);
  });
  it('un héros du groupe (sans le drapeau) reste MANUEL hors Auto-combat', () => {
    expect(aiDriven(localState, c({ kind: 'hero' }))).toBe(false);
  });
  it('un ennemi est toujours piloté par l\'IA (inchangé)', () => {
    expect(aiDriven(localState, c({ kind: 'enemy' }))).toBe(true);
  });
});
