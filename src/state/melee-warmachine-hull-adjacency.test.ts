import { describe, it, expect } from 'vitest';
import { attackPlan, firedWeapon } from '../noyau/combatFlow';
import { combatGeomOf, combatGeomOfList, pickAttackWeaponList } from '../noyau/mount';
import { meleeWarMachineHullOf, isMeleeWarMachine } from '../noyau/siegePush';
import type { Combatant, ShipPoste } from '../engine/types';
import type { GameState } from './store';
import type { Scene } from '../noyau/monde/scene';

/**
 * #210 Lot 2 — l'attaque d'une pièce de MÊLÉE servie (bélier, ADE II 8 l.233) est ancrée à la
 * COQUE/l'affût, pas au chef qui la sert : `meleeWarMachineHullOf`/`combatGeomOf` (mount.ts, siegePush.ts)
 * remplacent l'adjacence du CHEF par celle de la PIÈCE dans `attackPlan`/`firedAttackBlock`/`firedWeapon`.
 * Les pièces à DISTANCE (baliste/canon) gardent la géométrie du chef — inchangé.
 */
const ramWeapon = { uid: 'ram-w', trappingId: 'belier-test', name: 'Bélier', kind: 'melee' as const, damage: { plusBF: true, flat: 10 }, qualities: [{ id: 'equipe', value: 6 }], weaponGroup: 'machine-de-guerre' };
const cannonWeapon = { uid: 'cannon-w', trappingId: 'canon-test', name: 'Canon', kind: 'ranged' as const, damage: { plusBF: false, flat: 14 }, range: 75, qualities: [{ id: 'equipe', value: 6 }], weaponGroup: 'poudre-noire' };

const ramPoste: ShipPoste = { item: ramWeapon as never, crewIds: ['chef'] };
const cannonPoste: ShipPoste = { item: cannonWeapon as never, crewIds: ['chef'] };

const combatant = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'chef', name: 'Chef', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 50, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [{ name: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 10 }, reach: 'Moyenne', qualities: [{ id: 'equipe', value: 6 }], weaponGroup: 'machine-de-guerre', uid: 'ram-w' }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide',
    ...over,
  }) as unknown as Combatant;

const hull = (pos: { x: number; y: number }, poste: ShipPoste, footprint?: number): Combatant =>
  ({ id: 'hull', name: 'Affût', kind: 'ally', pos, conditions: [], wounds: { current: 20, max: 20 }, dead: false, postes: [poste], footprint, bodyShape: 'engin', inert: true }) as unknown as Combatant;

const door = (pos: { x: number; y: number }): Combatant =>
  ({ id: 'door', name: 'Porte', kind: 'enemy', pos, conditions: [], wounds: { current: 20, max: 20 }, dead: false, bodyShape: 'structure', inert: true }) as unknown as Combatant;

const scene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 10, h: 10 }, ambiance: 'jour', layers: [{ z: 0, tiles: new Array(100).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

const NET_LOCAL = { mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] };
const mkGet = (combatants: Combatant[]): (() => GameState) =>
  (() => ({ scene: scene(), battle: { combatants, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {}, net: NET_LOCAL })) as unknown as () => GameState;

describe('#210 — adjacence d\'une pièce de MÊLÉE servie = celle de la COQUE, jamais celle du chef', () => {
  it('(a) coque ADJACENTE à la porte, chef PAS adjacent (loin) : attaque DISPONIBLE', () => {
    const gate = door({ x: 5, y: 0 });
    const ram = hull({ x: 4, y: 0 }, ramPoste); // adjacente à la porte (distance 1)
    const chef = combatant({ pos: { x: 0, y: 0 }, mannedPoste: ramPoste } as never); // très loin de la porte
    const plan = attackPlan(mkGet([chef, ram, gate]), chef, gate);
    expect(plan.kind).toBe('attack');
  });

  it('(b) chef ADJACENT à la porte mais coque À DISTANCE : attaque INDISPONIBLE (le bug corrigé)', () => {
    const gate = door({ x: 5, y: 0 });
    const chef = combatant({ pos: { x: 4, y: 0 }, mannedPoste: ramPoste } as never); // adjacent à la porte
    const ram = hull({ x: 0, y: 0 }, ramPoste); // très loin de la porte
    const plan = attackPlan(mkGet([chef, ram, gate]), chef, gate);
    expect(plan.kind).toBe('blocked'); // une structure ne se charge/rejoint jamais implicitement (isInanimate)
  });

  it('(c) empreinte >1 : une coque 2×2 dont UNE case touche la porte reste adjacente', () => {
    const gate = door({ x: 5, y: 0 });
    const ram = hull({ x: 3, y: 0 }, ramPoste, 2); // occupe (3,0)-(4,1) : la tuile (4,0) touche la porte (5,0)
    const chef = combatant({ pos: { x: 0, y: 0 }, mannedPoste: ramPoste } as never);
    const plan = attackPlan(mkGet([chef, ram, gate]), chef, gate);
    expect(plan.kind).toBe('attack');
  });

  it('(d) non-régression PIÈCE À DISTANCE (canon/baliste) : géométrie du CHEF inchangée', () => {
    const chef = combatant({ id: 'chef', pos: { x: 4, y: 0 }, mannedPoste: cannonPoste } as never);
    const far = hull({ x: 0, y: 0 }, cannonPoste); // coque du canon très loin — ne doit RIEN changer
    expect(isMeleeWarMachine({ type: 'ranged', qualities: cannonWeapon.qualities })).toBe(false);
    expect(meleeWarMachineHullOf(chef, [chef, far])).toBeUndefined();
    expect(combatGeomOf({ combatants: [chef, far] } as never, chef)).toBe(chef);
    expect(combatGeomOfList([chef, far], chef)).toBe(chef);
  });

  it('meleeWarMachineHullOf : `undefined` si aucun poste servi, ou si la pièce n\'est pas de mêlée', () => {
    const noPoste = combatant({ id: 'chef' });
    expect(meleeWarMachineHullOf(noPoste, [noPoste])).toBeUndefined();
    const ram = hull({ x: 1, y: 0 }, ramPoste);
    const chef = combatant({ id: 'chef', mannedPoste: ramPoste } as never);
    expect(meleeWarMachineHullOf(chef, [chef, ram])).toBe(ram);
  });
});

/**
 * Addendum (retour utilisateur, suite #210/BUG-A) — « un intent, une entrée » : l'option d'attaque
 * GÉNÉRIQUE ('arme') et l'option DÉDIÉE « Servir <pièce> » (`weaponUid` épinglé) ne doivent JAMAIS
 * matcher la MÊME cible — `pickAttackWeaponList` (auto-choix, SANS `weaponUid`) exclut toujours l'arme
 * du poste servi, qu'elle soit de mêlée (bélier) OU à distance (canon/pierrier) : la pièce reste
 * accessible UNIQUEMENT par choix explicite (`weaponUid`, posé par l'option 'poste' / l'IA).
 */
describe('pickAttackWeaponList — auto-choix EXCLUT toujours l\'arme du poste servi ("un intent, une entrée")', () => {
  const sword = { name: 'Épée', type: 'melee' as const, damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [], uid: 'sword-w' };
  const dagger = { name: 'Dague', type: 'melee' as const, damage: { plusBF: true, flat: 1 }, qualities: [], uid: 'dagger-w' };

  it('bélier (mêlée servie) : coque adjacente + chef loin → auto-choix (sans weaponUid) ne prend JAMAIS le Bélier', () => {
    const gate = door({ x: 5, y: 0 });
    const ram = hull({ x: 4, y: 0 }, ramPoste); // adjacente à la porte
    const chef = combatant({ pos: { x: 0, y: 0 }, mannedPoste: ramPoste, weapons: [sword, { ...ramWeapon }] } as never); // loin, arme perso + pièce servie
    const w = pickAttackWeaponList([chef, ram, gate], chef, gate);
    expect(w.uid).not.toBe(ramWeapon.uid);
    expect(w.uid).toBe(sword.uid); // repli sur l'arme personnelle
  });

  it('bélier : weaponUid EXPLICITE (option « Servir ») → le Bélier reste choisi (non-régression)', () => {
    const gate = door({ x: 5, y: 0 });
    const ram = hull({ x: 4, y: 0 }, ramPoste);
    const chef = combatant({ pos: { x: 0, y: 0 }, mannedPoste: ramPoste, weapons: [sword, { ...ramWeapon }] } as never);
    const w = firedWeapon(chef, gate, ramWeapon.uid, [chef, ram, gate]);
    expect(w.uid).toBe(ramWeapon.uid);
  });

  it('non-régression ARTILLERIE À DISTANCE (canon servi) : auto-choix (sans weaponUid) prend l\'arme PERSONNELLE (abordage), jamais le canon', () => {
    const target = combatant({ id: 'foe', pos: { x: 1, y: 0 } } as never); // au contact (mêlée personnelle possible)
    const cannonPoste2: ShipPoste = { item: cannonWeapon as never, crewIds: ['gunner'] };
    const gunner = combatant({ id: 'gunner', pos: { x: 0, y: 0 }, mannedPoste: cannonPoste2, weapons: [dagger, { ...cannonWeapon, type: 'ranged' as const }] } as never);
    const w = pickAttackWeaponList([gunner, target], gunner, target);
    expect(w.uid).not.toBe(cannonWeapon.uid);
    expect(w.uid).toBe(dagger.uid);
    // Option DÉDIÉE « Servir le canon » (weaponUid explicite) : inchangée.
    const w2 = pickAttackWeaponList([gunner, target], gunner, target, cannonWeapon.uid);
    expect(w2.uid).toBe(cannonWeapon.uid);
  });
});
