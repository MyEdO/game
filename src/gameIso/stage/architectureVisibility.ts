import { depth, occludesActor, type ActorCapsule, type Dims, type ProjectedOccluder } from '../../geometry/iso';
import type { WallSide } from '../../state/scene';

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
 *  `liftedSections`/`liftedCells` = les masses levées EN TANT QUE MASSES parce que leur nappe cache un
 *  allié À L'ÉCRAN (`lidCutaway`) : l'allié n'est pas dessous, il est DEVANT ou À CÔTÉ. Toit, murs et
 *  décors du niveau levé s'ôtent ; le SOL de ce niveau reste peint — l'ôter ouvrirait un puits vers le
 *  fond de la scène là où l'on voulait montrer une pièce.
 *
 *  `seenSections` = les masses dont la nappe est VUE depuis où le groupe se tient (#950) — la
 *  condition d'EXISTENCE d'une nappe à l'écran, quand `liftedSections`/`overheadCells` disent son
 *  RETRAIT. `null` = vue non régie par la vision (éditeur, QC, POV : la vue montre le bâti tel qu'il
 *  est, et l'occlusion y est réelle). */
export interface ClearedSpace {
  zoneIds: ReadonlySet<string>;
  zoneCells: ReadonlyMap<string, ReadonlySet<string>>;
  roomlessCells: ReadonlySet<string>;
  overheadCells: ReadonlySet<string>;
  liftedSections: ReadonlySet<string>;
  liftedCells: ReadonlySet<string>;
  seenSections: ReadonlySet<string> | null;
}

/** Aucun allié posé (scène absente) : rien n'est dégagé, et personne ne regarde. */
export const NO_CLEARED_SPACE: ClearedSpace = {
  zoneIds: new Set(), zoneCells: new Map(), roomlessCells: new Set(), overheadCells: new Set(),
  liftedSections: new Set(), liftedCells: new Set(), seenSections: null,
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
  if (section.sectionId !== undefined) {
    if (cleared.liftedSections.has(section.sectionId)) return 'hidden';
    if (cleared.seenSections && !cleared.seenSections.has(section.sectionId)) return 'hidden';
  }
  if (section.roomZoneIds?.some((id) => cleared.zoneIds.has(id))) return 'hidden';
  for (const key of section.cells) if (cleared.roomlessCells.has(key) || cleared.overheadCells.has(key)) return 'hidden';
  return 'visible';
}

/** La MÊME loi, lue case par case, pour la DALLE : un plancher s'ôte quand il est le PLAFOND d'un
 *  allié — sa case appartient au couvercle au-dessus de sa tête (`overheadCells`). Une masse levée
 *  parce qu'elle le cache À L'ÉCRAN ne l'emporte pas : sans son sol, la pièce dégagée est un puits.
 *  Même résolution (`clearedSpace`), même verdict binaire — un niveau part en entier ou reste entier. */
export function cutawayOverhead(cell: { x: number; y: number; z?: number }, cleared: ClearedSpace): boolean {
  return cleared.overheadCells.has(spaceCellKey(cell.x, cell.y, cell.z ?? 0));
}

/** La MÊME loi pour ce qui se DRESSE ou se POSE sur un niveau dégagé — mur d'étage, panneau, décor :
 *  il s'ôte avec le couvercle au-dessus de la tête du groupe (`overheadCells`) COMME avec la masse
 *  levée qui le cachait à l'écran (`liftedCells`). Ce qui reste alors du niveau levé, c'est son SOL. */
export function cutawayLifted(cell: { x: number; y: number; z?: number }, cleared: ClearedSpace): boolean {
  const key = spaceCellKey(cell.x, cell.y, cell.z ?? 0);
  return cleared.overheadCells.has(key) || cleared.liftedCells.has(key);
}

/** Un COUVERCLE candidat : la nappe d'une masse, son niveau, l'emprise qu'elle coiffe et sa
 *  projection écran. */
export interface Lid {
  sectionId: string;
  z: number;
  cells: readonly { x: number; y: number }[];
  occluder: ProjectedOccluder;
}

/** L'espace dégagé, ÉTENDU aux masses dont le couvercle cache un allié À L'ÉCRAN.
 *
 *  Une masse peut coiffer le groupe sans le surplomber : dans un passage étroit, la nappe du corps
 *  VOISIN se peint par-dessus lui (mesuré sur La Diligence, passage couvert (17,12,z0) : 3 pans de
 *  deux masses voisines recouvrent encore la capsule une fois le surplomb propre retiré) ; et la
 *  nappe de SON PROPRE étage le coiffe sans qu'aucune case ne soit à un index de couche supérieur.
 *  La masse est levée ENTIÈRE (`liftedSections`) et son emprise aux niveaux au-dessus de l'allié
 *  rejoint `liftedCells` — jamais pan par pan, jamais en translucide. Ce qui se tient au niveau de
 *  l'allié n'est pas touché : un mur reste un mur, et le sol sous ses pieds reste sous ses pieds.
 *
 *  La levée d'ÉCRAN n'est pas un surplomb : l'allié est devant la masse, pas dessous. Elle ne verse
 *  donc RIEN dans `overheadCells` — le SOL du niveau levé reste peint (`cutawayOverhead`), seuls le
 *  toit, les murs et les décors s'en vont (`cutawayLifted`). */
export function lidCutaway(
  cleared: ClearedSpace,
  lids: readonly Lid[],
  actors: readonly { capsule: ActorCapsule; z: number }[],
): ClearedSpace {
  const sections = new Map<string, number>(); // masse levée → niveau de l'allié le plus BAS qu'elle cache
  for (const lid of lids)
    for (const actor of actors) {
      if (lid.z < actor.z || !occludesActor(lid.occluder, actor.capsule)) continue;
      sections.set(lid.sectionId, Math.min(sections.get(lid.sectionId) ?? actor.z, actor.z));
    }
  return cleared; // PROTOTYPE M3 (non commité) : la levée par occlusion d'écran ne verse plus rien.
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
