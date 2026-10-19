/**
 * Garde structurel ANTI-RÉGRESSION « z-aveugle » (#807) — verrouille que la SÉPARATION D'ÉTAGE tient
 * PARTOUT où deux entités/zones peuvent partager le même (x,y) sur des couches différentes. Racine
 * commune : `tileKey(x,y,z)` (path.ts, z=0 omis / z>0 suffixé) pour les grilles de blocage, et
 * `combatDistance` (footprint.ts:99-104, `verticalTiles` sur la hauteur RÉELLE `pos.h`) pour le
 * mono-cible/aura. Chaque site est verrouillé en DEUX sens : POSITIF (même étage → actif, inchangé)
 * et NÉGATIF (autre étage, même (x,y) → inerte).
 */
import { describe, it, expect } from 'vitest';
import { entityBlockedAt } from '../noyau/monde/sceneRules';
import { combatDistance } from '../noyau/monde/footprint';
import { combatantsWithinRadius, combatantAtTile, occupied } from '../noyau/monde/combatGeometry';
import { zoneCovers, crossZones, zonesRoundTick, sceneZonesToBattle, type BattleZone } from '../noyau/monde/zones';
import { applyTriggeredEffects } from '../noyau/triggeredEffects';
import './combatFlow'; // effet de bord : installe le routeur de Test consommé par `applyTriggeredEffects`
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { Scene, SceneEntity, SceneEffectZone } from '../noyau/monde/scene';
import type { Pt } from '../noyau/monde/path';

const mk = (id: string, x: number, y: number, z = 0, h = 0): Combatant =>
  ({
    id, label: id, kind: 'enemy', pos: { x, y, ...(z ? { z } : {}), ...(h ? { h } : {}) },
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], traits: [], talents: [], skills: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  }) as unknown as Combatant;

/** Scène 2 étages (10×10) : rez `z:0` au sol (h=0), couche `z:1` un ÉTAGE au-dessus (h=4 m partout,
 *  `METRES_PER_LEVEL`) — même patron que `combat-z-sight.test.ts`/`combatManeuvers-zblind.test.ts`. */
function twoFloorScene(entities: SceneEntity[] = [], effectZones: SceneEffectZone[] = []): Scene {
  const n = 10 * 10;
  return {
    id: 's', label: 's', dimensions: { w: 10, h: 10 }, ambiance: 'interieur',
    layers: [
      { z: 0, tiles: new Array(n).fill('sol') },
      { z: 1, tiles: new Array(n).fill('plancher'), height: new Array(n).fill(4) },
    ],
    entities, dialogues: [], triggers: [], encounters: [], flags: {}, effectZones,
  } as unknown as Scene;
}

const rng = makeRNG(1);
const noCaster = () => undefined;

describe('z-blindness #807 — entityBlockedAt (décor multi-cases/interactif)', () => {
  const prop: SceneEntity = { id: 'p', kind: 'prop', pos: { x: 3, y: 3 }, z: 0, ref: 'tente' }; // 2×2 au catalogue
  const scene = twoFloorScene([prop]);

  it('POSITIF — bloque sa propre couche (z0), la case couverte par son empreinte', () => {
    expect(entityBlockedAt(scene, 3, 3, 0)).toBe(true);
    expect(entityBlockedAt(scene, 4, 4, 0)).toBe(true);
  });
  it("NÉGATIF — n'affecte PAS le même (x,y) à l'autre étage (z1)", () => {
    expect(entityBlockedAt(scene, 3, 3, 1)).toBe(false);
    expect(entityBlockedAt(scene, 4, 4, 1)).toBe(false);
  });
});

describe('z-blindness #807 — combatDistance (mono-cible, hauteur réelle)', () => {
  it('POSITIF — même étage (h identique) : distance = Chebyshev horizontal pur', () => {
    const a = mk('a', 0, 0, 0, 0);
    const b = mk('b', 3, 0, 0, 0);
    expect(combatDistance(a, b)).toBe(3);
  });
  it("NÉGATIF — même (x,y), étage supérieur (Δh=4m=2 cases) : distance DOMINÉE par la verticale", () => {
    const sol = mk('sol', 5, 5, 0, 0);
    const etage = mk('etage', 5, 5, 1, 4);
    expect(combatDistance(sol, etage)).toBe(2); // horizontal 0, vertical = 4/2 = 2 cases
  });
});

describe('z-blindness #807 — combatantsWithinRadius (aire/orchestrateur partagé)', () => {
  const center = { x: 5, y: 5 };
  it('POSITIF (défaut z-aware) — même étage, dans le rayon : inclus', () => {
    const c = mk('c', 6, 5, 0);
    expect(combatantsWithinRadius(center, 2, [c])).toEqual([c]);
  });
  it("NÉGATIF (défaut z-aware) — même (x,y), autre étage : EXCLU (distance Infinity)", () => {
    const c = mk('c', 6, 5, 1);
    expect(combatantsWithinRadius(center, 2, [c])).toEqual([]);
  });
  it('NÉGATIF (dist=combatDistance, empreinte) — même (x,y), étage supérieur réel : hors rayon', () => {
    const src = mk('src', 5, 5, 0, 0);
    const above = mk('above', 5, 5, 1, 4); // 2 cases de vertical
    const withinFloor = combatantsWithinRadius(src.pos!, 1, [above], undefined, (_c, x) => combatDistance(src, x));
    expect(withinFloor).toEqual([]);
    const withinRadius2 = combatantsWithinRadius(src.pos!, 2, [above], undefined, (_c, x) => combatDistance(src, x));
    expect(withinRadius2).toEqual([above]); // au rayon exact (2 cases), inclus — contrôle POSITIF de la formule
  });
});

describe('z-blindness #807 — zoneCovers / onCross / perRound / barrière', () => {
  const zoneOnZ1: BattleZone = {
    label: 'brasier', tiles: [{ x: 4, y: 4, z: 1 }], rounds: 3,
    onCross: [{ op: 'wounds', amount: 5 }],
    perRound: [{ op: 'wounds', amount: 5 }],
    barrier: {},
  };

  it('zoneCovers — POSITIF même étage, NÉGATIF autre étage même (x,y)', () => {
    expect(zoneCovers(zoneOnZ1, { x: 4, y: 4, z: 1 })).toBe(true);
    expect(zoneCovers(zoneOnZ1, { x: 4, y: 4, z: 0 })).toBe(false);
  });

  it("onCross (crossZones) — NÉGATIF : mover z0 traverse le même (x,y) que la zone z1, inerte", () => {
    const mover = mk('m', 3, 4, 0);
    const path: Pt[] = [{ x: 3, y: 4, z: 0 }, { x: 4, y: 4, z: 0 }, { x: 5, y: 4, z: 0 }];
    const lines = crossZones([zoneOnZ1], mover, path, noCaster, rng);
    expect(lines).toEqual([]);
    expect(mover.wounds.current).toBe(20);
  });
  it('onCross (crossZones) — POSITIF : mover z1 traverse la case couverte, subit onCross', () => {
    const mover = mk('m', 3, 4, 1);
    const path: Pt[] = [{ x: 3, y: 4, z: 1 }, { x: 4, y: 4, z: 1 }, { x: 5, y: 4, z: 1 }];
    const lines = crossZones([zoneOnZ1], mover, path, noCaster, rng);
    expect(lines.length).toBeGreaterThan(0);
    expect(mover.wounds.current).toBe(15);
  });

  it("perRound (zonesRoundTick) — NÉGATIF : combattant z0 stationné au même (x,y), inerte", () => {
    const c = mk('c', 4, 4, 0);
    const out = zonesRoundTick([zoneOnZ1], [c], rng);
    expect(out).toEqual([]);
    expect(c.wounds.current).toBe(20);
  });
  it('perRound (zonesRoundTick) — POSITIF : combattant z1 stationné dedans, subit perRound', () => {
    const c = mk('c', 4, 4, 1);
    const out = zonesRoundTick([zoneOnZ1], [c], rng);
    expect(out.length).toBe(1);
    expect(c.wounds.current).toBe(15);
  });

  it('barrière (barrierTilesFor → occupied) — NÉGATIF : mover z0 non bloqué par la barrière z1 au même (x,y)', () => {
    const mover = mk('m', 0, 0, 0);
    const battle = { combatants: [], zones: [zoneOnZ1] } as unknown as Parameters<typeof occupied>[0];
    const blocked = occupied(battle, mover);
    expect(blocked.has('4,4')).toBe(false);
  });
  it('barrière (barrierTilesFor → occupied) — POSITIF : mover z1 bloqué par la barrière sur sa propre couche', () => {
    const mover = mk('m', 0, 0, 1);
    const battle = { combatants: [], zones: [zoneOnZ1] } as unknown as Parameters<typeof occupied>[0];
    const blocked = occupied(battle, mover);
    expect(blocked.has('4,4,1')).toBe(true);
  });

  it('sceneZonesToBattle — une zone authorée `z:1` propage son étage aux tuiles (racine de la séparation)', () => {
    const authored: SceneEffectZone = { id: 'z', label: 'brasier', area: { kind: 'rect', x: 4, y: 4, w: 1, h: 1 }, z: 1, onCross: [{ op: 'wounds', amount: 1 }] };
    const [battleZone] = sceneZonesToBattle([authored]);
    expect(battleZone.tiles).toEqual([{ x: 4, y: 4, z: 1 }]);
    expect(zoneCovers(battleZone, { x: 4, y: 4, z: 0 })).toBe(false);
  });
});

describe("z-blindness #807 — interaction (combatantAtTile, curseur/clic)", () => {
  const sol = mk('sol', 4, 4, 0);
  const etage = mk('etage', 4, 4, 1);

  it('POSITIF — un combattant au même (x,y,z) est trouvé', () => {
    expect(combatantAtTile([sol, etage], 4, 4, 0)).toBe(sol);
    expect(combatantAtTile([sol, etage], 4, 4, 1)).toBe(etage);
  });
  it("NÉGATIF — cliquer (x,y) sur une couche ne trouve PAS le combattant de l'autre couche", () => {
    expect(combatantAtTile([etage], 4, 4, 0)).toBeUndefined();
    expect(combatantAtTile([sol], 4, 4, 1)).toBeUndefined();
  });
});

describe('z-blindness #807 — aura (`TriggeredEffect.on:{near}`, effet déclenché SOURCE-AGNOSTIQUE)', () => {
  const auraEffect = {
    trigger: 'onHit' as const,
    on: { near: 'self' as const, radiusMeters: 4 }, // 4 m → 2 cases
    flow: { kind: 'do' as const, effect: { type: 'ops' as const, on: 'target' as const, ops: [{ op: 'wounds' as const, amount: 6 }] } },
  };

  it('POSITIF — un combattant du même étage, dans le rayon, subit l\'aura', () => {
    const center = mk('ctr', 5, 5, 0, 0);
    const near = mk('near', 6, 5, 0, 0); // 1 case, même étage
    const get = () => ({ battle: { combatants: [center, near] } }) as never;
    applyTriggeredEffects(get, center, [auraEffect], 'onHit', { rng: makeRNG(2) });
    expect(near.wounds.current).toBe(14); // 20 − 6
  });
  it("NÉGATIF — même (x,y) mais à l'étage supérieur (hauteur réelle) : hors de portée de l'aura", () => {
    const center = mk('ctr', 5, 5, 0, 0);
    const farAbove = mk('farAbove', 5, 5, 1, 20); // même (x,y), vertical largement > rayon
    const get = () => ({ battle: { combatants: [center, farAbove] } }) as never;
    applyTriggeredEffects(get, center, [auraEffect], 'onHit', { rng: makeRNG(2) });
    expect(farAbove.wounds.current).toBe(20); // intact — hors rayon vertical
  });
});
