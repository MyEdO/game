import { describe, it, expect } from 'vitest';
import { buildWalls, wallEnds } from './walls';
import type { WallEl } from './types';
import { WALL_H_M, isoPxToM } from '../iso';
import { METRES_PER_LEVEL } from '../../state/relief';
import { structureAppearance } from '../catalog/structures';
import { emptyScene, setDoorRevealed, setStructureDown, type BuildingMass, type Scene, type SceneEffectZone, type WallSeg } from '../../state/scene';
import { buildScene } from '../../state/mapSpec';

/**
 * Builder de MURS du pivot : on teste la sortie MONDE (camera-free) — l'aiguillage d'arête unique
 * (`wallEnds`), les hauteurs en MÈTRES (conversion px⇔m partagée `isoPxToM`), les faces d'assemblage
 * pilotées par la DEF (parapet/merlons/herse/porte/brèche) et les vérités de scène (down/open/visible).
 */

function sceneWith(walls: WallSeg[]): Scene {
  const s = emptyScene(6, 6);
  s.walls = walls;
  return s;
}
const one = (s: Scene): WallEl => buildWalls(s, 'jeu')[0];
const parts = (el: WallEl) => el.faces.map((f) => f.material.part);
const facesOf = (el: WallEl, part: string) => el.faces.filter((f) => f.material.part === part);

describe('wallEnds — aiguillage d’arête UNIQUE (cardinales + diagonales)', () => {
  it('N/E/\\// : extrémités A,B canoniques, partagées par l’iso et le POV', () => {
    expect(wallEnds({ x: 5, y: 6, side: 'N' })).toEqual([{ x: 4.5, y: 5.5 }, { x: 5.5, y: 5.5 }]);
    expect(wallEnds({ x: 5, y: 6, side: 'E' })).toEqual([{ x: 5.5, y: 5.5 }, { x: 5.5, y: 6.5 }]);
    expect(wallEnds({ x: 5, y: 6, side: '\\' })).toEqual([{ x: 4.5, y: 5.5 }, { x: 5.5, y: 6.5 }]);
    expect(wallEnds({ x: 5, y: 6, side: '/' })).toEqual([{ x: 5.5, y: 5.5 }, { x: 4.5, y: 6.5 }]);
  });
});

describe('buildWalls — mur BOIS nu (def sans parapet)', () => {
  const el = one(sceneWith([{ x: 2, y: 2, side: 'N' }]));

  it('sans opt-in, aucun panneau ni moulure ne couvre la face ordinaire', () => {
    expect(parts(el)).toEqual(['poteau', 'face', 'plinthe', 'couronnement', 'couronnement', 'poteau']);
  });

  it('avec bayPanel, le panneau et sa moulure sont émis sur la face ordinaire', () => {
    const def = structureAppearance('plain');
    def.bayPanel = true;
    try {
      expect(parts(one(sceneWith([{ x: 2, y: 2, side: 'N' }])))).toEqual([
        'poteau', 'face', 'panneau', 'moulure', 'plinthe', 'couronnement', 'couronnement', 'poteau',
      ]);
    } finally {
      delete def.bayPanel;
    }
  });

  it('la face est un quad [A@haut, B@haut, B@bas, A@bas] de WALL_H_M mètres sur l’arête wallEnds', () => {
    const face = facesOf(el, 'face')[0];
    expect(face.poly.map((p) => p.h)).toEqual([WALL_H_M, WALL_H_M, 0, 0]);
    const [A, B] = wallEnds({ x: 2, y: 2, side: 'N' });
    expect(face.poly[0]).toMatchObject(A);
    expect(face.poly[1]).toMatchObject(B);
  });

  it('les montants (poteau) = 2 points [haut, bas] aux extrémités (convention du pilier de sol)', () => {
    const posts = facesOf(el, 'poteau');
    expect(posts).toHaveLength(2);
    for (const p of posts) {
      expect(p.poly).toHaveLength(2);
      expect(p.poly[0].h).toBe(WALL_H_M);
      expect(p.poly[1].h).toBe(0);
    }
    expect(posts[0].poly[0]).toMatchObject({ x: 1.5, y: 1.5 }); // A
    expect(posts[1].poly[0]).toMatchObject({ x: 2.5, y: 1.5 }); // B
  });

  it('identité : key stable, side, appearance résolue (plain à hauteur 0), états à faux', () => {
    expect(el.key).toBe('wall:2,2,N,0');
    expect(el.side).toBe('N');
    expect(el.appearance).toBe('plain');
    expect(el.states).toEqual({ visible: true, down: false, open: false });
  });
});

describe('buildWalls — hauteur visuelle portée par l’apparence', () => {
  it('borne la face et les poteaux à 1,25 m sans modifier les portes et fenêtres voisines', () => {
    const [fence, door, window] = buildWalls(sceneWith([
      { x: 1, y: 1, side: 'N', structure: 'cloture-en-clayonnage' },
      { x: 2, y: 1, side: 'N', door: true, structure: 'solide-porte-en-bois' },
      { x: 3, y: 1, side: 'N', window: true, structure: 'mur-a-ossature-en-bois' },
    ]), 'jeu');
    const topOf = (el: WallEl, selected: readonly string[]) => Math.max(
      ...el.faces.filter((face) => face.material.part != null && selected.includes(face.material.part))
        .flatMap((face) => face.poly.map((point) => point.h)),
    );

    expect(topOf(fence, ['face', 'poteau'])).toBe(1.25);
    expect(topOf(door, ['face', 'poteau'])).toBe(WALL_H_M);
    expect(topOf(window, ['face', 'poteau'])).toBe(WALL_H_M);

    const sousEtage = sceneWith([{ x: 1, y: 1, side: 'N', structure: 'cloture-en-clayonnage' }]);
    sousEtage.layers.push({
      z: 1,
      tiles: new Array(36).fill('herbe'),
      height: new Array(36).fill(METRES_PER_LEVEL),
    });
    const fenceSousEtage = one(sousEtage);
    expect(topOf(fenceSousEtage, ['couronnement'])).toBe(1.25 + isoPxToM(4));
  });

  it('l’override visuel abaisse un mur sans remplacer sa structure mécanique', () => {
    const seg = {
      x: 1, y: 1, side: 'N',
      structure: 'mur-a-ossature-en-bois',
      appearance: 'cloison-basse-a-ossature-en-bois',
    } satisfies WallSeg;
    const wall = one(sceneWith([seg]));
    const top = Math.max(...facesOf(wall, 'face').flatMap((face) => face.poly.map((point) => point.h)));

    expect(seg.structure).toBe('mur-a-ossature-en-bois');
    expect(wall.appearance).toBe('cloison-basse-a-ossature-en-bois');
    expect(top).toBe(1.25);
  });
});

describe('buildWalls — hauteur de base MÉTRIQUE (heightAt, vérité partagée iso/POV)', () => {
  /** Une case à 4 m porte la GÉOMÉTRIE du mur (il part de 4 m) et RIEN de son apparence (#1180) :
   *  nu il reste `plain`, fortifié il le DIT en donnée. */
  const scene4m = (seg: WallSeg): Scene => {
    const s = sceneWith([seg]);
    s.layers[0].height = new Array(36).fill(0);
    s.layers[0].height[2 * 6 + 2] = 4;
    return s;
  };

  it('un mur sur une case à 4 m part de 4 m ; sans structure il RESTE un mur nu', () => {
    const el = one(scene4m({ x: 2, y: 2, side: 'E' }));
    expect(el.appearance).toBe('plain');
    expect(el.ends[0].h).toBe(4);
    const face = facesOf(el, 'face')[0];
    expect(face.poly.map((p) => p.h)).toEqual([4 + WALL_H_M, 4 + WALL_H_M, 4, 4]);
  });

  it('LE MÊME mur à 4 m avec `structure: mur-en-pierre` rend la pierre — la DONNÉE décide', () => {
    const el = one(scene4m({ x: 2, y: 2, side: 'E', structure: 'mur-en-pierre' }));
    expect(el.appearance).toBe('mur-en-pierre');
    expect(el.ends[0].h).toBe(4);
  });
});

describe('buildWalls — façades architecturales authorées', () => {
  const facadeScene = (): Scene => {
    const s = sceneWith([
      { x: 2, y: 3, side: 'N', door: true, closed: true },
      { x: 3, y: 3, side: 'N', window: true },
      { x: 4, y: 3, side: 'N' },
    ]);
    s.architecture = [{
      id: 'corps-auberge',
      style: 'taverne',
      storeys: [{ id: 'rez', z: 0, parts: [], roomZoneIds: ['salle'] }],
      facades: [{
        id: 'facade-sud',
        z: 0,
        edges: [
          { x: 2, y: 3, side: 'N' },
          { x: 3, y: 3, side: 'N' },
        ],
        appearance: 'auberge-relais-imperiale',
        roomZoneIds: ['salle', 'vestibule'],
      }],
      masses: [],
    }];
    return s;
  };

  it('enrichit seulement les murs physiques indexés par arête canonique', () => {
    const scene = facadeScene();
    const walls = buildWalls(scene, 'jeu');
    expect(walls).toHaveLength(3);
    expect(walls.slice(0, 2).map((wall) => ({
      appearance: wall.appearance,
      bodyId: wall.bodyId,
      facadeSectionId: wall.facadeSectionId,
      roomZoneIds: wall.roomZoneIds,
    }))).toEqual([
      {
        appearance: 'auberge-relais-imperiale',
        bodyId: 'corps-auberge',
        facadeSectionId: 'facade-sud',
        roomZoneIds: ['salle', 'vestibule'],
      },
      {
        appearance: 'auberge-relais-imperiale',
        bodyId: 'corps-auberge',
        facadeSectionId: 'facade-sud',
        roomZoneIds: ['salle', 'vestibule'],
      },
    ]);
    expect(walls[2].appearance).toBe('plain');
    expect(walls[2].bodyId).toBeUndefined();
    expect(scene.walls).toEqual([
      { x: 2, y: 3, side: 'N', door: true, closed: true },
      { x: 3, y: 3, side: 'N', window: true },
      { x: 4, y: 3, side: 'N' },
    ]);
  });

  it('respecte un override visuel explicite sur une arête de façade', () => {
    const scene = facadeScene();
    scene.walls![0].appearance = 'cloison-basse-a-ossature-en-bois';
    const [wall] = buildWalls(scene, 'jeu');
    const top = Math.max(...facesOf(wall, 'face').flatMap((face) => face.poly.map((point) => point.h)));

    expect(wall.appearance).toBe('cloison-basse-a-ossature-en-bois');
    expect(top).toBe(1.25);
  });

  it('préserve la géométrie des portes et fenêtres existantes', () => {
    const [door, window] = buildWalls(facadeScene(), 'jeu');
    expect(door.door).toBe(true);
    expect(door.states.open).toBe(false);
    expect(parts(door)).toContain('vantail');
    expect(parts(window)).toContain('vitre');
  });

  it('une arête de façade sans WallSeg ne crée aucune collision ni aucun WallEl', () => {
    const scene = facadeScene();
    scene.architecture![0].facades[0].edges.push({ x: 5, y: 3, side: 'N' });
    expect(buildWalls(scene, 'jeu')).toHaveLength(scene.walls!.length);
  });

  it('attache fenêtres, entrée maçonnée et pignon au plan du mur avec ids qualifiés', () => {
    const scene = facadeScene();
    scene.architecture![0].facades[0].features = [
      { id: 'fenetres', kind: 'window-band', edge: { x: 3, y: 3, side: 'N' }, width: 0.7 },
      { id: 'entree', kind: 'stone-entry', edge: { x: 2, y: 3, side: 'N' }, width: 0.8 },
      { id: 'pignon', kind: 'gable', edge: { x: 3, y: 3, side: 'N' }, width: 0.9 },
    ];
    const featureFaces = buildWalls(scene, 'jeu').flatMap((wall) =>
      wall.faces.filter((face) => face.architectureFeatureId));
    expect([...new Set(featureFaces.map((face) => face.architectureFeatureId))]).toEqual([
      'corps-auberge:facade-sud:entree',
      'corps-auberge:facade-sud:fenetres',
      'corps-auberge:facade-sud:pignon',
    ]);
    expect(featureFaces.some((face) => face.architectureFeatureKind === 'window-band' && face.material.part === 'vitre')).toBe(true);
    expect(featureFaces.some((face) => face.architectureFeatureKind === 'stone-entry' && face.material.id === 'mur-en-pierre')).toBe(true);
    expect(featureFaces.some((face) => face.architectureFeatureKind === 'gable' && face.poly.length === 3)).toBe(true);
    expect(buildWalls(scene, 'jeu')[1].faces.filter((face) => face.material.part === 'vitre')).toHaveLength(1);
  });

  /**
   * Les kinds rendus en DÉCOR ANCRÉ (`KINDS_DE_DECOR`) n'ont AUCUNE face dans le plan du mur, et le
   * verrou tient même quand l'auteur pose une `appearance` — champ authorable qui, sans lui, nommait
   * ici une apparence de mur et là un décor, faisant sortir la même feature DEUX fois (#1624).
   */
  it.each(['sign', 'chimney', 'belfry'] as const)('%s : décor ancré, donc AUCUNE face de mur — apparence authorée ou non', (kind) => {
    for (const appearance of [undefined, 'mur-en-bois', 'mur-en-pierre']) {
      const scene = facadeScene();
      scene.architecture![0].facades[0].features = [
        { id: `orn-${kind}`, kind, edge: { x: 2, y: 3, side: 'N' }, width: 0.4, ...(appearance ? { appearance } : {}) },
      ];
      expect(
        buildWalls(scene, 'jeu').flatMap((wall) => wall.faces).filter((face) => face.architectureFeatureId),
        `${kind} / appearance=${appearance ?? '—'}`,
      ).toEqual([]);
    }
  });

  it('la largeur change seulement la portée horizontale, jamais la hauteur', () => {
    // Une largeur = une SCÈNE (le jeu ne mute jamais une scène en place, cf. `state/sceneMemo.ts` et
    // la garde `scene-mutation-guard.test.ts`) : deux authoring distincts, deux dérivations.
    const gableAt = (width: number) => {
      const scene = facadeScene();
      scene.architecture![0].facades[0].features = [{ id: 'pignon', kind: 'gable' as const, edge: { x: 3, y: 3, side: 'N' as const }, width }];
      return buildWalls(scene, 'jeu')[1].faces.find((face) => face.architectureFeatureKind === 'gable')!;
    };
    const narrow = gableAt(0.4);
    const wide = gableAt(1.2);
    const width = (face: typeof narrow) => Math.hypot(
      face.poly[1].x - face.poly[0].x,
      face.poly[1].y - face.poly[0].y,
    );
    const height = (face: typeof narrow) => Math.max(...face.poly.map((point) => point.h)) - Math.min(...face.poly.map((point) => point.h));
    expect(width(wide)).toBeCloseTo(width(narrow) * 3);
    expect(height(wide)).toBe(height(narrow));
  });

  it('préserve porte-de-ville, herse/parapet et brèche sous habillage de façade', () => {
    const scene = facadeScene();
    scene.walls = [{ x: 2, y: 3, side: 'N', structure: 'porte-de-ville' }];
    scene.architecture![0].facades[0].edges = [{ x: 2, y: 3, side: 'N' }];
    scene.architecture![0].facades[0].features = [
      { id: 'pignon', kind: 'gable', edge: { x: 2, y: 3, side: 'N' }, width: 0.8 },
    ];
    const intact = one(scene);
    expect(intact.appearance).toBe('porte-de-ville');
    expect(parts(intact)).toContain('herse-barreau');
    expect(parts(intact)).toContain('parapet');
    const down = one(setStructureDown(scene, 2, 3, 'N', 0, true));
    expect(parts(down)).toContain('seuil');
    expect(parts(down)).not.toContain('herse-barreau');
    expect(down.faces.some((face) => face.architectureFeatureId)).toBe(false);
  });
});

describe('buildWalls — porte BOIS (routée par le seg.door)', () => {
  const el = one(sceneWith([{ x: 2, y: 2, side: 'N', door: true }]));

  it('ouverture BÉANTE + face au-dessus + chambranle + jambages, ouverture 0.52 × WALL_H_M', () => {
    expect(parts(el)).toEqual(['poteau', 'face', 'chambranle', 'couronnement', 'jambage', 'jambage', 'poteau']);
    const op = WALL_H_M * 0.52;
    expect(facesOf(el, 'face')[0].poly[2].h).toBe(op); // la face ne descend que jusqu'à l'ouverture
    for (const j of facesOf(el, 'jambage')) expect(j.poly.map((p) => p.h)).toEqual([op, 0]);
  });

  it('porte sans `closed` = OUVERTE (state open) ; `closed: true` = fermée', () => {
    expect(el.states.open).toBe(true);
    expect(one(sceneWith([{ x: 2, y: 2, side: 'N', door: true, closed: true }])).states.open).toBe(false);
  });
});

/** PORTE SECRÈTE (`EDO 08 l.402`) : la LECTURE est explicite — l'éditeur (`auteur`) dessine la porte
 *  authorée, le jeu (`jeu`) dessine le MUR NU de sa façade tant qu'elle est masquée. */
describe('buildWalls — porte SECRÈTE : lecture auteur / jeu', () => {
  const SECRETE: WallSeg = { x: 2, y: 2, side: 'N', door: true, closed: true, secret: { difficulty: 'complexe', face: 'les-deux' }, structure: 'solide-porte-en-bois' };
  const NU: WallSeg = { x: 2, y: 2, side: 'N' };

  it('auteur : une porte (vantail), même masquée', () => {
    const [el] = buildWalls(sceneWith([SECRETE]), 'auteur');
    expect(el.door).toBe(true);
    expect(parts(el)).toContain('vantail');
  });

  it('jeu, masquée, dans une pièce de murs `mur-en-bois` : même apparence ⇒ MÊMES faces que sa voisine', () => {
    const VOISINE: WallSeg = { x: 1, y: 2, side: 'N', structure: 'mur-en-bois', appearance: 'mur-en-pierre' };
    const DEGUISEE: WallSeg = { x: 2, y: 2, side: 'N', door: true, closed: true, secret: { difficulty: 'complexe', face: 'les-deux' }, structure: 'mur-en-bois', appearance: 'mur-en-pierre' };
    const [voisine, el] = buildWalls(sceneWith([VOISINE, DEGUISEE]), 'jeu');
    const rendu = (w: WallEl) => ({ door: w.door, appearance: w.appearance, faces: w.faces.map((f) => f.material) });
    expect(rendu(el)).toEqual(rendu(voisine));
    expect(el.door).toBe(false);
  });

  it('jeu, masquée : une structure de PORTE est écartée, l’apparence authorée conservée', () => {
    const [el] = buildWalls(sceneWith([{ ...SECRETE, appearance: 'mur-en-bois' }]), 'jeu');
    const [mur] = buildWalls(sceneWith([{ ...NU, appearance: 'mur-en-bois' }]), 'jeu');
    expect(parts(el)).not.toContain('vantail');
    expect(el.faces).toEqual(mur.faces);
  });

  it('jeu, révélée : la porte réapparaît', () => {
    const [el] = buildWalls(setDoorRevealed(sceneWith([SECRETE]), 2, 2, 'N', 0, true), 'jeu');
    expect(el.door).toBe(true);
    expect(parts(el)).toContain('vantail');
  });
});

describe('buildWalls — porte FERMÉE = VANTAIL (se lit comme une porte, pas un trou)', () => {
  it('closed → vantail + 3 planches + poignée à la place de l’ouverture béante', () => {
    const el = one(sceneWith([{ x: 2, y: 2, side: 'N', door: true, closed: true }]));
    const p = parts(el);
    expect(p).toContain('vantail');
    expect(p.filter((x) => x === 'vantail-planche')).toHaveLength(3);
    expect(p).toContain('poignee');
    expect(el.states.open).toBe(false);
    // le vantail remplit l’ouverture (0 → 0.52 × WALL_H_M) entre les jambages.
    const leaf = facesOf(el, 'vantail')[0];
    expect(leaf.poly.map((pt) => pt.h)).toEqual([WALL_H_M * 0.52, WALL_H_M * 0.52, 0, 0]);
  });
  /** #1176 — le monde est VOLUMIQUE : une porte ouverte est un TROU, pas un panneau sombre. AUCUNE face
   *  n'occupe la hauteur d'ouverture ; les joues du mur (DoubleSide) montrent la pièce derrière. */
  it('OUVERTE → aucune face dans l’ouverture : ni vantail, ni panneau de remplissage', () => {
    const el = one(sceneWith([{ x: 2, y: 2, side: 'N', door: true }]));
    const op = WALL_H_M * 0.52;
    expect(parts(el)).not.toContain('vantail');
    // Un quad qui remplirait l'ouverture aurait son bas à 0 et son haut à `op` : il n'y en a aucun.
    expect(el.faces.filter((f) => f.poly.length === 4 && Math.min(...f.poly.map((pt) => pt.h)) === 0 && Math.max(...f.poly.map((pt) => pt.h)) === op)).toEqual([]);
  });
});

describe('buildWalls — mur FENÊTRÉ (vraie OUVERTURE : verre transparent, on voit l’intérieur)', () => {
  const el = one(sceneWith([{ x: 2, y: 2, side: 'N', window: true }]));
  it('cadre de `face` (trumeau + linteau + jambages) + vitre AJOURÉE + croisée (meneau vertical + traverse)', () => {
    const p = parts(el);
    expect(p).toContain('face'); // le mur devient un CADRE de `face` autour du vide vitré (bloque encore la MÉCANIQUE)
    expect(p).toContain('vitre');
    expect(p).not.toContain('croisee-cadre'); // PAS de fond plein derrière la vitre → on voit à travers
    expect(p.filter((x) => x === 'meneau')).toHaveLength(2); // meneau vertical + traverse horizontale (croisée)
    expect(el.states.open).toBe(false); // une fenêtre n’ouvre JAMAIS l’arête
  });
  it('la vitre est un quad dans la moitié HAUTE de la face (0.42 → 0.8 × WALL_H_M)', () => {
    const v = facesOf(el, 'vitre')[0];
    expect(v.poly).toHaveLength(4);
    const hs = v.poly.map((pt) => pt.h);
    expect(Math.min(...hs)).toBeCloseTo(WALL_H_M * 0.42, 6);
    expect(Math.max(...hs)).toBeCloseTo(WALL_H_M * 0.8, 6);
  });
  it('OUVERTURE : la `face` est un CADRE (trumeau + linteau + 2 jambages), PAS le slab plein d’un mur nu', () => {
    const plainFaces = facesOf(one(sceneWith([{ x: 2, y: 2, side: 'N' }])), 'face');
    const winFaces = facesOf(el, 'face');
    expect(plainFaces).toHaveLength(1); // mur nu : UNE face pleine (b→H1, pleine largeur)
    expect(winFaces.length).toBeGreaterThanOrEqual(4); // mur fenêtré : cadre en 4 morceaux → le carreau reste ajouré
    // il existe un TRUMEAU BAS distinct (h max ≤ bas de la fenêtre) : la face ne recouvre pas le carreau.
    const winLoM = WALL_H_M * 0.42;
    expect(winFaces.some((f) => Math.max(...f.poly.map((p) => p.h)) <= winLoM + 1e-6)).toBe(true);
  });
});

describe('buildWalls — fortification de PIERRE (def à parapet)', () => {
  const def = structureAppearance('mur-en-pierre');
  const el = one(sceneWith([{ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' }]));

  it('courtine ferrée + couronne crénelée, tout depuis les champs de la def', () => {
    expect(parts(el)).toEqual([
      'poteau', 'face', 'bande', 'bande', 'bande', // face + 3 ferrures (def.bands)
      'parapet', 'bande', 'arase', 'merlon', 'merlon', 'merlon', // couronne (5 tronçons, pas de 2 → 3 merlons)
      'poteau',
    ]);
  });

  it('hauteurs : parapet = heightLevelFrac × METRES_PER_LEVEL au-dessus du sommet, merlons au-dessus', () => {
    const P = def.parapet!.heightLevelFrac * METRES_PER_LEVEL;
    expect(facesOf(el, 'parapet')[0].poly.map((p) => p.h)).toEqual([WALL_H_M + P, WALL_H_M + P, WALL_H_M, WALL_H_M]);
    const merlon = facesOf(el, 'merlon')[0];
    expect(merlon.poly[0].h).toBeCloseTo(WALL_H_M + P + isoPxToM(def.parapet!.merlonHeightPx), 9);
    // Les poteaux montent jusqu'au sommet du parapet.
    expect(facesOf(el, 'poteau')[0].poly[0].h).toBeCloseTo(WALL_H_M + P, 9);
  });

  it('les merlons tronçonnent l’arête (i/count → (i+1)/count, pas de merlonStep)', () => {
    const xs = facesOf(el, 'merlon').map((m) => [m.poly[0].x, m.poly[1].x]);
    const [A, B] = wallEnds({ x: 2, y: 2, side: 'N' });
    const at = (t: number) => A.x + (B.x - A.x) * t;
    expect(xs).toEqual([[at(0), at(0.2)], [at(0.4), at(0.6)], [at(0.8), at(1)]]);
  });
});

describe('buildWalls — corps de garde (porte-de-ville : ouverture béante + herse)', () => {
  const def = structureAppearance('porte-de-ville');
  const el = one(sceneWith([{ x: 2, y: 2, side: 'N', structure: 'porte-de-ville' }]));

  it('PAS de face pleine ni de poteau : barreaux + traverses + linteau + couronne crénelée', () => {
    expect(facesOf(el, 'face')).toHaveLength(0);
    expect(facesOf(el, 'poteau')).toHaveLength(0);
    expect(facesOf(el, 'herse-barreau')).toHaveLength(def.door!.herse!.bars + 1); // 7 barreaux (0..bars)
    expect(facesOf(el, 'herse-traverse')).toHaveLength(def.door!.herse!.traverseFracs.length);
    expect(facesOf(el, 'linteau')).toHaveLength(1);
    expect(facesOf(el, 'merlon')).toHaveLength(3);
  });

  it('barreaux : tronçons fins clampés à [0,1], du sol au linteau (topFrac × WALL_H_M)', () => {
    const bars = facesOf(el, 'herse-barreau');
    expect(bars[0].poly[0].x).toBe(wallEnds({ x: 2, y: 2, side: 'N' })[0].x); // clampé à t=0
    for (const b of bars) {
      expect(b.poly[0].h).toBeCloseTo(WALL_H_M * def.door!.herse!.topFrac, 9);
      expect(b.poly[2].h).toBe(0);
    }
  });

  it('ABATTU : la herse cède la place à un seuil d’éboulis, linteau et couronne restent', () => {
    let s = sceneWith([{ x: 2, y: 2, side: 'N', structure: 'porte-de-ville' }]);
    s = setStructureDown(s, 2, 2, 'N', 0, true);
    const down = one(s);
    expect(down.states.down).toBe(true);
    expect(parts(down)).toEqual(['seuil', 'linteau', 'parapet', 'bande', 'arase', 'merlon', 'merlon', 'merlon']);
  });
});

describe('buildWalls — BRÈCHE (structure abattue, paramétrisation unique bois+pierre)', () => {
  it('courtine abattue : gravats + tas dentelé + moignons de poteau', () => {
    let s = sceneWith([{ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' }]);
    s = setStructureDown(s, 2, 2, 'N', 0, true);
    const el = one(s);
    expect(el.states.down).toBe(true);
    expect(parts(el)).toEqual(['gravats', 'gravats-tas', 'poteau', 'poteau']);
    const heap = facesOf(el, 'gravats-tas')[0];
    const hr = WALL_H_M * 0.32;
    expect(heap.poly.map((p) => p.h)).toEqual([0, hr, hr * 0.7, 0]); // dentelure A → m1 → m2 → B
    const [a, b] = facesOf(el, 'poteau');
    expect(a.poly[0].h).toBeCloseTo(hr * 0.7, 9); // moignons asymétriques
    expect(b.poly[0].h).toBeCloseTo(hr * 0.55, 9);
  });
});

describe('buildWalls — vérité VISIBLE (une des deux cases bordant l’arête en vue)', () => {
  const seg: WallSeg = { x: 2, y: 2, side: 'N' };
  it.each([
    ['case propre', '2,2,0', true],
    ['case voisine (N → y−1)', '2,1,0', true],
    ['autre case', '3,3,0', false],
  ])('%s', (_lbl, key, vis) => {
    expect(buildWalls(sceneWith([seg]), 'jeu', new Set([key]))[0].states.visible).toBe(vis);
  });
  it('diagonale : seule SA case compte ; set absent ⇒ visible (éditeur/QC)', () => {
    const s = sceneWith([{ x: 2, y: 2, side: '\\' }]);
    expect(buildWalls(s, 'jeu', new Set(['2,2,0']))[0].states.visible).toBe(true);
    expect(buildWalls(s, 'jeu', new Set(['2,1,0']))[0].states.visible).toBe(false);
    expect(buildWalls(s, 'jeu')[0].states.visible).toBe(true);
  });
});

describe('buildWalls — ENVELOPPE extérieure (#818, la façade sort du brouillard)', () => {
  const zone = (id: string, tiles: { x: number; y: number }[], presentation: SceneEffectZone['presentation'] = 'interior'): SceneEffectZone => ({
    id, label: id, area: { kind: 'rect', x: 0, y: 0, w: 0, h: 0 }, presentation, tiles,
  });

  it('case d’en face DEHORS (close par les 4 murs de (2,2), AUCUNE zone déclarée, #881) → mur TOUJOURS visible, même hors fog', () => {
    const s = sceneWith([
      { x: 2, y: 2, side: 'N' }, { x: 2, y: 2, side: 'E' }, { x: 2, y: 3, side: 'N' }, { x: 1, y: 2, side: 'E' },
    ]); // (2,2) scellée sur ses 4 côtés — le reste de la grille communique avec le hors-grille
    expect(buildWalls(s, 'jeu', new Set(['9,9,0']))[0].states.visible).toBe(true);
  });

  it('PIÈGE DONJON — cloison entre DEUX pièces intérieures (jamais « zones différentes ») → gate de fog INCHANGÉ', () => {
    const s = sceneWith([{ x: 2, y: 2, side: 'N' }]);
    s.effectZones = [zone('salle', [{ x: 2, y: 2 }]), zone('couloir', [{ x: 2, y: 1 }])];
    expect(buildWalls(s, 'jeu', new Set(['9,9,0']))[0].states.visible).toBe(false); // aucune case en vue → pas d'enveloppe
    expect(buildWalls(s, 'jeu', new Set(['2,2,0']))[0].states.visible).toBe(true); // le gate normal marche toujours
  });

  it('PIÈGE DONJON — scène SANS AUCUN dehors (toute la carte en zone intérieure) → AUCUN mur n’en sort, brouillard inchangé', () => {
    const s = sceneWith([{ x: 2, y: 2, side: 'N' }, { x: 3, y: 3, side: 'E' }]);
    const allTiles: { x: number; y: number }[] = [];
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) allTiles.push({ x, y });
    s.effectZones = [zone('donjon', allTiles)];
    for (const el of buildWalls(s, 'jeu', new Set(['9,9,0']))) expect(el.states.visible).toBe(false);
  });

  it('case couverte par un TOIT (auvent/cour couverte, sans zone intérieure) → jamais DEHORS, pas d’enveloppe', () => {
    const s = sceneWith([{ x: 2, y: 2, side: 'N' }]); // (2,2) et (2,1) toutes deux sous le même toit
    s.architecture = [{
      id: 'corps', style: 'maison', storeys: [], facades: [],
      masses: [{ id: 'toit', z: 0, footprint: [{ x: 1, y: 0, w: 3, h: 3 }], levels: 1, profile: 'flat', pitchDeg: 30, material: 'tuile' }],
    }];
    expect(buildWalls(s, 'jeu', new Set(['9,9,0']))[0].states.visible).toBe(false);
  });
});

describe('buildWalls — sélection des couches', () => {
  const s = sceneWith([{ x: 1, y: 1, side: 'N' }, { x: 2, y: 2, side: 'N', z: 1 }]);
  it('view absent ⇒ toutes les couches (éditeur/QC/POV)', () => {
    expect(buildWalls(s, 'jeu').map((e) => e.cell.z)).toEqual([0, 1]);
  });
  it('activeZ borne : rien AU-DESSUS de la zone active', () => {
    expect(buildWalls(s, 'jeu', undefined, { activeZ: 0 }).map((e) => e.key)).toEqual(['wall:1,1,N,0']);
    expect(buildWalls(s, 'jeu', undefined, { activeZ: 1 })).toHaveLength(2);
  });
  it('viewZ isole un étage (debug viewLevel)', () => {
    expect(buildWalls(s, 'jeu', undefined, { activeZ: 1, viewZ: 1 }).map((e) => e.key)).toEqual(['wall:2,2,N,1']);
  });
});

describe('buildWalls — stabilité', () => {
  it('deux appels identiques → mêmes clés, mêmes faces', () => {
    const s = sceneWith([{ x: 1, y: 1, side: 'N' }, { x: 3, y: 3, side: '/', door: true }]);
    const a = buildWalls(s, 'jeu');
    const b = buildWalls(s, 'jeu');
    expect(a.map((e) => e.key)).toEqual(b.map((e) => e.key));
    expect(a.map(parts)).toEqual(b.map(parts));
    expect(new Set(a.map((e) => e.key)).size).toBe(a.length);
  });
});

describe('crestEls — crénelure de PÉRIMÈTRE (RENDU PUR, générale, jamais à l’intérieur)', () => {
  // Zone crénelée 2×2 (cells 2,2/3,2/2,3/3,3) à 4 m sur z1, posée PAR L'ASCII via `elevate` (coordonnée-free).
  const empty = '......';
  const spec2x2 = {
    id: 't', label: 't', size: [6, 6] as [number, number],
    legend: { W: 'pierre' as const },
    elevate: { W: { height: 4, parapet: 'mur-en-pierre' } },
    levels: { z0: Array(6).fill(empty).join('\n'), z1: ['......', '......', '..WW..', '..WW..', '......', '......'].join('\n') },
  };
  const crestElsOf = (s: Scene) => buildWalls(s, 'jeu').filter((e) => e.key.startsWith('crest:'));

  it('rect 2×2 crénelé → crête sur les 8 arêtes de CONTOUR, RIEN sur les 4 arêtes internes', () => {
    const els = crestElsOf(buildScene(spec2x2));
    expect(els).toHaveLength(8); // 4 cases d'angle × 2 arêtes extérieures
    // Chaque crête = couronne crénelée SEULE (parapet + merlons), PAS de face pleine (elle n'est pas un mur).
    for (const el of els) {
      const ps = new Set(el.faces.map((f) => f.material.part));
      expect(ps.has('parapet')).toBe(true);
      expect(ps.has('merlon')).toBe(true);
      expect(ps.has('face')).toBe(false); // crête SEULE ; la maçonnerie du mur vient du bloc plein (`floorFaces`)
    }
    // AUCUNE crête sur l'arête INTERNE entre (2,2) et (2,3) (= N de (2,3)) ni entre (2,2)-(3,2) (= E de (2,2)).
    const keys = new Set(els.map((e) => e.key));
    expect(keys.has('crest:2,3,N,1')).toBe(false);
    expect(keys.has('crest:2,2,E,1')).toBe(false);
    // … et la crête existe bien sur le contour (N de (2,2) = arête nord extérieure).
    expect(keys.has('crest:2,2,N,1')).toBe(true);
  });

  it('forme en L (concave) → crête sur les rentrants, toujours jamais à l’intérieur', () => {
    const L = { ...spec2x2, levels: { ...spec2x2.levels, z1: ['......', '......', '..WW..', '..W...', '......', '......'].join('\n') } };
    const els = crestElsOf(buildScene(L)); // cases 2,2 / 3,2 / 2,3 (L)
    // Contour d'un tromino en L = 8 arêtes de périmètre (aucune arête interne n'en fait partie).
    expect(els).toHaveLength(8);
    for (const el of els) expect(el.faces.some((f) => f.material.part === 'merlon')).toBe(true);
  });

  it('la crête est RENDU PUR (aucun `WallSeg` de scène) → ne coupe NI passage NI LdV plongeante', () => {
    const s = buildScene(spec2x2);
    expect(s.walls ?? []).toHaveLength(0); // la crénelure n'ajoute AUCUN mur gameplay (contrairement à une porte)
    expect(crestElsOf(s).length).toBeGreaterThan(0); // mais bien des éléments de RENDU (merlons de contour)
  });
});


/**
 * ENVELOPPE D'ÉTAGE (#892) — depuis l'unification `WALL_H = LEVEL_H` (`geometry/iso.ts`), le sommet
 * d'un mur EST la cote du plancher du dessus : la lèvre décorative du couronnement (`CAP_LIP_PX`,
 * 0,167 m au-dessus du sommet) n'a plus aucun dégagement et PERCE ce plancher. Elle se voit en POV et
 * en iso, où les FACES sont peintes ; pas en vue du dessus, qui ne trace que les arêtes (`topSvg`,
 * `authoring/wallsSvg.ts`). Un mur COIFFÉ par un étage tient donc dans [base, base+WALL_H_M] ; un mur
 * libre (dernier niveau, clôture), ou seulement TRAVERSÉ par un plancher, garde sa lèvre.
 */
describe('buildWalls — un mur COIFFÉ par un étage tient dans son enveloppe', () => {
  /** Deux planchers : z0 plein partout, z1 plein sur la MOITIÉ GAUCHE (x < 3) seulement. La cote d'une
   *  couche vient ENTIÈREMENT de son tableau `height` (`heightAt` ne l'infère pas de `z`) : le plancher
   *  d'étage se pose donc explicitement à `etageM`, par défaut au sommet d'un mur — il y REPOSE. */
  function twoStoreys(walls: WallSeg[], etageM = METRES_PER_LEVEL): Scene {
    const s = emptyScene(6, 6);
    s.walls = walls;
    s.layers.push({
      z: 1,
      tiles: new Array(36).fill('vide').map((t, i) => (i % 6 < 3 ? 'herbe' : t)),
      height: new Array(36).fill(etageM),
    });
    return s;
  }
  const topOf = (el: WallEl) => Math.max(...el.faces.flatMap((f) => f.poly.map((p) => p.h)));

  it('sous un plancher d’étage : sommet = WALL_H_M pile, la bande haute reste, la lèvre non', () => {
    const el = one(twoStoreys([{ x: 1, y: 2, side: 'N' }]));
    expect(topOf(el)).toBe(WALL_H_M);
    expect(parts(el).filter((p) => p === 'couronnement')).toHaveLength(1);
  });

  it('sans étage au-dessus : la lèvre débordante reste (couronnement ×2, sommet au-delà du niveau)', () => {
    const el = one(twoStoreys([{ x: 4, y: 2, side: 'N' }]));
    expect(topOf(el)).toBe(WALL_H_M + isoPxToM(4));
    expect(parts(el).filter((p) => p === 'couronnement')).toHaveLength(2);
  });

  it('une FENÊTRE suit la même enveloppe quand un étage repose sur elle', () => {
    const el = one(twoStoreys([{ x: 1, y: 2, side: 'N', window: true }]));
    expect(topOf(el)).toBe(WALL_H_M);
  });

  it('mur de BORDURE : le hors-grille n’est pas un plancher — la lèvre reste', () => {
    // Hors grille, `tileAt` rend un « mur » implicite et `heightAt` rend 0 : une arête de bord ne doit
    // pas se croire coiffée pour autant. (4,0,'N') donne sur (4,-1), hors carte, et sa propre case est
    // du côté SANS plancher d'étage — rien ne repose sur ce mur, il garde sa lèvre.
    const el = one(twoStoreys([{ x: 4, y: 0, side: 'N' }]));
    expect(topOf(el)).toBe(WALL_H_M + isoPxToM(4));
    expect(parts(el).filter((p) => p === 'couronnement')).toHaveLength(2);
  });

  it('plancher qui coupe le mur À MI-HAUTEUR : il n’y REPOSE pas, la lèvre reste', () => {
    // Plancher d'étage posé à 2 m alors que le mur monte à 4 m : il TRAVERSE le mur au lieu de reposer
    // dessus. C'est le corps du mur qui le perce, pas sa lèvre — la rogner n'y changerait rien.
    const el = one(twoStoreys([{ x: 1, y: 2, side: 'N' }], 2));
    expect(topOf(el)).toBe(WALL_H_M + isoPxToM(4));
    expect(parts(el).filter((p) => p === 'couronnement')).toHaveLength(2);
  });
});

/**
 * JOINT LATÉRAL de deux nappes voisines (#819) : le bord qui court PARALLÈLEMENT au faîtage n'a aucun
 * autre générateur. Comme le pignon de comble, il PROLONGE un mur et en prend la matière — jamais la
 * couverture, jamais un id en dur. Et comme lui, il n'a rien à prolonger quand le bâti n'a aucun mur.
 */
describe('roofSeamGeometry — le joint de deux nappes prend la matière du mur prolongé', () => {
  const mass = (id: string, x: number): BuildingMass => ({
    id, z: 0, footprint: [{ x, y: 3, w: 3, h: 2 }], levels: 1,
    profile: 'gable', ridge: 'y', pitchDeg: 45, material: 'tuile',
  });
  const sceneWith = (walls: WallSeg[]): Scene => {
    const s = emptyScene(16, 16);
    s.walls = walls;
    // L'aile EST repose sur une terrasse de 2 m : son égout est plus haut, les deux nappes ne sont donc
    // PAS coplanaires au joint — c'est exactement le décrochement que ce générateur doit combler.
    s.layers[0].height = new Array(16 * 16).fill(0).map((h, i) => (i % 16 >= 6 ? 2 : h));
    s.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [mass('ouest', 3), mass('est', 6)] }];
    return s;
  };
  const seams = (s: Scene) => buildWalls(s, 'jeu').filter((el) => el.key.startsWith('seam:'));

  it('avec des murs sous le bâti, le joint se ferme à LEUR matière', () => {
    const murs: WallSeg[] = [3, 4, 5, 6, 7, 8].map((x) => ({ x, y: 3, side: 'N' as const, structure: 'mur-a-ossature-en-bois' }));
    const els = seams(sceneWith(murs));
    expect(els.length).toBeGreaterThan(0);
    for (const el of els) {
      expect(el.appearance).toBe('mur-a-ossature-en-bois');
      expect(el.faces[0].material.domain).toBe('structure'); // matière de MUR, jamais de couverture
      expect(el.faces[0].material.id).not.toBe('tuile');
    }
  });

  it('un bâti SANS aucun mur n’a rien à prolonger : aucun joint inventé, pas plus qu’un pignon', () => {
    expect(seams(sceneWith([]))).toHaveLength(0);
  });
});
