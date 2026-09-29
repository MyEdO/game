import { describe, it, expect } from 'vitest';
import { buildScene } from './mapSpec';
import { scenario as zonesPiecesScenario } from '../scenes/test-scenarios/zones-pieces';
import { reachableCells, unreachableDescriptiveZones, reachedFloors } from './mapQC';
import { walkNeighbors, type Pt } from './path';
import { departDuGroupe, type Scene } from './scene';
import { campaign, diligenceCampaign } from '../scenes/campaign';

describe('mapQC — harnais QC de cartes (#778)', () => {
  it('démo `zones-pieces` (4 pièces cloisonnées) : les 4 pièces sont toutes atteignables depuis heroStart', () => {
    const scene = zonesPiecesScenario.scene;
    const start = departDuGroupe(scene)?.pos;
    expect(start).toBeDefined();
    expect(unreachableDescriptiveZones(scene, start!)).toEqual([]);
  });

  it('deux étages reliés par une volée `cells.stair` (#780) : connexité verticale + pièces nommées atteignables', () => {
    // Reprend la géométrie éprouvée de mapSpec.test.ts (#780) : foyer z0 → volée `E` → galerie z1.
    const scene = buildScene({
      id: 's-2f', label: 'Deux étages', size: [4, 3], terrain: 'mur',
      levels: { z0: ['....', 'FEEE', '....'].join('\n'), z1: ['...G', '....', '....'].join('\n') },
      legend: { F: 'pave', G: 'pierre' },
      elevate: { F: 1, G: 4 },
      cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } },
      heroStart: [0, 1],
      zoneMap: {
        z0: ['....', 'R...', '....'].join('\n'),
        z1: ['...S', '....', '....'].join('\n'),
      },
      zoneLegend: { R: { label: 'Foyer' }, S: { label: 'Galerie' } },
    });
    const start = departDuGroupe(scene)?.pos;
    expect(start).toEqual({ x: 0, y: 1 });
    const floors = reachedFloors(scene, start!);
    expect(floors.has(0)).toBe(true);
    expect(floors.has(1)).toBe(true);
    expect(unreachableDescriptiveZones(scene, start!)).toEqual([]);
  });

  it('pièce nommée MURÉE (enveloppe fermée par arêtes, aucune porte) → le harnais la signale inatteignable', () => {
    // Sol marchable `herbe` PARTOUT — la cellule (3,1) est scellée par ses 4 arêtes murées (`walls`
    // N/E/S/O), pas par du terrain `mur` (coins ÉTANCHES : `neighborsOf` bloque la diagonale via
    // l'arête posée sur la case CIBLE, #789 — aucun contournement par le terrain n'est nécessaire).
    const scene = buildScene({
      id: 's-mur', label: 'Cellule scellée', size: [5, 3], terrain: 'herbe',
      heroStart: [1, 1],
      walls: [
        { x: 3, y: 1, side: 'N' },
        { x: 3, y: 1, side: 'E' },
        { x: 3, y: 1, side: 'S' },
        { x: 3, y: 1, side: 'O' },
      ],
      zoneMap: { z0: ['.....', '...X.', '.....'].join('\n') },
      zoneLegend: { X: { label: 'Cellule scellée' } },
    });
    const start = departDuGroupe(scene)?.pos;
    expect(start).toEqual({ x: 1, y: 1 });
    const unreachable = unreachableDescriptiveZones(scene, start!);
    expect(unreachable.map((z) => z.label)).toEqual(['Cellule scellée']);
  });

  it('zone posée sur du mur (aucune case marchable) → inatteignable', () => {
    const scene = buildScene({
      id: 's-vide', label: 'Zone sur du mur', size: [3, 3], terrain: 'mur',
      levels: { z0: ['...', '.P.', '...'].join('\n') },
      legend: { P: 'herbe' },
      heroStart: [1, 1],
      zoneMap: { z0: ['..Z', '...', '...'].join('\n') },
      zoneLegend: { Z: { label: 'Sur du mur' } },
    });
    const start = departDuGroupe(scene)?.pos;
    const unreachable = unreachableDescriptiveZones(scene, start!);
    expect(unreachable.map((z) => z.label)).toEqual(['Sur du mur']);
  });

  it('reachableCells depuis heroStart contient bien la case de départ', () => {
    const scene = zonesPiecesScenario.scene;
    const start = departDuGroupe(scene)!.pos;
    const cells = reachableCells(scene, start);
    expect(cells.has(`${start.x},${start.y},${start.z ?? 0}`)).toBe(true);
  });
});

/**
 * #1416 — `reachableCells` ne fait plus SON parcours : elle lit l'étiquetage des composantes
 * marchables de la scène (`walkReachableFrom`, `path.ts`). ORACLE = le parcours en largeur qu'elle
 * faisait, gardé ici : la même connectivité (`walkNeighbors`) doit rendre les MÊMES cases, sur les
 * cartes réelles comme sur les géométries pièges du harnais (cellule scellée, deux étages reliés par
 * une volée, départ posé sur une case NON marchable).
 */
describe('reachableCells — mêmes cases que le parcours en largeur (#1416)', () => {
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  /** L'ANCIENNE implémentation, gardée comme oracle. */
  const parParcours = (scene: Scene, start: { x: number; y: number; z?: number }): Set<string> => {
    const startZ = start.z ?? 0;
    const seen = new Set<string>([key(start.x, start.y, startZ)]);
    const queue: Pt[] = [{ x: start.x, y: start.y, z: startZ }];
    while (queue.length) {
      const p = queue.shift()!;
      for (const n of walkNeighbors(scene, p)) {
        const nz = n.z ?? 0;
        const k = key(n.x, n.y, nz);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push({ x: n.x, y: n.y, z: nz });
      }
    }
    return seen;
  };
  const memes = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((k) => b.has(k));

  const cellule = buildScene({
    id: 's-mur', label: 'Cellule scellée', size: [5, 3], terrain: 'herbe',
    heroStart: [1, 1],
    walls: [
      { x: 3, y: 1, side: 'N' },
      { x: 3, y: 1, side: 'E' },
      { x: 3, y: 1, side: 'S' },
      { x: 3, y: 1, side: 'O' },
    ],
    zoneMap: { z0: ['.....', '...X.', '.....'].join('\n') },
    zoneLegend: { X: { label: 'Cellule scellée' } },
  });
  const deuxEtages = buildScene({
    id: 's-2f', label: 'Deux étages', size: [4, 3], terrain: 'mur',
    levels: { z0: ['....', 'FEEE', '....'].join('\n'), z1: ['...G', '....', '....'].join('\n') },
    legend: { F: 'pave', G: 'pierre' },
    elevate: { F: 1, G: 4 },
    cells: { E: { terrain: 'pierre', stair: { to: 'z1' } } },
    heroStart: [0, 1],
  });

  const cartes: [string, Scene, { x: number; y: number; z?: number }[]][] = [
    ['zones-pieces', zonesPiecesScenario.scene, [departDuGroupe(zonesPiecesScenario.scene)!.pos, { x: 0, y: 0 }]],
    ['cellule scellée', cellule, [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 2 }]],
    ['deux étages', deuxEtages, [{ x: 0, y: 1 }, { x: 3, y: 0, z: 1 }, { x: 0, y: 0 }]],
    ['arene-hub', campaign.find((c) => c.id === 'arene-hub')!.scene, [{ x: 25, y: 20 }, { x: 1, y: 1 }, { x: 0, y: 0 }]],
    ['diligence', diligenceCampaign.scenes[0], [{ x: 16, y: 19 }, { x: 5, y: 7, z: 1 }, { x: 0, y: 0 }]],
  ];

  it.each(cartes)('%s — mêmes cases atteignables, départ par départ', (nom, scene, departs) => {
    let nonVides = 0;
    for (const start of departs) {
      const attendu = parParcours(scene, start);
      const obtenu = reachableCells(scene, start);
      if (attendu.size > 1) nonVides++;
      expect(memes(attendu, obtenu), `${nom} — départ ${start.x},${start.y},${start.z ?? 0} : ${attendu.size} attendues, ${obtenu.size} rendues`).toBe(true);
    }
    // Un échantillon où tout départ serait isolé ne prouverait rien (« {départ} = {départ} »).
    expect(nonVides, `${nom} : aucun départ n'atteint quoi que ce soit`).toBeGreaterThan(0);
  }, 60000);
});
