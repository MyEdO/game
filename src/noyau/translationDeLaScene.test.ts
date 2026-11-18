import { describe, expect, it } from 'vitest';
import { coDescendre, defDe, descendre, enfantsDe, ouverts } from '../data/schemas/grammaire/descente';
import { sceneSchema } from '../data/schemas/defs-scenes/scene';
import { emptyScene, tileAt, type Scene } from './monde/scene';
import { resizeGrid } from './sceneEdit';
import { HORS_GRILLE, POSITIONS_DE_CASE, translaterLaScene } from './translationDeLaScene';

/** Le nœud porte-t-il un nombre, sous ses enveloppes transparentes ? */
const estNombre = (n: unknown): boolean => ouverts([n]).some((o) => defDe(o)?.type === 'number');

/** Chaque nœud objet du schéma de scène qui porte une paire de coordonnées numériques (`x`/`y`, `cx`/`cy`). */
function noeudsAPaire(): Map<unknown, string> {
  const out = new Map<unknown, string>();
  descendre([sceneSchema], (v) => {
    const cles = new Map(enfantsDe(v.noeud).filter((e) => e.cle !== undefined).map((e) => [e.cle, e.noeud]));
    if ([['x', 'y'], ['cx', 'cy']].some(([a, b]) => estNombre(cles.get(a)) && estNombre(cles.get(b)))) out.set(v.noeud, v.path);
  });
  return out;
}

/** Une scène qui porte une instance de chaque chemin positionné du schéma de scène. */
const TOUT_POSITIONNE: Scene = {
  ...emptyScene('tout-positionne', 12, 10),
  zoneJouable: { x: 1, y: 1, w: 8, h: 7 },
  walls: [{ x: 2, y: 3, side: 'N' }],
  entryPoints: { porte: { x: 1, y: 2, z: 1 } },
  restZones: [{ rect: { x: 2, y: 2, w: 2, h: 2 }, places: { camp: true } }],
  effectZones: [
    { id: 'rect', label: 'Rect', area: { kind: 'rect', x: 3, y: 3, w: 3, h: 2 }, tiles: [{ x: 3, y: 3 }, { x: 4, y: 3 }] },
    { id: 'disc', label: 'Disque', area: { kind: 'disc', cx: 6, cy: 6, radius: 2 } },
  ],
  entities: [
    { id: 'depart', kind: 'heroStart', pos: { x: 1, y: 1 } },
    { id: 'pnj', kind: 'personnage', vehicule: { id: 'caraque' }, pos: { x: 4, y: 5 }, postes: [{ trappingId: 'canon', anchor: { x: 5, y: 5 } }] },
    { id: 'tonneau', kind: 'prop', pos: { x: 6, y: 2 }, calage: { x: 0.5, y: -0.5 } },
  ],
  stations: [{ sceneId: 'bataille', pos: { x: 7, y: 7 } }],
  triggers: [{
    id: 'piege',
    rect: { x: 2, y: 6, w: 1, h: 1 },
    flow: { kind: 'sequence', etapes: [
      { kind: 'effet', effet: { type: 'setDoor', x: 2, y: 3, side: 'N', open: true } },
      { kind: 'effet', effet: { type: 'moveEntity', id: 'pnj', to: { x: 8, y: 8 } } },
      { kind: 'effet', effet: { type: 'fall', target: 'party', metres: 3, to: { x: 5, y: 1 } } },
      { kind: 'effet', effet: { type: 'zoneBlast', center: { x: 4, y: 4 }, radius: 1, ops: [] } },
    ] },
  }],
  encounters: [
    { id: 'siege', members: [], victoryCondition: { type: 'destroyStructure', edge: { x: 3, y: 1, side: 'E' } } },
    { id: 'course', members: [], victoryCondition: { type: 'reachZone', rect: { x: 8, y: 2, w: 2, h: 2 } } },
  ],
  architecture: [{
    id: 'maison',
    storeys: [{ id: 'rdc', z: 0, parts: [{ id: 'corps', foot: { x: 2, y: 2, w: 3, h: 3 } }], roomZoneIds: [] }],
    facades: [{ id: 'f', z: 0, edges: [{ x: 2, y: 2, side: 'N' }], appearance: 'pierre', features: [{ id: 'enseigne', kind: 'sign', edge: { x: 3, y: 2, side: 'N' }, offset: 0.25, width: 0.5 }] }],
    masses: [{ id: 'toit', z: 0, footprint: [{ x: 2, y: 2, w: 3, h: 3 }], levels: 1, profile: 'flat', pitchDeg: 0, material: { id: 'ardoise' } }],
    roofExclusions: [{ z: 0, rect: { x: 3, y: 3, w: 1, h: 1 } }],
  }],
} as Scene;

/** Chaque nombre de `v`, par son chemin. */
function nombres(v: unknown, chemin = '', out = new Map<string, number>()): Map<string, number> {
  if (typeof v === 'number') out.set(chemin, v);
  else if (v && typeof v === 'object') for (const [k, e] of Object.entries(v)) nombres(e, `${chemin}.${k}`, out);
  return out;
}

/** Les chemins de nombre que la translation doit décaler, abscisse puis ordonnée. */
const DECALES: readonly (readonly [string, string])[] = [
  ['.zoneJouable.x', '.zoneJouable.y'],
  ['.walls.0.x', '.walls.0.y'],
  ['.entryPoints.porte.x', '.entryPoints.porte.y'],
  ['.restZones.0.rect.x', '.restZones.0.rect.y'],
  ['.effectZones.0.area.x', '.effectZones.0.area.y'],
  ['.effectZones.0.tiles.0.x', '.effectZones.0.tiles.0.y'],
  ['.effectZones.0.tiles.1.x', '.effectZones.0.tiles.1.y'],
  ['.effectZones.1.area.cx', '.effectZones.1.area.cy'],
  ['.entities.0.pos.x', '.entities.0.pos.y'],
  ['.entities.1.pos.x', '.entities.1.pos.y'],
  ['.entities.1.postes.0.anchor.x', '.entities.1.postes.0.anchor.y'],
  ['.entities.2.pos.x', '.entities.2.pos.y'],
  ['.stations.0.pos.x', '.stations.0.pos.y'],
  ['.triggers.0.rect.x', '.triggers.0.rect.y'],
  ['.triggers.0.flow.etapes.0.effet.x', '.triggers.0.flow.etapes.0.effet.y'],
  ['.triggers.0.flow.etapes.1.effet.to.x', '.triggers.0.flow.etapes.1.effet.to.y'],
  ['.triggers.0.flow.etapes.2.effet.to.x', '.triggers.0.flow.etapes.2.effet.to.y'],
  ['.triggers.0.flow.etapes.3.effet.center.x', '.triggers.0.flow.etapes.3.effet.center.y'],
  ['.encounters.0.victoryCondition.edge.x', '.encounters.0.victoryCondition.edge.y'],
  ['.encounters.1.victoryCondition.rect.x', '.encounters.1.victoryCondition.rect.y'],
  ['.architecture.0.storeys.0.parts.0.foot.x', '.architecture.0.storeys.0.parts.0.foot.y'],
  ['.architecture.0.facades.0.edges.0.x', '.architecture.0.facades.0.edges.0.y'],
  ['.architecture.0.facades.0.features.0.edge.x', '.architecture.0.facades.0.features.0.edge.y'],
  ['.architecture.0.masses.0.footprint.0.x', '.architecture.0.masses.0.footprint.0.y'],
  ['.architecture.0.roofExclusions.0.rect.x', '.architecture.0.roofExclusions.0.rect.y'],
];

describe('la translation de la scène suit tout ce que le schéma positionne (#4392)', () => {
  it('chaque nœud du schéma de scène à paire de coordonnées est déclaré case de la grille ou hors grille, une fois, et chaque déclaré est atteint', () => {
    const aPaire = noeudsAPaire();
    const nonDeclares = [...aPaire].filter(([n]) => !POSITIONS_DE_CASE.has(n) && !HORS_GRILLE.has(n)).map(([, path]) => path);
    expect(nonDeclares, 'un nœud à paire de coordonnées se déclare dans POSITIONS_DE_CASE ou HORS_GRILLE').toEqual([]);
    expect([...POSITIONS_DE_CASE.keys()].filter((n) => HORS_GRILLE.has(n))).toEqual([]);
    expect([...POSITIONS_DE_CASE.keys(), ...HORS_GRILLE.keys()].filter((n) => !aPaire.has(n)), 'déclaré mais hors du schéma de scène').toEqual([]);
  });

  it('la scène témoin porte chaque position de case déclarée', () => {
    const atteints = new Set<unknown>();
    coDescendre(sceneSchema, TOUT_POSITIONNE, (p) => p.noeuds.forEach((n) => POSITIONS_DE_CASE.has(n) && atteints.add(n)));
    expect(atteints.size).toBe(POSITIONS_DE_CASE.size);
  });

  it('décalée de (3, 2), chaque position bouge d’autant et rien d’autre ; décalée en retour, elle redevient l’originale', () => {
    const avant = nombres(TOUT_POSITIONNE);
    const apres = nombres(translaterLaScene(TOUT_POSITIONNE, 3, 2));
    const attendu = new Map(avant);
    for (const [x, y] of DECALES) {
      attendu.set(x, avant.get(x)! + 3);
      attendu.set(y, avant.get(y)! + 2);
    }
    expect(apres).toEqual(attendu);
    expect(translaterLaScene(translaterLaScene(TOUT_POSITIONNE, 3, 2), -3, -2)).toEqual(TOUT_POSITIONNE);
  });
});

describe('resizeGrid à décalage d’origine (#4392)', () => {
  const base: Scene = { ...emptyScene('g', 5, 5), zoneJouable: { x: 0, y: 0, w: 3, h: 3 } };
  const marquee = { ...base, layers: [{ ...base.layers![0], tiles: base.layers![0].tiles.map((t, i) => (i === 0 ? 'eau' : t)) }] } as Scene;

  it('agrandie à l’ouest et au nord, l’ancienne case (x, y) va en (x+dx, y+dy) avec ce qui la positionne', () => {
    const grande = resizeGrid(marquee, 7, 6, { x: 2, y: 1 });
    expect([grande.dimensions, tileAt(grande, 2, 1, 0), grande.zoneJouable]).toEqual([{ w: 7, h: 6 }, tileAt(marquee, 0, 0, 0), { x: 2, y: 1, w: 3, h: 3 }]);
  });

  it('réduite par l’ouest, la zone jouable est rognée à la grille, retirée si rien n’en reste', () => {
    expect(resizeGrid(base, 4, 5, { x: -1, y: 0 }).zoneJouable).toEqual({ x: 0, y: 0, w: 2, h: 3 });
    expect(resizeGrid(base, 5, 5, { x: -3, y: 0 }).zoneJouable).toBeUndefined();
  });
});
