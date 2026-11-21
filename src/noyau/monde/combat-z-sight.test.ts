/** Ligne de vue entre couches, masquage par la hauteur des masses et couvert au combat. */
import { describe, it, expect } from 'vitest';
import { lineOfSightCover } from './lineOfSight';
import { computeVisible, type LightField } from './vision';
import { computeStateVisible } from '../visionState';
import { emptyScene, Scene, SceneEntity, WallSeg } from './scene';
import { METRES_PER_LEVEL } from './relief';
import type { Terrain } from '../../data/schemas/defs-scenes/scene';
import type { Combatant } from '../../engine/types';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { scenario as siege } from '../../scenes/test-scenarios/siege-enceinte';
import { scenario as opera } from '../../scenes/test-scenarios/opera';

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
});

describe('le masquage des masses par leur hauteur en vision et au tir', () => {
  const tireur = { x: 0, y: 0, z: 1 };
  const cible = { x: 4, y: 0 };

  function sceneDuTir(hauteurDuSocle: number, hauteurDuTireur = METRES_PER_LEVEL): Scene {
    const s = emptyScene('masse-opaque', 5, 1);
    return { ...s, layers: [
      { z: 0, tiles: ['sol', 'sol', 'mur', 'sol', 'sol'], height: [0, 0, hauteurDuSocle, 0, 0] },
      { z: 1, tiles: ['plancher', 'vide', 'vide', 'vide', 'vide'], height: [hauteurDuTireur, 0, 0, 0, 0] },
    ] };
  }

  it.each([
    { socle: -1, hauteur: METRES_PER_LEVEL, bloque: false },
    { socle: 0, hauteur: METRES_PER_LEVEL, bloque: false },
    { socle: 0.8, hauteur: METRES_PER_LEVEL + 0.8, bloque: false },
    { socle: 1, hauteur: METRES_PER_LEVEL, bloque: true },
  ])('mur sur un socle de $socle m, tireur à $hauteur m : masquage = $bloque', ({ socle, hauteur, bloque }) => {
    const s = sceneDuTir(socle, hauteur);
    const visibles = computeVisible(s, [{ pos: tireur, z: tireur.z, radiusTiles: 4, darkTiles: 0 }], BRIGHT);
    expect(visibles.has('4,0,0')).toBe(!bloque);
    expect(lineOfSightCover(s, tireur, cible, [])).toEqual({ blocked: bloque, cover: bloque ? 'totale' : 'none' });
  });

  it('le tireur surélevé dans la couche du sol voit et tire au-dessus de la masse', () => {
    const s = emptyScene('relief', 5, 1);
    const relief: Scene = { ...s, layers: [
      { z: 0, tiles: ['sol', 'sol', 'mur', 'sol', 'sol'], height: [METRES_PER_LEVEL + 1, 0, 0, 0, 0] },
    ] };
    const observateur = { x: 0, y: 0 };
    const visibles = computeVisible(relief, [{ pos: observateur, radiusTiles: 4, darkTiles: 0 }], BRIGHT);
    expect(visibles.has('4,0,0')).toBe(true);
    expect(lineOfSightCover(relief, observateur, cible, [])).toEqual({ blocked: false, cover: 'none' });
  });

  it('une masse adjacente sur la ligne donne un couvert total de part et d’autre de la hauteur du tireur', () => {
    const cibleProche = { x: 3, y: 0 };
    expect(lineOfSightCover(sceneDuTir(-1), tireur, cibleProche, [])).toEqual({ blocked: false, cover: 'totale' });
    expect(lineOfSightCover(sceneDuTir(1), tireur, cibleProche, [])).toEqual({ blocked: false, cover: 'totale' });
  });

  it('une masse effleurée par la diagonale masque la cible en vision et au tir', () => {
    const s = scene(4, 3, { '1,0': 'mur' });
    const observateur = { x: 0, y: 0 };
    const cibleEnBiais = { x: 3, y: 2 };
    const visibles = computeVisible(s, [{ pos: observateur, radiusTiles: 3, darkTiles: 0 }], BRIGHT);
    expect(visibles.has('3,2,0')).toBe(false);
    expect(lineOfSightCover(s, observateur, cibleEnBiais, [])).toEqual({ blocked: true, cover: 'totale' });
  });

  it('la fumée à l’étage du tireur occulte le tir qui passe au-dessus du mur', () => {
    const s = sceneDuTir(-1);
    expect(lineOfSightCover(s, tireur, cible, [], [{ x: 2, y: 0, z: 1 }])).toEqual({ blocked: true, cover: 'totale' });
    expect(lineOfSightCover(s, tireur, cible, [], [{ x: 2, y: 0 }])).toEqual({ blocked: false, cover: 'none' });
  });
});

describe('siège de l’enceinte — tir du chemin de ronde', () => {
  const { scene: enceinte } = siege.construire(idsDeTest);

  it.each([
    { tireur: { x: 20, y: 38, z: 1 }, cible: { x: 19, y: 7 } },
    { tireur: { x: 4, y: 37, z: 1 }, cible: { x: 14, y: 32 } },
  ])('le tireur en $tireur voit et peut viser le gobelin en $cible', ({ tireur, cible }) => {
    const visibles = computeVisible(enceinte, [{ pos: tireur, z: tireur.z, radiusTiles: 32, darkTiles: 0 }], BRIGHT);
    expect(visibles.has(`${cible.x},${cible.y},0`)).toBe(true);
    expect(lineOfSightCover(enceinte, tireur, cible, []).blocked).toBe(false);
  });

  it('au seuil du terrain mort, la muraille adjacente donne toujours un couvert total', () => {
    const tireur = { x: 7, y: 38, z: 1 };
    const cible = { x: 7, y: 36 };
    expect(lineOfSightCover(enceinte, tireur, cible, [])).toEqual({ blocked: false, cover: 'totale' });
  });

  it('le terrain mort au pied extérieur du rempart masque la cible au tireur', () => {
    const tireur = { x: 20, y: 37, z: 1 };
    const pied = { x: 20, y: 36 };
    expect(lineOfSightCover(enceinte, tireur, pied, [])).toEqual({ blocked: true, cover: 'totale' });
  });
});

describe('opéra — diagonales près des coins des masses opaques', () => {
  const { scene: theatre } = opera.construire(idsDeTest);

  it('la vue et le tir passent quand le rayon touche seulement le coin de la masse', () => {
    const tireur = { x: 1, y: 5, z: 1 };
    const cible = { x: 3, y: 3 };
    const visibles = computeVisible(theatre, [{ pos: tireur, z: tireur.z, radiusTiles: 3, darkTiles: 0 }], BRIGHT);
    expect(visibles.has('3,3,0')).toBe(true);
    expect(lineOfSightCover(theatre, tireur, cible, []).blocked).toBe(false);
  });

  it('la masse masque la cible en vision et au tir même si le rayon la traverse près du coin', () => {
    const tireur = { x: 9, y: 8 };
    const cible = { x: 1, y: 3 };
    const visibles = computeVisible(theatre, [{ pos: tireur, radiusTiles: 8, darkTiles: 0 }], BRIGHT);
    expect(visibles.has('1,3,0')).toBe(false);
    expect(lineOfSightCover(theatre, tireur, cible, [])).toEqual({ blocked: true, cover: 'totale' });
  });
});

describe('lineOfSightCover — murs d’arête sur la même couche', () => {
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
  // Trois couches sur une rangée : un plancher z1 en (3,0), de l'air partout ailleurs au-dessus du sol.
  const etages = (): Scene => {
    const z1 = new Array(6).fill('vide'); z1[3] = 'pierre';
    return { ...scene(6, 1), layers: [{ z: 0, tiles: new Array(6).fill('herbe') }, { z: 1, tiles: z1 }, { z: 2, tiles: new Array(6).fill('vide') }] };
  };
  it('un viewer z=0 voit l’AIR au-dessus des cases qu’il voit, couche après couche, à ciel ouvert', () => {
    const v = computeVisible(etages(), [{ pos: { x: 0, y: 0 }, radiusTiles: 5, darkTiles: 0 }], BRIGHT);
    for (const k of ['2,0,1', '2,0,2', '4,0,1', '4,0,2']) expect(v.has(k), k).toBe(true);
  });
  it('un viewer z=0 ne voit ni un plancher z=1 ni rien au-dessus (pas de vision à travers un sol)', () => {
    const v = computeVisible(etages(), [{ pos: { x: 0, y: 0 }, radiusTiles: 5, darkTiles: 0 }], BRIGHT);
    expect(v.has('3,0,0')).toBe(true);
    expect(v.has('3,0,1')).toBe(false);
    expect(v.has('3,0,2')).toBe(false);
  });
  it('l’air d’une case hors de vue reste hors de vue', () => {
    const v = computeVisible(etages(), [{ pos: { x: 0, y: 0 }, radiusTiles: 2, darkTiles: 0 }], BRIGHT);
    expect(v.has('4,0,0')).toBe(false);
    expect(v.has('4,0,1')).toBe(false);
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
    ({ id, kind: 'heros', pos: { x, y: 0 }, conditions: [], traits: [], characteristics: {}, ...extra }) as unknown as Combatant;
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
    const hero = { id: 'h', kind: 'heros', pos: { x: 0, y: 0, z: 1 }, conditions: [], traits: [], characteristics: {} } as unknown as Combatant;
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
