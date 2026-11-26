import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyTurnInput } from './ai';
import { aiDriven } from '../netOwnership';
import { structureCombatant, structureAimCell } from '../../engine/structures';
import { applyShipPostes } from './shipPostes';
import { hydratePoste, unloadWeapon } from '../../engine/items';
import { findStructureById } from '../../data';
import type { Combatant, Weapon } from '../../engine/types';
import type { Scene } from './scene';
import type { Jeu } from '../etat';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';

/**
 * SIÈGE-B — l'IA ennemie prend les STRUCTURES (porte/mur) pour cible avec ses armes de siège (AA 10 l.138 :
 * « grosses cibles statiques »). L'Atout Siège (×2, `woundsFromHit`) rend la valeur élevée → le canon
 * BRÈCHE la porte ; une arme ordinaire ne l'abîme pas (`structureImmune`). SIÈGE-A — un PNJ allié `aiControlled`
 * est piloté par l'IA (`aiDriven`) en jeu manuel, là où un héros du groupe reste manuel.
 */

const CHARS = (CT = 70) => ({ 'capacite-de-combat': 35, 'capacite-de-tir': CT, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 });

const mkActor = (id: string, kind: 'heros' | 'pnj' | 'ennemi', pos: { x: number; y: number }, weapons: Weapon[] = []): Combatant =>
  (blessuresSurLeProfil({ id, name: id, kind, characteristics: CHARS(), wounds: blessuresDeBase(12), advantage: 0, conditions: [],
    skills: [], talents: [], weapons, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 0, pos, loaded: true })) as unknown as Combatant;

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
  const g = mkActor('gunner', 'ennemi', { x: 14, y: 2 });
  g.postes = [hydratePoste({ engin: { id: 'canon-petit' }, crewIds: ['gunner'] }, idsDeTest('it'))];
  applyShipPostes([g]); // sert le canon au chef → g.weapons porte la pièce dérivée (ranged, Atout Siège)
  return g;
};

const input = (enemy: Combatant, structures: Combatant[]): EnemyTurnInput =>
  ({ enemy, heroes: [mkActor('hero', 'heros', { x: 14, y: 42 })], scene: siegeScene(),
    env: { blocked: new Set() }, movement: 0, spells: [], structures });

describe('SIÈGE-B — armes de siège ciblent les structures', () => {
  it('canon de siège ennemi → BRÈCHE la porte (le héros derrière le mur est hors LdV)', () => {
    const gunner = mkGunner();
    expect(gunner.weapons.find((w) => w.uid === gunner.mannedPoste?.item.uid)?.type).toBe('distance'); // la pièce est servie
    const piece = gunner.weapons.find((w) => w.uid === gunner.mannedPoste?.item.uid)!;
    const action = chooseEnemyAction(input(gunner, [mkGate()]));
    expect(action).toStrictEqual({ kind: 'tir', targetId: 'gate', weaponUid: piece.uid });
  });

  it('on vise la FACE exposée de la porte (case côté champ), pas la case derrière le mur', () => {
    expect(structureAimCell({ x: 14, y: 2 }, mkGate())).toEqual({ x: 14, y: 37 }); // face nord (côté tireur)
    expect(structureAimCell({ x: 14, y: 44 }, mkGate())).toEqual({ x: 14, y: 38 }); // face sud (côté cour)
  });

  it('arme ORDINAIRE (arc, sans Atout Siège) → ne cible PAS la porte Impénétrable', () => {
    const archer = mkActor('archer', 'ennemi', { x: 14, y: 2 },
      [{ uid: 'arc', name: 'Arc', type: 'distance', damage: { literal: '+7' }, range: 60, qualities: [] } as unknown as Weapon]);
    const action = chooseEnemyAction(input(archer, [mkGate()]));
    expect(action.kind).not.toBe('tir'); // Impénétrable + non-Siège → aucune attaque jouable (immobile → end)
  });

  it('aucune structure dans l\'entrée (fixture standard) → comportement inchangé (pas de candidat structure)', () => {
    const gunner = mkGunner();
    const action = chooseEnemyAction({ ...input(gunner, []), structures: undefined });
    expect(action.kind).not.toBe('tir'); // le seul héros est hors LdV (derrière le mur) → pas de tir
  });

  // LDB 62 l.333, AA 10 l.138 — #4187.
  const unloadedGunner = (): Combatant => {
    const g = mkGunner();
    const piece = g.weapons.find((w) => w.uid === g.mannedPoste?.item.uid)!;
    unloadWeapon(g, piece, g.mannedPoste);
    return g;
  };

  it('pièce DÉCHARGÉE, seule la porte en vue et en portée, aucun héros perçu → RECHARGE', () => {
    const action = chooseEnemyAction({ ...input(unloadedGunner(), [mkGate()]), perceived: new Set() });
    expect(action).toStrictEqual({ kind: 'rechargement' });
  });

  it('pièce DÉCHARGÉE, aucune structure fournie, aucun héros perçu → pas de recharge', () => {
    const action = chooseEnemyAction({ ...input(unloadedGunner(), []), perceived: new Set() });
    expect(action.kind).not.toBe('rechargement');
  });

  // LDB 14 l.41 — #4187.
  it('servant ENGAGÉ, sans arme de mêlée, pièce chargée, porte en vue et en portée → ne tire pas', () => {
    const gunner = mkGunner();
    gunner.engagedWith = ['hero'];
    const action = chooseEnemyAction({ ...input(gunner, [mkGate()]), perceived: new Set() });
    expect(action.kind).not.toBe('tir');
  });

  // LDB 21 l.33 — #4187.
  it('servant FRÉNÉTIQUE, seule la porte en vue, adversaire non perçu atteignable → s\'approche', () => {
    const gunner = mkGunner();
    gunner.psychState = [{ type: 'frenesie' }];
    const action = chooseEnemyAction({ ...input(gunner, [mkGate()]), movement: 4, perceived: new Set() });
    expect(action).toMatchObject({ kind: 'deplacement', thenTargetId: 'hero' });
  });
});

describe('SIÈGE-A — drapeau allié-IA (aiControlled) piloté par aiDriven', () => {
  const localState = { net: { mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] } } as unknown as Jeu;
  const c = (over: Partial<Combatant>): Combatant => ({ id: 'a', kind: 'heros', ...over }) as Combatant;

  it('un PNJ allié `aiControlled` est piloté par l\'IA même en jeu manuel', () => {
    expect(aiDriven(localState, c({ kind: 'heros', aiControlled: true }))).toBe(true);
  });
  it('un héros du groupe (sans le drapeau) reste MANUEL hors Auto-combat', () => {
    expect(aiDriven(localState, c({ kind: 'heros' }))).toBe(false);
  });
  it('un ennemi est toujours piloté par l\'IA (inchangé)', () => {
    expect(aiDriven(localState, c({ kind: 'ennemi' }))).toBe(true);
  });
});
