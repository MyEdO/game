/**
 * LdV de combat & vision CROSS-Z (relief unifié) : un défenseur sur une couche haute (z=1) voit et tire
 * un assaillant au sol (z=0), et réciproquement la vision révèle le contrebas — sans casser le
 * comportement même-couche (byte-identique). Modèle : les murs d'ARÊTE fins (créneaux/parapet) ne coupent
 * PAS un tir/une vue inter-couche ; seules les TUILES opaques (terrain/décor) coupent. La vision est
 * z-DESCENDANTE (on voit en contrebas depuis une hauteur, jamais à travers un plancher vers le haut).
 */
import { describe, it, expect } from 'vitest';
import { lineOfSightCover } from '../noyau/monde/lineOfSight';
import { computeVisible, type LightField } from '../noyau/monde/vision';
import { computeStateVisible } from '../noyau/visionState';
import { Scene, SceneEntity, WallSeg, type Terrain } from '../noyau/monde/scene';
import type { Combatant } from '../engine/types';

function scene(w: number, h: number, tiles?: Record<string, string>, walls?: WallSeg[], entities: SceneEntity[] = []): Scene {
  const grid = new Array(w * h).fill('herbe');
  if (tiles)
    for (const [k, v] of Object.entries(tiles)) {
      const [x, y] = k.split(',').map(Number);
      grid[y * w + x] = v;
    }
  return {
    id: 's',
    nom: 's',
    dimensions: { w, h },
    ambiance: 'exterieur',
    ambientLight: 'jour',
    layers: [{ z: 0, tiles: grid }],
    entities,
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
    walls,
  } as unknown as Scene;
}

/** Champ de lumière constant (tout éclairé) pour isoler la géométrie. */
const BRIGHT: LightField = { at: () => 1 };

describe('lineOfSightCover — LdV de combat CROSS-Z', () => {
  it('défenseur (z=1) → assaillant (z=0) en terrain ouvert : LdV dégagée', () => {
    const def = { x: 0, y: 0, z: 1 };
    const ass = { x: 4, y: 0 }; // z=0 (omis)
    expect(lineOfSightCover(scene(6, 1), def, ass, [])).toEqual({ blocked: false, cover: 'none' });
    // réciproque : assaillant au sol vers le défenseur sur le rempart
    expect(lineOfSightCover(scene(6, 1), ass, def, []).blocked).toBe(false);
  });

  it('un mur d\'ARÊTE entre eux ne bloque PAS en cross-z (on tire par-dessus le parapet)', () => {
    const s = scene(6, 1, {}, [{ x: 2, y: 0, side: 'E' }]); // arête (2,0)|(3,0)
    const def = { x: 0, y: 0, z: 1 };
    const ass = { x: 4, y: 0 };
    expect(lineOfSightCover(s, def, ass, []).blocked).toBe(false);
    expect(lineOfSightCover(s, ass, def, []).blocked).toBe(false);
  });

  it('une TUILE opaque (terrain `mur`) à distance entre eux BLOQUE même en cross-z', () => {
    const s = scene(6, 1, { '2,0': 'mur' }); // tuile opaque NON adjacente à la cible (4,0)
    const def = { x: 0, y: 0, z: 1 };
    const ass = { x: 4, y: 0 };
    expect(lineOfSightCover(s, def, ass, []).blocked).toBe(true);
  });
});

describe('lineOfSightCover — TÉMOIN même couche (byte-identique)', () => {
  it('mur d\'arête entre deux combattants z=0 → bloqué (inchangé)', () => {
    const s = scene(6, 1, {}, [{ x: 2, y: 0, side: 'E' }]);
    expect(lineOfSightCover(s, { x: 0, y: 0 }, { x: 4, y: 0 }, []).blocked).toBe(true);
  });
  it('sans mur entre deux combattants z=0 → dégagé', () => {
    expect(lineOfSightCover(scene(6, 1), { x: 0, y: 0 }, { x: 4, y: 0 }, [])).toEqual({ blocked: false, cover: 'none' });
  });
});

describe('computeVisible — vision inter-couche (vers le bas seulement)', () => {
  it('un viewer z=1 révèle une case z=0 dans sa LdV (et sa propre case z=1)', () => {
    const v = computeVisible(scene(6, 1), [{ pos: { x: 0, y: 0 }, z: 1, radiusTiles: 5, darkTiles: 0 }], BRIGHT);
    expect(v.has('3,0,0')).toBe(true); // contrebas révélé
    expect(v.has('3,0,1')).toBe(true); // sa propre couche révélée
  });
  it('un viewer z=0 ne révèle PAS la couche z=1 (pas de vision vers le haut)', () => {
    const v = computeVisible(scene(6, 1), [{ pos: { x: 0, y: 0 }, radiusTiles: 5, darkTiles: 0 }], BRIGHT);
    expect(v.has('3,0,1')).toBe(false);
  });
  it('mono-couche : viewer z=0 révèle z=0 dans son rayon, pas au-delà (inchangé)', () => {
    const v = computeVisible(scene(8, 1), [{ pos: { x: 0, y: 0 }, radiusTiles: 3, darkTiles: 0 }], BRIGHT);
    expect(v.has('3,0,0')).toBe(true);
    expect(v.has('4,0,0')).toBe(false); // hors rayon (Chebyshev 4 > 3)
  });
});

describe('computeStateVisible — brouillard PARTY-ONLY : un PNJ allié-IA ne dévoile PAS la carte', () => {
  // 1 rangée, un MUR opaque en (5,0) coupe la LdV → le héros de gauche ne voit pas au-delà ; le combattant
  // de droite (derrière le mur) ne révèle SA case QUE s'il compte comme viewer. Décision : fog PARTY-ONLY →
  // un PNJ allié piloté par l'IA (`aiControlled`) n'est PAS viewer ; un vrai héros (coop, sans drapeau) l'est.
  const w = 12, h = 1;
  const z0 = new Array(w * h).fill('herbe') as Terrain[]; z0[5] = 'mur';
  const sc = {
    id: 's', label: 's', dimensions: { w, h }, ambiance: 'exterieur', ambientLight: 'jour',
    layers: [{ z: 0, tiles: z0 }],
    entities: [], dialogues: [], triggers: [], encounters: [], flags: {},
  } as unknown as Scene;
  const mkHero = (id: string, x: number, extra: Partial<Combatant> = {}): Combatant =>
    ({ id, kind: 'hero', pos: { x, y: 0 }, conditions: [], traits: [], characteristics: {}, ...extra }) as unknown as Combatant;
  const visWith = (right: Combatant) =>
    computeStateVisible({ scene: sc, battle: { combatants: [mkHero('manual', 0), right] }, partyPos: { x: 0, y: 0 }, gameTime: 12 * 60, lightLevel: null });

  it('le PNJ allié-IA (aiControlled) ne révèle PAS sa zone, derrière le mur ; le héros manuel voit la sienne', () => {
    const vis = visWith(mkHero('ally', 10, { aiControlled: true }));
    expect(vis.has('0,0,0')).toBe(true);   // le héros manuel voit sa propre case
    expect(vis.has('10,0,0')).toBe(false); // la case du PNJ allié-IA reste dans le brouillard (au-delà du mur)
  });

  it('une PIÈCE INERTE alliée (affût baliste/canon, kind:hero mais inert) ne révèle PAS sa zone', () => {
    const vis = visWith(mkHero('affut', 10, { inert: true })); // objet sans yeux → pas viewer
    expect(vis.has('10,0,0')).toBe(false); // l'affût ne dévoile pas le champ derrière le mur
  });

  it('CONTRÔLE : le même combattant SANS aiControlled (héros coop) redevient viewer et révèle sa zone', () => {
    const vis = visWith(mkHero('ally', 10)); // pas de drapeau → vrai héros = viewer
    expect(vis.has('10,0,0')).toBe(true);
  });
});

describe('computeStateVisible — INTÉGRATION : le viewer porte sa COUCHE (z-descendant)', () => {
  it("un héros sur le rempart (z=1, au-dessus d'une tuile de MUR) révèle le contrebas (z=0)", () => {
    const w = 6, h = 1;
    const z0 = new Array(w * h).fill('sol') as Terrain[]; z0[0] = 'mur'; // le mur, sous le rempart : un viewer calculé à z=0 y serait aveugle
    const z1 = new Array(w * h).fill('vide') as Terrain[]; z1[0] = 'plancher'; // chemin de ronde en (0,0)
    const sc = {
      id: 's', label: 's', dimensions: { w, h }, ambiance: 'exterieur', ambientLight: 'jour',
      layers: [{ z: 0, tiles: z0 }, { z: 1, tiles: z1, height: [4, 0, 0, 0, 0, 0] }],
      entities: [], dialogues: [], triggers: [], encounters: [], flags: {},
    } as unknown as Scene;
    const hero = { id: 'h', kind: 'hero', pos: { x: 0, y: 0, z: 1 }, conditions: [], traits: [], characteristics: {} } as unknown as Combatant;
    const vis = computeStateVisible({ scene: sc, battle: { combatants: [hero] }, partyPos: { x: 0, y: 0 }, gameTime: 12 * 60, lightLevel: null });
    expect(vis.has('0,0,1')).toBe(true); // sa propre couche (rempart)
    expect(vis.has('3,0,0')).toBe(true); // case au SOL en contrebas RÉVÉLÉE — le viewer porte z: c.pos.z
  });
});

describe('lineOfSightCover — angle mort VERTICAL (dead ground) au pied du rempart', () => {
  // Rempart 4 m (WALL_H=LEVEL_H, relief.ts METRES_PER_LEVEL) : bloc plein `mur` au sol (0,0), chemin de
  // ronde `plancher` par-dessus à 4 m (z1, même case) — patron identique à l'INTÉGRATION ci-dessus.
  const rampartScene = (w: number): Scene => {
    const z0 = new Array(w).fill('sol') as Terrain[]; z0[0] = 'mur';
    const z1 = new Array(w).fill('vide') as Terrain[]; z1[0] = 'plancher';
    const height1 = new Array(w).fill(0); height1[0] = 4;
    return {
      id: 's', label: 's', dimensions: { w, h: 1 }, ambiance: 'exterieur', ambientLight: 'jour',
      layers: [{ z: 0, tiles: z0 }, { z: 1, tiles: z1, height: height1 }],
      entities: [], dialogues: [], triggers: [], encounters: [], flags: {},
    } as unknown as Scene;
  };
  const def = { x: 0, y: 0, z: 1 }; // défenseur au sommet du rempart (4 m)

  it('cible COLLÉE au pied du rempart (adjacente, en contrebas) → angle mort, HORS de vue (et réciproquement)', () => {
    const s = rampartScene(6);
    const foot = { x: 1, y: 0 }; // z=0, adjacente à la base du rempart
    expect(lineOfSightCover(s, def, foot, []).blocked).toBe(true);
    expect(lineOfSightCover(s, foot, def, []).blocked).toBe(true); // réciproque : le pied ne voit pas non plus le sommet
  });

  it('cible plus ÉLOIGNÉE au sol → LdV dégagée (par-dessus le parapet, inchangé)', () => {
    const s = rampartScene(6);
    const far = { x: 4, y: 0 };
    expect(lineOfSightCover(s, def, far, []).blocked).toBe(false);
  });
});
