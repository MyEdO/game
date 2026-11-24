import { describe, expect, it } from 'vitest';
import { buildScene, type MapSpec } from '../mapSpec';
import { heightAt, isDescriptiveZone, tileAt, type Scene, type SceneEffectZone } from './scene';
import { sceneZoneTiles } from './zones';
import { planDeLaCouche, sceneToAscii } from './sceneToAscii';
import { glypheDe, tousLesTerrains } from './terrain';
import { setDataset } from '../../data/overrides';
import { relaisAEtage, VOLEES_DU_RELAIS } from '../../scenes/fixtures/plans.testkit';
import { buildOperaFloorplan } from '../../scenes/opera/floorplan';
import { GLYPHES_RESERVES } from '../../data/schemas/grammaire/carte-ascii';

/** Reconstruit un `MapSpec` MINIMAL depuis un export (walled/legend/terrain/wallLegend/zoneMap/
 *  zoneLegend/relief SEULEMENT) — exactement ce que l'énoncé demande de « coller » dans un fichier source : aucune
 *  autre section du `MapSpec` d'origine (bind/cells/entities/architecture/…) n'est reportée. */
function reimport(id: string, size: [number, number], exp: ReturnType<typeof sceneToAscii>): MapSpec {
  return {
    id,
    label: id,
    size,
    walled: exp.walled,
    legend: exp.legend,
    terrain: exp.terrain,
    wallLegend: exp.wallLegend,
    ...(Object.keys(exp.zoneMap).length ? { zoneMap: exp.zoneMap, zoneLegend: exp.zoneLegend } : {}),
    ...(exp.relief.length ? { relief: exp.relief } : {}),
  };
}

function normWalls(scene: Scene) {
  return (scene.walls ?? [])
    .map((w) => ({ x: w.x, y: w.y, side: w.side, z: w.z ?? 0, door: !!w.door, window: !!w.window, structure: w.structure ?? null, appearance: w.appearance ?? null }))
    .sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y || a.side.localeCompare(b.side));
}

function normZones(scene: Scene) {
  return (scene.effectZones ?? [])
    .filter(isDescriptiveZone)
    .map((z: SceneEffectZone) => ({
      id: z.id,
      label: z.label,
      presentation: z.presentation ?? null,
      z: z.z ?? 0,
      tiles: sceneZoneTiles(z)
        .map((t) => ({ x: t.x, y: t.y, z: t.z ?? 0 }))
        .sort((a, b) => a.y - b.y || a.x - b.x),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Vérité des SURFACES : tuiles, hauteurs, zones descriptives — case par case (`tileAt`/`heightAt`,
 *  robuste aux longueurs/sparsité des tableaux bruts). */
function expectSurfacesEqual(original: Scene, rebuilt: Scene) {
  const { w, h } = original.dimensions;
  const zs = [...new Set(original.layers.map((l) => l.z))].sort((a, b) => a - b);
  expect(new Set(rebuilt.layers.map((l) => l.z))).toEqual(new Set(zs));
  for (const z of zs)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        expect(tileAt(rebuilt, x, y, z), `tileAt(${x},${y},z${z})`).toBe(tileAt(original, x, y, z));
        expect(heightAt(rebuilt, x, y, z), `heightAt(${x},${y},z${z})`).toBe(heightAt(original, x, y, z));
      }
  expect(normZones(rebuilt)).toEqual(normZones(original));
}

/** Vérité GÉOMÉTRIQUE round-trip (#énoncé) : surfaces + murs/portes/fenêtres à l'identique. */
function expectGeometryEqual(original: Scene, rebuilt: Scene) {
  expectSurfacesEqual(original, rebuilt);
  expect(normWalls(rebuilt)).toEqual(normWalls(original));
}

describe('sceneToAscii — round-trip doré (buildScene → export → réimport → buildScene)', () => {
  it('le relais à étage : tout revient à l’identique SAUF le matériau de porte que l’export déclare perdu', () => {
    const original = relaisAEtage();
    const exp = sceneToAscii(original);
    const rebuilt = buildScene(reimport('relais-rt', [original.dimensions.w, original.dimensions.h], exp));
    expectSurfacesEqual(original, rebuilt);

    // Le grillage `walled` n'a qu'UN glyphe par ouverture : la porte de la remise, d'un matériau distinct
    // des autres portes, perd le sien, et l'export le déclare.
    const before = normWalls(original);
    const after = normWalls(rebuilt);
    const sansOverlayPerdu = (w: ReturnType<typeof normWalls>[number]) => (w.door || w.window ? { ...w, structure: null, appearance: null } : w);
    expect(after.map(sansOverlayPerdu)).toEqual(before.map(sansOverlayPerdu));
    const divergents = before.filter((w, i) => w.structure !== after[i].structure || w.appearance !== after[i].appearance);
    expect(divergents.map((w) => [w.x, w.y, w.side, w.z, w.door, w.structure])).toEqual([[21, 4, 'N', 0, true, 'porte']]);
    expect(exp.warnings.join(' | ')).toMatch(/1 porte\(s\) avec un matériau\/une apparence distincts de « structure=solide-porte-en-bois »/);
  });

  it('un plan simple (1 étage, portes/fenêtres/matériau/diagonale/rampe/zones) : géométrie identique', () => {
    const spec: MapSpec = {
      id: 'simple',
      label: 'Simple',
      size: [6, 5],
      terrain: 'herbe',
      legend: { P: 'plancher' },
      walled: {
        z0: String.raw`
+ + + + + + +
 P P P P . .
+-+-+:+-+ + +
 P P P P . .
+=+o+-+\+ + +
 P P P P . .
+ + + + + + +
 . . . . . .
+ + + + + + +
 . . . . . .
+ + + + + + +
`,
      },
      wallLegend: { '=': { structure: 'mur-en-pierre' } },
      relief: [
        { rect: [0, 0, 3, 2], height: 2, z: 0 },
        { ramp: [3, 0, 5, 0], from: 2, to: 0, z: 0 },
      ],
      zoneMap: {
        z0: [
          'AAAA..',
          'AAAA..',
          '......',
          '..BBBB',
          '......',
        ],
      },
      zoneLegend: {
        A: { label: 'Salle Ouest', presentation: 'interior' },
        B: { label: 'Cour Est', presentation: 'exterior' },
      },
    };
    const original = buildScene(spec);
    const exp = sceneToAscii(original);
    const rebuilt = buildScene(reimport('simple-rt', [6, 5], exp));
    expectGeometryEqual(original, rebuilt);
  });

  it('un OVERLAY d’arête survit dans ses TROIS formes : structure seule, apparence seule, les deux', () => {
    // 4 cases en ligne ; arête E de (0,0) = structure seule, de (1,0) = apparence seule, de (2,0) = les deux.
    const spec: MapSpec = {
      id: 'overlay',
      label: 'Overlay',
      size: [4, 1],
      terrain: 'plancher',
      walled: { z0: ['+ + + + +', '|.=.w.H.|', '+ + + + +'].join('\n') },
      wallLegend: {
        '=': { structure: 'mur-en-pierre' },
        w: { appearance: 'mur-en-bois' },
        H: { structure: 'herse', appearance: 'herse' },
      },
    };
    const original = buildScene(spec);
    // Sonde AVANT : les trois arêtes portent bien les trois formes d'overlay.
    expect(normWalls(original).filter((s) => s.side === 'E' && s.x >= 0)).toEqual([
      { x: 0, y: 0, side: 'E', z: 0, door: false, window: false, structure: 'mur-en-pierre', appearance: null },
      { x: 1, y: 0, side: 'E', z: 0, door: false, window: false, structure: null, appearance: 'mur-en-bois' },
      { x: 2, y: 0, side: 'E', z: 0, door: false, window: false, structure: 'herse', appearance: 'herse' },
      { x: 3, y: 0, side: 'E', z: 0, door: false, window: false, structure: null, appearance: null }, // bord droit, mur NU
    ]);
    const exp = sceneToAscii(original);
    // Une catégorie = un char : la table réémise porte ces trois overlays, et RIEN d'autre (le mur nu
    // du bord droit n'a pas d'overlay : il ne prend pas de char de légende).
    const cle = (o: { structure?: string; appearance?: string }) => `${o.structure ?? ''}/${o.appearance ?? ''}`;
    expect(Object.values(exp.wallLegend).sort((a, b) => (cle(a) < cle(b) ? -1 : 1))).toEqual([
      { appearance: 'mur-en-bois' },
      { structure: 'herse', appearance: 'herse' },
      { structure: 'mur-en-pierre' },
    ]);
    expect(exp.text).toContain('export const WALL_LEGEND');
    const rebuilt = buildScene(reimport('overlay-rt', [4, 1], exp));
    expectGeometryEqual(original, rebuilt);
  });

  it('une DIAGONALE porteuse d’apparence est NOMMÉE perdue (warning) et l’est vraiment au réimport', () => {
    const spec: MapSpec = {
      id: 'diag',
      label: 'Diag',
      size: [2, 2],
      terrain: 'plancher',
      walled: { z0: ['+-+ +', '|. . ', '+ + +', ' . . ', '+ + +'].join('\n') },
      walls: [{ x: 0, y: 0, side: '\\', appearance: 'mur-en-bois' }],
    };
    const exp = sceneToAscii(buildScene(spec));
    expect(exp.warnings.join(' | ')).toContain('cloison diagonale (0,0,z0) : appearance=mur-en-bois');
    // L'avertissement ne crie pas au loup : au réimport la cloison est bien là, mais NUE — c'est son
    // `appearance` qui est réellement perdue.
    const rebuilt = buildScene(reimport('diag-rt', [2, 2], exp));
    expect((rebuilt.walls ?? []).filter((w) => w.side === '\\' || w.side === '/')).toEqual([{ x: 0, y: 0, side: '\\' }]);
  });
});

describe('sceneToAscii — les glyphes DÉCLARÉS au dataset sont RÉSERVÉS (#1789)', () => {
  /** Une couche à trois terrains : la base, un terrain à glyphe DÉCLARÉ (`terrains.json › ascii`) et
   *  un terrain SANS glyphe, qui doit donc être servi par l'allocateur. */
  const planTroisTerrains = (declare: string, sans: string): Scene =>
    buildScene({
      id: 'glyphes',
      label: 'Glyphes',
      size: [3, 1],
      terrain: 'herbe',
      legend: { X: declare, Y: sans },
      walled: { z0: ['+ + + +', ' . X Y ', '+ + + +'].join('\n') },
    });

  it('un terrain à glyphe DÉCLARÉ sort sous SON glyphe, et la `legend` exportée le porte quand même', () => {
    const declare = tousLesTerrains().find((t) => typeof t.ascii === 'string');
    expect(declare, 'aucun terrain ne déclare de glyphe : la sonde mesurerait le néant.').toBeDefined();
    const sans = tousLesTerrains().find((t) => t.ascii === undefined && t.id !== 'herbe' && t.id !== declare!.id)!;
    const exp = sceneToAscii(planTroisTerrains(declare!.id, sans.id));
    expect(exp.legend[declare!.ascii!], `le glyphe déclaré « ${declare!.ascii} » ne désigne pas « ${declare!.id} »`).toBe(declare!.id);
    expect(exp.walled.z0, 'la grille n’écrit pas le terrain sous son glyphe déclaré').toContain(declare!.ascii!);
    // Le round-trip ne dépend d'aucune donnée chez le relecteur : la légende exportée est COMPLÈTE.
    const rebuilt = buildScene(reimport('glyphes-rt', [3, 1], exp));
    expectGeometryEqual(planTroisTerrains(declare!.id, sans.id), rebuilt);
  });

  it('un terrain SANS glyphe n’obtient JAMAIS un glyphe déclaré par un autre (le pool le retire)', () => {
    // Le glyphe déclaré est posé À L'ATELIER sur un char que l'allocateur servirait TÔT (`b`, second
    // de l'alphabet) : sans réservation, le premier terrain sans glyphe le raflerait. Les glyphes
    // committés (`#`/`~`/`_`/`=`) ne sont pas dans l'alphabet d'allocation — ils ne prouveraient rien.
    const avant = tousLesTerrains().map((t) => ({ ...t }));
    const hote = avant.find((t) => typeof t.ascii === 'string')!;
    const sansGlyphe = avant.filter((t) => t.ascii === undefined && t.id !== 'herbe').slice(0, 3);
    expect(sansGlyphe.length, 'moins de trois terrains sans glyphe : l’allocateur n’est pas exercé.').toBe(3);
    try {
      setDataset('terrains', avant.map((t) => (t.id === hote.id ? { ...t, ascii: 'b' } : t)) as never);
      const exp = sceneToAscii(
        buildScene({
          id: 'pool',
          label: 'Pool',
          size: [4, 1],
          terrain: 'herbe',
          legend: { X: sansGlyphe[0].id, Y: sansGlyphe[1].id, Z: sansGlyphe[2].id },
          walled: { z0: ['+ + + + +', ' . X Y Z ', '+ + + + +'].join('\n') },
        }),
      );
      expect(exp.legend.b, `le glyphe déclaré « b » a été alloué à « ${exp.legend.b} »`).toBeUndefined();
      for (const t of sansGlyphe) expect(glypheDe(t.id), `${t.id} a reçu un glyphe`).toBeUndefined();
      expect(Object.values(exp.legend).sort()).toEqual(sansGlyphe.map((t) => t.id).sort());
    } finally {
      setDataset('terrains', avant as never);
    }
  });
});

/** Les trois légendes de l'export — cases, arêtes, zones — sur la scène la plus riche du dépôt (l'Opéra : deux couches,
 *  murs à apparence, relief). */
describe('sceneToAscii — les trois légendes sont disjointes (#1789)', () => {
  it('aucun char n’est partagé entre la légende de CASES, celle d’ARÊTES et celle de ZONES', () => {
    const ex = sceneToAscii(buildOperaFloorplan());
    const espaces = { cases: Object.keys(ex.legend), arêtes: Object.keys(ex.wallLegend), zones: Object.keys(ex.zoneLegend) };
    // `-`/`|` sont les mots NUS de la grammaire : l'export les pose en légende d'arêtes quand toutes
    // les cloisons portent une apparence — ils ne sortent d'aucun allocateur et ne collisionnent rien.
    const alloues = (chars: string[]) => chars.filter((c) => !GLYPHES_RESERVES.has(c));
    for (const [a, b] of [['cases', 'arêtes'], ['cases', 'zones'], ['arêtes', 'zones']] as const) {
      const communs = alloues(espaces[a]).filter((c) => alloues(espaces[b]).includes(c));
      expect(communs, `chars servis À LA FOIS en légende ${a} et en légende ${b} : ${communs.join(', ')}`).toEqual([]);
    }
  });
});

describe('sceneToAscii — honnêteté de la portée (#énoncé)', () => {
  it('liste `cells.stair` en tête de `notRestored` (une recette de volée ne se ré-authore pas depuis l’ASCII)', () => {
    const exp = sceneToAscii(relaisAEtage());
    expect(exp.notRestored[0]).toMatch(/cells\.stair/);
    expect(exp.notRestored[0]).toMatch(/relief/);
  });

  it('le texte exporté PORTE explicitement la liste de ce qui n’est pas restitué', () => {
    const exp = sceneToAscii(relaisAEtage());
    for (const n of exp.notRestored) expect(exp.text).toContain(n);
  });

  it('les hauteurs d’une RAMPE peinte survivent via `relief`', () => {
    const original = relaisAEtage();
    const exp = sceneToAscii(original);
    const cellules = exp.relief.filter((r) => r.cell);
    const marches = VOLEES_DU_RELAIS.flatMap(({ bas, haut }) => Array.from({ length: bas.y - haut.y + 1 }, (_, i) => `${bas.x},${haut.y + i},0`));
    expect(cellules.map((r) => `${r.cell![0]},${r.cell![1]},${r.z ?? 0}`)).toEqual(expect.arrayContaining(marches));
    for (const r of cellules)
      expect(r.height, `relief cell ${r.cell![0]},${r.cell![1]} z${r.z ?? 0}`).toBe(
        heightAt(original, r.cell![0], r.cell![1], r.z ?? 0),
      );
  });
});

describe('clés d’arête hors ASCII', () => {
  it('une allège de 0 m est une donnée : l’export la déclare perdue, comme la croisée qui la porte', () => {
    const scene = buildScene({ id: 'allege', label: 'allege', size: [3, 3], walls: [{ x: 1, y: 1, side: 'E', window: true, crossable: true, allege: 0 }] });
    const avertissements = sceneToAscii(scene).warnings.join(' | ');
    expect(avertissements).toContain('1 croisée(s) franchissable(s) (`WallSeg.crossable`)');
    expect(avertissements).toContain('1 hauteur(s) d’allège de croisée (`WallSeg.allege`)');
  });
});

/** Le plan d'une couche (#3686) : la grille de l'export, chaque marque sur sa case, la plus forte l'emportant, puis la
 *  légende de ce que ses cases montrent. */
describe('planDeLaCouche — la couche, ses marques et sa légende', () => {
  const scene = buildScene({ id: 'plan', label: 'plan', size: [4, 2], walled: { z0: String.raw`
+-+-+-+-+
|. . .|.|
+ + +-+:+
|. . . .|
+-+-+-+-+
` } });
  scene.entities = [
    { id: 'table', kind: 'prop', pos: { x: 1, y: 0 }, decor: { id: 'table' } },
    { id: 'coffre', kind: 'prop', pos: { x: 0, y: 1 }, decor: { id: 'coffre' } },
    { id: 'marin', kind: 'personnage', pos: { x: 0, y: 0 }, creature: { id: 'humain' } },
    { id: 'vigie', kind: 'personnage', pos: { x: 3, y: 0 }, creature: { id: 'humain' } },
  ];

  const jeu = { scene, battle: null, meneurChoisi: null, partyPos: { x: 0, y: 1 }, gameTime: 12 * 60, lightLevel: null, explored: {} };

  it('l’œil, le groupe, les personnages en vue et les décors ; un héros sur un décor le cache', () => {
    expect(planDeLaCouche(jeu, 0, { x: 2, y: 1, z: 0, azimut: 100 })).toBe([
      '+-+-+-+-+',
      '|& % .|.|',
      '+ + +-+:+',
      '|@ . → .|',
      '+-+-+-+-+',
      '',
      `. ${sceneToAscii(scene).terrain}`,
      '% un décor',
      '& un personnage',
      '@ un héros',
      '→ l’œil, regard au E',
    ].join('\n'));
  });

  it('l’œil d’une autre couche ne se marque pas', () => {
    expect(planDeLaCouche(jeu, 0, { x: 2, y: 1, z: 1, azimut: 100 })).not.toContain('→');
  });
});
