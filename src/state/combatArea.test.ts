import { describe, it, expect } from 'vitest';
import { resolveWeaponArea, areaTargets, type AreaHit } from './combatArea';
import { useGame } from './store';
import { seedBattleRng, battleRng } from './battleRng';
import type { Combatant, Weapon } from '../engine/types';
import type { TriggeredEffect } from './flow';

/**
 * Résolveur d'aire UNIQUE (Tir de zone / Explosion) — tests déterministes (RNG seedé). On monte un `battle`
 * réel dans le store (le helper lit `get()` pour les triggers onHit) et on appelle `resolveWeaponArea`
 * directement avec la stratégie de cibles voulue (terre = rayon métrique / mer = équipage exposé).
 */

// ── Fabriques minimales ────────────────────────────────────────────────────────────────────────────────
const foe = (id: string, x: number, y: number, wounds = 20, E = 30): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x, y }, wounds: { current: wounds, max: wounds }, advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: E, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, conditions: [], traits: [], talents: [], skills: [], weapons: [] }) as unknown as Combatant;

const shooter = (id = 'tireur', x = 0, y = 0): Combatant =>
  ({ ...foe(id, x, y), kind: 'hero' }) as Combatant;

/** Arme à distance porteuse de qualités/effets — `qualities` lus par `resolveQualities`, `onHitEffects` par `fireTriggers`. */
const rangedWeapon = (qualities: { id: string; value?: number }[], range = 60, flat = 12, onHitEffects?: TriggeredEffect[]): Weapon =>
  ({ name: 'Arme', type: 'ranged', range, damage: { flat, plusBF: false }, qualities, ...(onHitEffects ? { onHitEffects } : {}) }) as unknown as Weapon;

/** Scène minimale VALIDE (grille 40×40 d'herbe) — `losClear`/LoS lus par `fireTriggers` exigent `dimensions`+`layers`. */
const miniScene = (metresPerTile: number) =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, metresPerTile, ambiance: 'jour',
    layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] });

/** Monte un battle minimal dans le store et renvoie un `(get, set)` pointant dessus. */
function mountBattle(combatants: Combatant[], metresPerTile = 2) {
  seedBattleRng(7);
  useGame.setState({
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [], zones: [] } as never,
    scene: miniScene(metresPerTile) as never,
    party: [], facing: {}, pendingShipBattery: null,
  });
  const get = () => useGame.getState();
  const set: Parameters<typeof resolveWeaponArea>[1] = (p) => useGame.setState(p as never);
  return { get, set };
}

const mkHit = (attacker: Combatant, primaryTarget: Combatant, weapon: Weapon, damage: number, distanceTiles: number): AreaHit =>
  ({ attacker, primaryTarget, weapon, damage, location: 'corps', distanceTiles });

// ── Tir de zone (Aux Armes p.89 / MDG 12) ─────────────────────────────────────────────────────────────
describe('resolveWeaponArea — Tir de zone (bandes RAW)', () => {
  it('Bout portant → +Indice aux DÉGÂTS de la cible seule (pas +Indice Blessures brut)', () => {
    const atk = shooter('tireur', 0, 0);
    const tgt = foe('cible', 0, 0, 20, 30); // distance 0 case → Bout portant ; BE 3
    const { get, set } = mountBattle([atk, tgt], 2);
    const w = rangedWeapon([{ id: 'tir-de-zone', value: 5 }], 60, 12);
    // Sans aire : 12 dmg − BE3 = 9 Blessures déjà subies. Avec +5 dmg : 17 − 3 = 14 → surcroît attendu = 5.
    tgt.wounds.current = 20 - 9; // état « après touche primaire »
    const before = tgt.wounds.current;
    resolveWeaponArea(get, set, mkHit(atk, tgt, w, 12, 0), areaTargets([atk, tgt], 2), battleRng());
    expect(before - tgt.wounds.current).toBe(5); // EXACTEMENT +Indice aux Dégâts (5), pas un autre nombre
  });

  it('Courte-Longue → cible + Indice plus proches, dans Indice mètres (échelle 2 m/case)', () => {
    const atk = shooter('tireur', 0, 0);
    const tgt = foe('cible', 10, 0); // 10 cases → Moyenne (20 m ≤ 60)
    const a = foe('a', 11, 0); // 1 case de la cible (rayon Indice 3 m → ceil(3/2)=2 cases) → DANS la gerbe
    const b = foe('b', 13, 0); // 3 cases > 2 cases de rayon → HORS de la gerbe
    const { get, set } = mountBattle([atk, tgt, a, b], 2);
    const w = rangedWeapon([{ id: 'tir-de-zone', value: 3 }], 60, 12);
    const wa = a.wounds.current, wb = b.wounds.current;
    resolveWeaponArea(get, set, mkHit(atk, tgt, w, 12, 10), areaTargets([atk, tgt, a, b], 2), battleRng());
    expect(a.wounds.current).toBeLessThan(wa); // a (1 case) pris dans la gerbe
    expect(b.wounds.current).toBe(wb); // b (3 cases > rayon) hors de la gerbe, indemne
  });

  it('Extrême → comme Courte-Longue mais −Indice aux Dégâts (cible secondaire encaisse moins)', () => {
    // Deux scènes identiques sauf la bande : Moyenne vs Extrême, même cible secondaire adjacente.
    const run = (distTiles: number) => {
      const atk = shooter('tireur', 0, 0);
      const tgt = foe('cible', distTiles, 0);
      const sec = foe('sec', distTiles + 1, 0, 50, 0); // BE 0 → lit le Dégât brut
      const { get, set } = mountBattle([atk, tgt, sec], 2);
      const w = rangedWeapon([{ id: 'tir-de-zone', value: 3 }], 20, 14); // portée 20 m
      const before = sec.wounds.current;
      resolveWeaponArea(get, set, mkHit(atk, tgt, w, 14, distTiles), areaTargets([atk, tgt, sec], 2), battleRng());
      return before - sec.wounds.current;
    };
    const moyenne = run(8); // 16 m ≤ 20 → Moyenne (Dégât plein 14)
    const extreme = run(28); // 56 m ≤ 60 (×3) → Extrême (Dégât 14 − 3 = 11)
    expect(moyenne).toBe(14);
    expect(extreme).toBe(11); // −Indice (3) aux Dégâts
  });
});

// ── Explosion (LDB 62 l.254) ────────────────────────────────────────────────────────────────────────────────
describe('resolveWeaponArea — Explosion (rayon Indice m, États propagés)', () => {
  it('toutes les cibles à ≤ Indice mètres subissent DR+Dégâts ; hors rayon = épargné', () => {
    const atk = shooter('tireur', 0, 0);
    const tgt = foe('cible', 10, 0);
    const near = foe('near', 11, 0, 50, 0); // 1 case = 2 m ≤ Indice 4 m
    const far = foe('far', 13, 0, 50, 0); // 3 cases = 6 m > 4 m
    const { get, set } = mountBattle([atk, tgt, near, far], 2);
    const w = rangedWeapon([{ id: 'a-explosion', value: 4 }], 60, 14);
    const wnear = near.wounds.current, wfar = far.wounds.current;
    resolveWeaponArea(get, set, mkHit(atk, tgt, w, 14, 10), areaTargets([atk, tgt, near, far], 2), battleRng());
    expect(near.wounds.current).toBe(wnear - 14); // DR+Dégâts (brut, BE 0)
    expect(far.wounds.current).toBe(wfar); // hors rayon
  });

  it('propage les ÉTATS infligés par l’arme (onHit → condition) sur les cibles du souffle', () => {
    const atk = shooter('tireur', 0, 0);
    const tgt = foe('cible', 4, 0);
    const near = foe('near', 5, 0, 50, 0);
    const { get, set } = mountBattle([atk, tgt, near], 2);
    // Atout Explosion + effet onHit générique posant l'État « en-flammes » (chemin GÉNÉRIQUE, pas bespoke).
    const onHit: TriggeredEffect[] = [{ trigger: 'onHit', on: 'victim', flow: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'en-flammes', value: 1 }] } } } as never];
    const w = rangedWeapon([{ id: 'a-explosion', value: 4 }], 60, 14, onHit);
    resolveWeaponArea(get, set, mkHit(atk, tgt, w, 14, 4), areaTargets([atk, tgt, near], 2), battleRng());
    expect((near.conditions ?? []).some((c) => c.id === 'en-flammes')).toBe(true); // État propagé au secondaire
  });

  it('échelle 10 m/case : à l’échelle Mer, un rayon Indice 4 m couvre toujours ≥ 1 case (cible adjacente prise)', () => {
    const atk = shooter('tireur', 0, 0);
    const tgt = foe('cible', 5, 0);
    const adj = foe('adj', 6, 0, 50, 0); // 1 case = 10 m > 4 m, MAIS le rayon est plancher 1 case
    const { get, set } = mountBattle([atk, tgt, adj], 10);
    const w = rangedWeapon([{ id: 'a-explosion', value: 4 }], 200, 14);
    const before = adj.wounds.current;
    resolveWeaponArea(get, set, mkHit(atk, tgt, w, 14, 5), areaTargets([atk, tgt, adj], 10), battleRng());
    expect(adj.wounds.current).toBe(before - 14); // plancher 1 case → la case adjacente est dans le souffle
  });
});

// ── z-blindness (#798) : un autre étage à même (x,y) N'est PAS dans le souffle ───────────────────────────
describe('resolveWeaponArea — Explosion, z-blindness (#798)', () => {
  it("une cible sur un autre étage à MÊME (x,y), dans le rayon horizontal, est épargnée", () => {
    const atk = shooter('tireur', 0, 0);
    const tgt = foe('cible', 10, 0);
    tgt.pos = { ...tgt.pos!, z: 0 };
    const near = foe('near', 11, 0, 50, 0); // 1 case = 2 m ≤ Indice 4 m, MÊME étage → touché
    const ghost = foe('ghost', 11, 0, 50, 0); // même (x,y) que `near`, étage 1 → PAS touché
    ghost.pos = { ...ghost.pos!, z: 1 };
    const { get, set } = mountBattle([atk, tgt, near, ghost], 2);
    const w = rangedWeapon([{ id: 'a-explosion', value: 4 }], 60, 14);
    const wnear = near.wounds.current, wghost = ghost.wounds.current;
    resolveWeaponArea(get, set, mkHit(atk, tgt, w, 14, 10), areaTargets([atk, tgt, near, ghost], 2), battleRng());
    expect(near.wounds.current).toBe(wnear - 14); // même étage que la primaire : touché
    expect(ghost.wounds.current).toBe(wghost); // autre étage, même (x,y) : hors de l'aire (non touché)
  });
});

// ── Branche NAVALE : cible = navire → équipage exposé (composition MDG 13 × ch.12) ──────────────────────
describe('resolveWeaponArea — cible NAVIRE → équipage exposé (Éclats-like)', () => {
  const ship = (id: string): Combatant =>
    ({ id, name: id, kind: 'enemy', bodyShape: 'vehicule', pos: { x: 9, y: 5 }, crewIds: ['m1', 'm2', 'm3'],
      wounds: { current: 50, max: 50 }, advantage: 0, characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 0, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
      armour: { corps: 0 }, conditions: [], traits: [], talents: [], skills: [], weapons: [] }) as unknown as Combatant;

  it('Tir de zone → jusqu’à Indice marins exposés (pas le rayon métrique, dégénéré à 10 m/case)', () => {
    const atk = shooter('ship-tireur', 5, 5);
    const hull = ship('hull');
    const m1 = foe('m1', 9, 5, 8, 0), m2 = foe('m2', 9, 5, 8, 0), m3 = foe('m3', 9, 5, 8, 0);
    const crew = [m1, m2, m3];
    const { get, set } = mountBattle([atk, hull, ...crew], 10);
    const w = rangedWeapon([{ id: 'tir-de-zone', value: 2 }], 200, 12);
    // distance 15 cases → 30 m ≤ 100 (200/2) = Courte (≠ Bout portant) → la bande à cibles secondaires.
    resolveWeaponArea(get, set, mkHit(atk, hull, w, 12, 15), areaTargets([atk, hull, ...crew], 10, () => crew), battleRng());
    const touched = crew.filter((m) => m.wounds.current < 8).length;
    expect(touched).toBe(2); // EXACTEMENT Indice (2) marins balayés
  });

  it('Explosion → TOUT l’équipage exposé est touché', () => {
    const atk = shooter('ship-tireur', 5, 5);
    const hull = ship('hull');
    const m1 = foe('m1', 9, 5, 8, 0), m2 = foe('m2', 9, 5, 8, 0), m3 = foe('m3', 9, 5, 8, 0);
    const crew = [m1, m2, m3];
    const { get, set } = mountBattle([atk, hull, ...crew], 10);
    const w = rangedWeapon([{ id: 'a-explosion', value: 5 }], 200, 12);
    resolveWeaponArea(get, set, mkHit(atk, hull, w, 12, 4), areaTargets([atk, hull, ...crew], 10, () => crew), battleRng());
    expect(crew.every((m) => m.wounds.current < 8)).toBe(true); // tous les marins exposés touchés
  });
});

// ── Non-régression : munition simple → aucune cible secondaire ─────────────────────────────────────────────
describe('resolveWeaponArea — munition SANS atout d’aire', () => {
  it('aucune ligne, aucune cible secondaire affectée', () => {
    const atk = shooter('tireur', 0, 0);
    const tgt = foe('cible', 4, 0);
    const near = foe('near', 5, 0, 50, 0);
    const { get, set } = mountBattle([atk, tgt, near], 2);
    const w = rangedWeapon([{ id: 'perforante' }], 60, 14); // pas d'aire
    const before = near.wounds.current;
    const { lines } = resolveWeaponArea(get, set, mkHit(atk, tgt, w, 14, 4), areaTargets([atk, tgt, near], 2), battleRng());
    expect(lines).toEqual([]);
    expect(near.wounds.current).toBe(before);
  });
});
