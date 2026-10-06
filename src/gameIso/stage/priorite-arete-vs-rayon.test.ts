import { describe, expect, it, vi } from 'vitest';
import { tileEdge, type Dims } from '../../geometry/iso';
import { emptyScene, isWalkable, liftDe, type Scene } from '../../state/scene';
import { roomPortals, type RoomPortal } from '../../state/roomPortals';
import { aretesUtilisables } from '../../state/aretes';
import { cloisons, piece } from '../../state/pieces.fixture';
import { METRES_PER_LEVEL, STEP_MAX_M } from '../../state/relief';
import { buildScene } from '../../state/mapSpec';
import type { Combatant } from '../../engine/types';
import type { BattleState } from '../../state/store';
import { poseFromDims } from './projection';
import { projeterAretes } from './aretesProjetees';
import { resoudrePixel, type CadreDePick, type EtatDePick } from './pickResolve';

/**
 * QUI GAGNE LE PIXEL D'UN SEUIL ? (#1687) — la chaîne consulte l'étage `arete` AVANT le rayon, et ce
 * banc mesure les deux régimes qui en découlent :
 *
 *  A. AUCUNE arête offerte (hors seuil, ou contrôleur sans accès) : le rayon tranche, et le pixel
 *     n'est même pas inversé — le thunk `pointStage` n'est pas appelé ;
 *  B. l'arête OFFERTE : le même pixel, sous le même rayon nommant un acteur, rend `nature:'arete'`.
 *     C'est la PARITÉ avec le hit-target SVG de l'overlay, qui retient le `pointerdown` avant que
 *     la chaîne ne soit consultée.
 *
 * Ce que cette parité vaut se mesure au troisième volet : le pixel du CENTRE d'un seuil tombe, une
 * fois inversé, sur une case MARCHABLE de son portail — donc une case où un acteur peut se tenir, et
 * que le rayon nommerait. Placer l'étage APRÈS le rayon change chacun de ces verdicts.
 */

const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });

/** Le lift que le peintre des seuils passe à `tileEdge` : le SOCLE `state/scene.ts:liftDe`, celui que
 *  l'hôte ferme sur la scène (`MondeDeCampagne.liftOf` → `SurcoucheIso`), pas une seconde hauteur. */
const liftDePortail = (scene: Scene, p: { x: number; y: number; z?: number }): number => liftDe(scene, p);

const milieu = (a: { cx: number; cy: number }, b: { cx: number; cy: number }) =>
  ({ x: (a.cx + b.cx) / 2, y: (a.cy + b.cy) / 2 });

/* ── LA CARTE-FIXTURE DES SEUILS ─────────────────────────────────────────────────────────
 * Un banc se joue sur une carte CRÉÉE POUR LUI, jamais sur une carte que l'auteur édite
 * (`.claude/memory/user-arbitrage-tests-sur-scenes-dediees-jamais-sur-scenes-utilisees.md`, 2026-09-07).
 * Cette spec d'authoring pose exactement ce que le troisième volet mesure, et sur les DEUX couches
 * qu'un bâti offre au pointeur : au rez, deux pièces séparées par un mur mitoyen qui porte une PORTE
 * et, plus bas, une OUVERTURE sans porte (le `kind: 'passage'` de `roomPortals`), plus une sortie sur
 * l'extérieur ; à l'étage, deux pièces de plus reliées par une porte, leur plancher posé à UN niveau
 * d'écran (`state/relief.ts:METRES_PER_LEVEL`). Les deux couches sont dessinées EN HAUTEUR — le rez
 * soulevé d'un pas au-dessus du dehors, l'étage d'un niveau —, et c'est ce qu'une inversion à plat
 * renvoie sur la mauvaise case. */
const CORPS = { x: 1, y: 1, w: 9, h: 7 };
/** Colonne du mur MITOYEN du rez (arête `E`), rangée de sa porte, et rangée de son ouverture NUE. */
const MITOYEN_X = 5;
const PORTE_Y = 3;
const PASSAGE_Y = 5;
/** L'ÉTAGE : son plancher (supporté par le rez), sa colonne mitoyenne et la rangée de sa porte. */
const ETAGE = { x: 2, y: 2, w: 6, h: 4 };
const ETAGE_MITOYEN_X = 4;
const ETAGE_PORTE_Y = 3;

const FIXTURE: Scene = buildScene({
  id: 'seuils-fixture',
  label: 'Fixture des seuils',
  size: [12, 10],
  terrain: 'herbe',
  heroStart: [0, 4],
  terrainRects: [{ rect: [CORPS.x, CORPS.y, CORPS.w, CORPS.h], terrain: 'plancher' }],
  // La COUCHE 1 se déclare par sa grille (`terrainRects` peint une couche, il n'en crée aucune) :
  // `P` = le plancher de l'étage, `.` = le vide au-dessus du rez.
  levels: {
    z1: [
      '............',
      '............',
      '..PPPPPP....',
      '..PPPPPP....',
      '..PPPPPP....',
      '..PPPPPP....',
      '............',
      '............',
      '............',
      '............',
    ].join('\n'),
  },
  legend: { P: 'planches' },
  relief: [
    // Le rez est SOULEVÉ d'un pas au-dessus du dehors : ses seuils ne sont plus dessinés au ras du sol,
    // et le pas reste franchissable (`STEP_MAX_M`) — à un doigt de plus, la sortie n'est plus un seuil.
    { rect: [CORPS.x, CORPS.y, CORPS.x + CORPS.w - 1, CORPS.y + CORPS.h - 1], height: STEP_MAX_M },
    // Le plancher de l'étage est à UN niveau d'écran : c'est le lift auquel ses seuils sont dessinés.
    { rect: [ETAGE.x, ETAGE.y, ETAGE.x + ETAGE.w - 1, ETAGE.y + ETAGE.h - 1], height: METRES_PER_LEVEL, z: 1 },
  ],
  walls: [
    ...Array.from({ length: CORPS.w }, (_, i) => ({ x: CORPS.x + i, y: CORPS.y, side: 'N' as const })),
    ...Array.from({ length: CORPS.w }, (_, i) => ({ x: CORPS.x + i, y: CORPS.y + CORPS.h - 1, side: 'S' as const })),
    ...Array.from({ length: CORPS.h }, (_, i) => ({ x: CORPS.x, y: CORPS.y + i, side: 'O' as const, door: i === 3 })),
    ...Array.from({ length: CORPS.h }, (_, i) => ({ x: CORPS.x + CORPS.w - 1, y: CORPS.y + i, side: 'E' as const })),
    // Mur mitoyen du rez : une PORTE à `PORTE_Y`, et AUCUNE arête à `PASSAGE_Y` — l'ouverture nue.
    ...Array.from({ length: CORPS.h }, (_, i) => ({ x: MITOYEN_X, y: CORPS.y + i, side: 'E' as const, door: CORPS.y + i === PORTE_Y }))
      .filter((w) => w.y !== PASSAGE_Y),
    ...Array.from({ length: ETAGE.w }, (_, i) => ({ x: ETAGE.x + i, y: ETAGE.y, side: 'N' as const, z: 1 })),
    ...Array.from({ length: ETAGE.w }, (_, i) => ({ x: ETAGE.x + i, y: ETAGE.y + ETAGE.h - 1, side: 'S' as const, z: 1 })),
    ...Array.from({ length: ETAGE.h }, (_, i) => ({ x: ETAGE.x, y: ETAGE.y + i, side: 'O' as const, z: 1 })),
    ...Array.from({ length: ETAGE.h }, (_, i) => ({ x: ETAGE.x + ETAGE.w - 1, y: ETAGE.y + i, side: 'E' as const, z: 1 })),
    ...Array.from({ length: ETAGE.h }, (_, i) => ({ x: ETAGE_MITOYEN_X, y: ETAGE.y + i, side: 'E' as const, z: 1, door: ETAGE.y + i === ETAGE_PORTE_Y })),
  ],
  zoneMap: {
    z0: [
      '............',
      '.AAAAABBBB..',
      '.AAAAABBBB..',
      '.AAAAABBBB..',
      '.AAAAABBBB..',
      '.AAAAABBBB..',
      '.AAAAABBBB..',
      '.AAAAABBBB..',
      '............',
      '............',
    ].join('\n'),
    z1: [
      '............',
      '............',
      '..CCCDDD....',
      '..CCCDDD....',
      '..CCCDDD....',
      '..CCCDDD....',
      '............',
      '............',
      '............',
      '............',
    ].join('\n'),
  },
  zoneLegend: {
    A: { id: 'salle-ouest', label: 'Salle ouest', presentation: 'interior' },
    B: { id: 'salle-est', label: 'Salle est', presentation: 'interior' },
    C: { id: 'chambre-ouest', label: 'Chambre ouest', presentation: 'interior' },
    D: { id: 'chambre-est', label: 'Chambre est', presentation: 'interior' },
  },
});

/** Une salle 6×6 : deux pièces d'une case, (2,2) et (3,2), et la porte de leur arête (2,2,E) — le seul
 *  accès de la première, murée ailleurs ; `portail` est celui que la scène en dérive. */
function scèneÀUnePorte(): { scene: Scene; portail: RoomPortal } {
  const scene = emptyScene(6, 6);
  scene.effectZones = [piece('a', 2, 2), piece('b', 3, 2)];
  scene.walls = [...cloisons(2, 2, ['N', 'S', 'O']), { x: 2, y: 2, side: 'E', door: true }];
  const portail = roomPortals(scene).find((p) => p.fromZoneId === 'a' && p.toZoneId === 'b');
  if (!portail) throw new Error('la scène ne dérive pas la porte (2,2,E)');
  return { scene, portail };
}

describe('l’étage `arete` et le rayon : qui tranche, et à quel prix', () => {
  const { scene, portail } = scèneÀUnePorte();
  const dims = dimsDe(scene);
  const acteur = { id: 'e1', pos: { x: 2, y: 2, z: 0 } } as unknown as Combatant;
  const enCombat: EtatDePick = {
    scene,
    mode: 'battle',
    battle: { combatants: [acteur], order: ['e1'], turn: 0 } as unknown as BattleState,
    partyPos: { x: 0, y: 0 },
  };
  const [a, b] = tileEdge(2, 2, 'E', dims, 0);
  const aretes = projeterAretes(
    aretesUtilisables({ scene, visible: new Set(['2,2,0', '3,2,0']), controleur: { x: 2, y: 2, z: 0 }, activeZ: 0 }),
    dims,
    () => 0,
  );

  it('SANS arête offerte : le rayon tranche, et le pixel n’est jamais inversé', () => {
    const surLeSeuil = vi.fn(() => milieu(a, b));
    const cadre: CadreDePick = { pose: poseFromDims(dims), dims, activeZ: 0, aretes: [] };

    const verdict = resoudrePixel(enCombat, { kind: 'combatant', id: 'e1' }, surLeSeuil, cadre);

    expect(verdict).toEqual({ tile: { x: 2, y: 2, z: 0 }, cid: 'e1', via: 'sprite', nature: 'combattant' });
    expect(surLeSeuil, 'aucun étage n’a besoin du point inversé').not.toHaveBeenCalled();
  });

  it('AVEC l’arête offerte : le MÊME pixel rend le seuil, l’étage précédant le rayon', () => {
    const surLeSeuil = vi.fn(() => milieu(a, b));
    const cadre: CadreDePick = { pose: poseFromDims(dims), dims, activeZ: 0, aretes };

    const verdict = resoudrePixel(enCombat, { kind: 'combatant', id: 'e1' }, surLeSeuil, cadre);

    expect(aretes, 'la porte de la scène est bien offerte au picking').toHaveLength(1);
    expect(verdict.nature).toBe('arete');
    expect(verdict.via).toBe('arete');
    if (verdict.nature === 'arete') expect(verdict.arete.portail?.id).toBe(portail.id);
    expect(surLeSeuil, 'l’étage d’arête inverse le pixel : c’est le coût de la parité').toHaveBeenCalledTimes(1);
  });

  it('chaque pixel de seuil rend une case DU portail, où un acteur peut se tenir', () => {
    const sc = FIXTURE;
    const d = dimsDe(sc);
    const cadre = (z: number): CadreDePick => ({ pose: poseFromDims(d), dims: d, activeZ: z, aretes: [] });
    const portails = roomPortals(sc);

    const derives: string[] = [];
    for (const p of portails) {
      const [pa, pb] = tileEdge(p.edge.x, p.edge.y, p.edge.side, d, liftDePortail(sc, p.from));
      const g = milieu(pa, pb);
      const st: EtatDePick = { scene: sc, mode: 'exploration', battle: null, partyPos: p.from };
      const { tile } = resoudrePixel(st, null, () => g, cadre(p.z));
      const est = (q: { x: number; y: number; z?: number }) => !!tile && tile.x === q.x && tile.y === q.y && tile.z === (q.z ?? 0);
      if (!tile) derives.push(`${p.id} → hors monde`);
      else if (!est(p.from) && !est(p.to)) derives.push(`${p.id} → ${tile.x},${tile.y},z${tile.z} (ni from ni to)`);
      else if (!isWalkable(sc, tile.x, tile.y, tile.z)) derives.push(`${p.id} → ${tile.x},${tile.y},z${tile.z} non marchable`);
    }

    expect(portails.length, 'la fixture porte des seuils à mesurer').toBeGreaterThan(0);
    expect(
      portails.filter((p) => liftDePortail(sc, p.from) > 0).length,
      'des seuils DESSINÉS EN HAUTEUR : à plat, ce volet ne mesure plus l’inversion par lift',
    ).toBeGreaterThan(0);
    expect(
      portails.filter((p) => p.z === 1).length,
      'des seuils à l’ÉTAGE : sans eux, la couche active > 0 n’est jamais exercée',
    ).toBeGreaterThan(0);
    expect(
      [...new Set(portails.map((p) => p.kind))].sort(),
      'les deux genres de seuil que la fixture pose : la porte et l’ouverture nue',
    ).toEqual(['door-open', 'passage']);
    expect(derives).toEqual([]);
  });
});
