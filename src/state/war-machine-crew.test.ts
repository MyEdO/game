import { describe, it, expect } from 'vitest';
import { applyShipPostes } from '../noyau/monde/shipPostes';
import { firedWeapon, firedAttackBlock } from '../noyau/combatFlow';
import { itemFromTrappingById } from '../engine/items';
import type { Combatant, ShipPoste } from '../engine/types';
import type { Scene } from '../noyau/monde/scene';
import type { GameState } from './store';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/**
 * ÉQUIPE des machines de guerre ADE II 8 l.233, câblée au point de tir (`firedWeapon`) et au gate
 * d'affordance (`firedAttackBlock`) — 3ᵉ courbe de sous-effectif, DISTINCTE de celle d'AA (`(C)` de
 * `siege-emplacement.test.ts` : recharge ×2 + Défaut ajouté). Ici : −20 plat si incomplète, INUTILISABLE
 * si < moitié — AUCUNE recharge doublée, AUCUN Défaut ajouté (vérifié explicitement ci-dessous).
 */
const CHARS = (F = 30) => ({ 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: F, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 });

const mkGunner = (id: string, kind: 'hero' | 'npc', pos: { x: number; y: number }): Combatant =>
  ({ id, name: id, kind, characteristics: CHARS(), wounds: { current: 12, max: 12 }, advantage: 0,
    conditions: [], skills: [], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos, loaded: true,
  }) as unknown as Combatant;

const mkCrewman = (id: string, alive = true): Combatant =>
  ({ id, name: id, kind: 'npc', conditions: [], weapons: [], skills: [], talents: [], characteristics: CHARS(30) as never,
    dead: !alive, wounds: { current: alive ? 5 : 0, max: 5 } }) as unknown as Combatant;

const mkEnemy = (id: string, x: number, y: number): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x, y }, conditions: [], weapons: [], skills: [], talents: [],
    characteristics: { ...CHARS(0), endurance: 30 }, wounds: { current: 30, max: 30 }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant;

const mkEmplacement = (poste: ShipPoste, pos = { x: 5, y: 7 }): Combatant =>
  ({ id: 'emplacement', name: 'Affût', kind: 'enemy', pos, conditions: [], weapons: [],
    inert: true, wounds: { current: 0, max: 0 }, advantage: 0, postes: [poste] }) as unknown as Combatant;

const mkPoste = (engineId: string, crewIds: string[]): ShipPoste =>
  ({ item: itemFromTrappingById(engineId, idNeufDeBanc)!, crewIds });

const groundScene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 20, h: 20 }, ambiance: 'jour', metresPerTile: 2,
    layers: [{ z: 0, tiles: new Array(20 * 20).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

const mkGet = (sc: Scene, combatants: Combatant[]): (() => GameState) =>
  (() => ({ scene: sc, battle: { combatants, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {} })) as unknown as () => GameState;

describe('firedWeapon — bélier ADE II (Équipe 6) : −20 plat en sous-effectif, RIEN d’autre touché', () => {
  it('Équipe au complet (6/6) : arme nette (Équipe non marquée incomplète, Qualités/Recharge intactes)', () => {
    const crewIds = ['chef', 'c1', 'c2', 'c3', 'c4', 'c5'];
    const poste = mkPoste('belier-ade2', crewIds);
    const chef = mkGunner('chef', 'hero', { x: 5, y: 5 });
    const all = [mkEmplacement(poste), chef, ...crewIds.slice(1).map((id) => mkCrewman(id)), mkEnemy('cible', 6, 5)];
    applyShipPostes(all);
    const w = firedWeapon(chef, mkEnemy('cible', 6, 5), poste.item.uid, all);
    expect(w.crewTeamIncomplete).toBeUndefined();
    expect(w.resolveChar).toBe('force'); // Force, pas CC
    expect(w.reload).toBe(0); // ADE II n'a AUCUNE Recharge (≠ AA) — rien à doubler
  });

  it('Équipe incomplète (3/6, ≥ moitié) : −20 baké, mais toujours UTILISABLE', () => {
    const crewIds = ['chef', 'c1', 'c2']; // 3 présents / 6 requis
    const poste = mkPoste('belier-ade2', crewIds);
    const chef = mkGunner('chef', 'hero', { x: 5, y: 5 });
    const all = [mkEmplacement(poste), chef, ...crewIds.slice(1).map((id) => mkCrewman(id)), mkEnemy('cible', 6, 5)];
    applyShipPostes(all);
    const w = firedWeapon(chef, mkEnemy('cible', 6, 5), poste.item.uid, all);
    expect(w.crewTeamIncomplete).toBe(true);
    expect(firedAttackBlock(mkGet(groundScene(), all), chef, mkEnemy('cible', 6, 5), poste.item.uid)).toBeNull();
  });

  it('sous la moitié (2/6) : INUTILISABLE — firedAttackBlock refuse l’attaque (mêlée ET distance)', () => {
    const crewIds = ['chef', 'c1']; // 2 présents / 6 requis (< 3 = moitié)
    const poste = mkPoste('belier-ade2', crewIds);
    const chef = mkGunner('chef', 'hero', { x: 5, y: 5 });
    const all = [mkEmplacement(poste), chef, mkCrewman('c1'), mkEnemy('cible', 6, 5)];
    applyShipPostes(all);
    const block = firedAttackBlock(mkGet(groundScene(), all), chef, mkEnemy('cible', 6, 5), poste.item.uid);
    expect(block).toMatchObject({ reason: 'sous-effectif' });
  });

  it('sous-effectif d’une machine ADE II à DISTANCE (baliste-ade2, Équipe 4) : même −20, sans passer par arme-d-equipe', () => {
    const crewIds = ['chef', 'c1']; // 2 présents / 4 requis
    const poste = mkPoste('baliste-ade2', crewIds);
    const chef = mkGunner('chef', 'hero', { x: 5, y: 5 });
    const all = [mkEmplacement(poste), chef, mkCrewman('c1'), mkEnemy('cible', 12, 5)];
    applyShipPostes(all);
    const w = firedWeapon(chef, mkEnemy('cible', 12, 5), poste.item.uid, all);
    expect(w.crewTeamIncomplete).toBe(true);
    expect(w.qualities.some((q) => q.id === 'arme-d-equipe')).toBe(false); // ADE II ne porte PAS cette Qualité AA
  });
});
