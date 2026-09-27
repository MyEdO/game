import { describe, expect, it } from 'vitest';
import { buildScene, type MapSpec } from './mapSpec';
import { heightAt, isDescriptiveZone, tileAt, type Scene, type SceneEffectZone } from './scene';
import { sceneZoneTiles } from './zones';
import { sceneToAscii } from './sceneToAscii';
import { glypheDe, tousLesTerrains } from './terrain';
import { setDataset } from '../data/overrides';
import { diligenceCampaign, paquetDuJeu } from '../scenes/campaign';

/** Scène réelle la plus riche du dépôt (paquet éditeur : 32×38, 2 niveaux). */
const diligenceScene = () => paquetDuJeu(diligenceCampaign).scenes[0];

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
  /** La Diligence est EN AUTHORING : le doré ne PEUT PAS y épingler un compte authoré (nombre
   *  d'ouvertures à matériau distinct, nombre d'avertissements d'export) — il rougirait à chaque coup
   *  de pinceau d'une session d'authoring et bloquerait le tronc. Arbitrage 2026-08-21 (#1447),
   *  verbatim de l'utilisateur : « C'est absurde d'avoir un guard qui bloque totalement la diligence
   *  alors qu'elle n'est même pas finalisé ».
   *  RÉ-ENTRÉE : ré-étalonner à la FINALISATION de la carte — recopier les comptes REÇUS (portes et
   *  fenêtres divergentes, avertissements) et dire dans le commit ce qui les a déplacés. Ce qui NE
   *  dépend d'aucun compte authoré — identité des surfaces, identité des murs modulo le matériau
   *  d'ouverture que l'export déclare perdu — reste verrouillé ci-dessous. */
  it('La Diligence (EN AUTHORING) : tout revient à l’identique SAUF ce que l’export déclare perdu', () => {
    const original = diligenceScene();
    expect(original.walls?.length ?? 0).toBeGreaterThan(0);
    const exp = sceneToAscii(original);
    const rebuilt = buildScene(reimport('la-diligence-rt', [original.dimensions.w, original.dimensions.h], exp));
    expectSurfacesEqual(original, rebuilt);

    // Le grillage `walled` n'a qu'UN glyphe par ouverture : l'export déclare les overlays de porte
    // et de fenêtre qu'il ne peut pas représenter.
    const before = normWalls(original);
    const after = normWalls(rebuilt);
    const sansOverlayPerdu = (w: ReturnType<typeof normWalls>[number]) => (w.door || w.window ? { ...w, structure: null, appearance: null } : w);
    expect(after.map(sansOverlayPerdu)).toEqual(before.map(sansOverlayPerdu));
    const divergents = before.filter((w, i) => w.structure !== after[i].structure || w.appearance !== after[i].appearance);
    expect(divergents.every((w) => w.door || w.window)).toBe(true);
    for (const w of divergents)
      expect(exp.warnings.join(' | ')).toMatch(
        w.door ? /porte\(s\) avec un matériau\/une apparence distincts de « structure=solide-porte-en-bois »/ : /fenêtre\(s\) avec un matériau\/une apparence distincts de « structure=mur-a-ossature-en-bois »/,
      );
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

describe('sceneToAscii — honnêteté de la portée (#énoncé)', () => {
  it('liste `cells.stair` en tête de `notRestored` (une recette de volée ne se ré-authore pas depuis l’ASCII)', () => {
    const exp = sceneToAscii(diligenceScene());
    expect(exp.notRestored[0]).toMatch(/cells\.stair/);
    expect(exp.notRestored[0]).toMatch(/relief/);
  });

  it('le texte exporté PORTE explicitement la liste de ce qui n’est pas restitué', () => {
    const exp = sceneToAscii(diligenceScene());
    for (const n of exp.notRestored) expect(exp.text).toContain(n);
  });

  it('les hauteurs d’une RAMPE peinte survivent via `relief`', () => {
    const original = diligenceScene();
    const exp = sceneToAscii(original);
    // La carte étant EN AUTHORING (#1447), la sonde se DÉRIVE de l'export au lieu d'épingler la case
    // d'une marche : toute case de relief réémise porte la hauteur de la scène d'origine.
    const cellules = exp.relief.filter((r) => r.cell);
    expect(cellules.length).toBeGreaterThan(0);
    for (const r of cellules)
      expect(r.height, `relief cell ${r.cell![0]},${r.cell![1]} z${r.z ?? 0}`).toBe(
        heightAt(original, r.cell![0], r.cell![1], r.z ?? 0),
      );
  });
});
