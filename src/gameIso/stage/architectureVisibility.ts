import { depth, type Dims, type ProjectedOccluder } from '../../geometry/iso';
import type { WallSide } from '../../noyau/monde/scene';

export type Cutaway = 'hidden' | 'visible';

/** ESPACE DÉGAGÉ par les alliés — résolu UNE fois par pas par `clearedSpace` (`builders/roofs.ts`,
 *  qui tient les emprises de masse) et lu par la loi `cutawayForSection` : toits, murs, planchers et
 *  façades s'effacent sur le MÊME espace. Un espace habité s'identifie par sa PIÈCE quand il en a une
 *  (`zoneIds`, et `zoneCells` = les cases de ces pièces), et par l'EMPRISE du bâtiment qui abrite
 *  l'allié quand aucune pièce n'est déclarée (`roomlessCells`).
 *
 *  `overheadCells` = le COUVERCLE au-dessus de la TÊTE : les cases des masses qui surplombent un allié
 *  dans le MONDE, aux niveaux strictement au-dessus du sien. C'est ce qui sépare « le bâti où je me
 *  tiens » de « ce qui est posé par-dessus ma tête » — un passage couvert est abrité par une masse dont
 *  l'allié n'occupe AUCUN niveau, et l'étage au-dessus d'une salle n'appartient à aucune de ses pièces.
 *  Tout y tombe, la DALLE comprise : cette dalle est le plafond de l'allié.
 *
 *  `seenSections` = les masses dont la nappe est VUE depuis où le groupe se tient (#950) — la
 *  condition d'EXISTENCE d'une nappe à l'écran, quand `overheadCells` dit son RETRAIT. `null` = vue
 *  non régie par la vision (éditeur, QC, POV : la vue montre le bâti tel qu'il est, et l'occlusion y
 *  est réelle). */
export interface ClearedSpace {
  zoneIds: ReadonlySet<string>;
  zoneCells: ReadonlyMap<string, ReadonlySet<string>>;
  roomlessCells: ReadonlySet<string>;
  overheadCells: ReadonlySet<string>;
  seenSections: ReadonlySet<string> | null;
}

/** Aucun allié posé (scène absente) : rien n'est dégagé, et personne ne regarde. */
export const NO_CLEARED_SPACE: ClearedSpace = {
  zoneIds: new Set(), zoneCells: new Map(), roomlessCells: new Set(), overheadCells: new Set(),
  seenSections: null,
};

export const spaceCellKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

/** L'espace qu'enferme un élément d'architecture : ses pièces (`roomZoneIds` — masse de toit,
 *  panneau de façade) et ses cases `x,y,z` (emprise × niveaux couverts d'une masse, case bordée d'un
 *  panneau). */
export interface EnclosedSpace {
  /** Masse d'appartenance : une nappe coiffe son étage sans le SURPLOMBER, elle se lève par section. */
  sectionId?: string;
  roomZoneIds?: readonly string[];
  cells: Iterable<string>;
}

/** LOI de dégagement de l'architecture, UNIQUE pour toute la scène : un élément s'efface quand
 *  l'espace qu'il enferme est dégagé — par sa PIÈCE, ou, à défaut de pièce déclarée, par ses CASES —
 *  ou quand il COIFFE cet espace (`overheadCells`). Toits (`builders/roofs.ts`), planchers, murs et
 *  façades (`frontFacadeCutaway`) passent tous par ici : un bâti sans zone déclarée se dégage
 *  toiture ET façade, jamais l'une sans l'autre, et un étage entier tombe d'un bloc avec son toit.
 *
 *  Une SECTION s'efface aussi quand le groupe ne la VOIT PAS (`seenSections`, #950) : sous un toit,
 *  la nappe du corps voisin n'a aucune raison d'être peinte — elle masque le jeu en iso et la carte
 *  en vue du dessus.
 *
 *  Le RETRAIT est binaire, à l'échelle de la SECTION : une masse dégagée s'ôte entière, jamais
 *  panneau par panneau, et jamais en translucide. */
export function cutawayForSection(section: EnclosedSpace, cleared: ClearedSpace): Cutaway {
  if (section.sectionId !== undefined && cleared.seenSections && !cleared.seenSections.has(section.sectionId)) return 'hidden';
  if (section.roomZoneIds?.some((id) => cleared.zoneIds.has(id))) return 'hidden';
  for (const key of section.cells) if (cleared.roomlessCells.has(key) || cleared.overheadCells.has(key)) return 'hidden';
  return 'visible';
}

/** La MÊME loi, lue case par case, pour tout ce qui se pose ou se dresse SUR un niveau — dalle, mur
 *  d'étage, décor : il s'ôte quand sa case appartient au couvercle au-dessus de la tête d'un allié
 *  (`overheadCells`). Même résolution (`clearedSpace`), même verdict binaire — un niveau part en
 *  entier ou reste entier. */
export function cutawayOverhead(cell: { x: number; y: number; z?: number }, cleared: ClearedSpace): boolean {
  return cleared.overheadCells.has(spaceCellKey(cell.x, cell.y, cell.z ?? 0));
}

/** Un COUVERCLE candidat : la nappe d'une masse, son niveau, l'emprise qu'elle coiffe et sa
 *  projection écran.
 *
 *  LA RIPOSTE À L'OCCLUSION D'ÉCRAN N'EST PAS UN RETRAIT (#1176, M3, 2026-08-16) : une masse peut
 *  cacher un héros sans l'abriter — il est DEVANT elle ou À CÔTÉ, pas dessous. Cette occlusion-là ne
 *  retire RIEN de l'architecture ; elle ouvre un TROU local autour du héros (`stage/percage.ts`),
 *  sur cette MÊME géométrie (`occludesActor`). Ce qui se retire (`cutawayForSection`,
 *  `cutawayOverhead`) se retire pour ABRI RÉEL et pour lui seul : la pièce, l'emprise, le couvercle
 *  au-dessus de la tête. */
export interface Lid {
  sectionId: string;
  z: number;
  cells: readonly { x: number; y: number }[];
  occluder: ProjectedOccluder;
}

export function exteriorWallViewZ(activeZ: number, interiorFocused: boolean, layerZs: readonly number[]): number {
  return interiorFocused ? activeZ : Math.max(activeZ, ...layerZs);
}

interface FacadePanel {
  roomZoneIds?: readonly string[];
  x: number;
  y: number;
  z?: number;
  side: WallSide;
}

const adjacent: Record<'N' | 'E', [{ x: number; y: number }, { x: number; y: number }]> = {
  N: [{ x: 0, y: 0 }, { x: 0, y: -1 }],
  E: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
};

/** Un panneau de façade tombe quand il sépare l'espace dégagé du dehors, ET que ce dehors est DEVANT
 *  lui à l'écran — sinon la caméra verrait tomber le mur du fond par-dessus la pièce ouverte. Le
 *  dedans se lit case par case par LA loi (`cutawayForSection`) : la pièce du panneau qui contient
 *  réellement cette case, ou la case elle-même quand aucune pièce n'est déclarée. Une arête
 *  diagonale n'a pas de devant/derrière tranché. */
export function frontFacadeCutaway(panel: FacadePanel, cleared: ClearedSpace, dims: Dims): boolean {
  if (panel.side !== 'N' && panel.side !== 'E') return false;
  const z = panel.z ?? 0;
  const [a, b] = adjacent[panel.side].map((offset) => ({ x: panel.x + offset.x, y: panel.y + offset.y }));
  const isInterior = (cell: { x: number; y: number }) => {
    const key = spaceCellKey(cell.x, cell.y, z);
    const rooms = panel.roomZoneIds?.filter((id) => cleared.zoneCells.get(id)?.has(key));
    return cutawayForSection({ roomZoneIds: rooms, cells: [key] }, cleared) === 'hidden';
  };
  const aInterior = isInterior(a);
  const bInterior = isInterior(b);
  if (aInterior === bInterior) return false;
  const interior = aInterior ? a : b;
  const exterior = aInterior ? b : a;
  return depth(exterior.x, exterior.y, dims, z) > depth(interior.x, interior.y, dims, z);
}
