/**
 * Détection PURE des défauts de plan d'une Scène compilée (`buildScene`, ou la Scène d'un projet
 * exporté) — jamais de l'ASCII source. Module PARTAGÉ : consommé par la CLI `scripts/map/check.mts`
 * ET par `validateScene` (donc par l'éditeur de scène) — une seule implémentation, un seul verdict,
 * un seul texte de message.
 */
import { heightAt, isDescriptiveZone, type Scene, type SceneEffectZone } from './scene';
import { sceneZoneTiles } from './zones';
import { estAbsent, terrainAbsent, terrainWalkable, tousLesTerrains } from './terrain';
import { gradeBetween, METRES_PER_LEVEL } from './relief';
import { memoByRef, memoByRefDeps } from './sceneMemo';
import type { CellSide } from './scene';
import { areteCanonique } from '../geometry/arete';

/** Terrains BÂTIS : ceux dont l'entrée porte `built` (`TerrainDef.built`) — surface construite qui PORTE
 *  l'étage posé dessus (plancher, dallage, pavage, bloc de maçonnerie). LU au dataset à l'appel : une
 *  entrée retouchée à l'atelier change le verdict d'audit sans rechargement. */
export const builtTerrains = (): Set<string> => new Set(tousLesTerrains().filter((t) => t.built).map((t) => t.id));

/** Sols NUS = complément de `builtTerrains()` sur le dataset des terrains (famille 5, toutes cartes) :
 *  sol naturel (`herbe`, `terre`, `route`, `sable`…) comme la tuile ABSENTE (rien du tout). Un terrain déposé
 *  demain sans `built` tombe donc ICI, et un étage posé dessus se signale au lieu de passer en silence. */
export const groundTerrains = (): Set<string> => new Set(tousLesTerrains().filter((t) => !t.built).map((t) => t.id));

/** Terrain d'une case pour l'AUDIT DE PLAN : hors bornes et étage absent y valent la tuile ABSENTE
 *  (`terrainAbsent`) — un plan n'a rien à auditer là où rien n'est bâti. Lecture distincte de
 *  `tileAt`, qui rend le terrain du BORD DU MONDE hors grille (#1789). */
export function terrainAt(scene: Scene, x: number, y: number, z: number): string {
  if (x < 0 || y < 0 || x >= scene.dimensions.w || y >= scene.dimensions.h) return terrainAbsent();
  const layer = scene.layers.find((l) => l.z === z);
  if (!layer) return terrainAbsent();
  return layer.tiles[y * scene.dimensions.w + x];
}

/** Étages présents dans la Scène, triés (z croissant). */
export function scenesZ(scene: Scene): number[] {
  return [...new Set(scene.layers.map((l) => l.z))].sort((a, b) => a - b);
}

/** Un mur (plein, porte ou structure) existe-t-il sur cette arête, à cet étage ? */
function edgeExists(scene: Scene, x: number, y: number, side: CellSide, z: number): boolean {
  const c = areteCanonique(x, y, side);
  return (scene.walls ?? []).some((w) => (w.z ?? 0) === z && w.side === c.side && w.x === c.x && w.y === c.y);
}

/** Zones DESCRIPTIVES (nom de pièce, `isDescriptiveZone`) de la scène — sujet des familles de zone. */
export function descriptiveZones(scene: Scene): SceneEffectZone[] {
  return (scene.effectZones ?? []).filter(isDescriptiveZone);
}

/** Index `x,y,z → zone DESCRIPTIVE` pour tout étage — lookup O(1). Se calcule une fois par scène et se
 *  passe aux audits qui en dépendent (`scenePlanDefects`) : l'éditeur revalide à chaque frappe. */
function descriptiveZoneIndex(scene: Scene): Map<string, SceneEffectZone> {
  const index = new Map<string, SceneEffectZone>();
  for (const zone of descriptiveZones(scene)) {
    for (const tile of sceneZoneTiles(zone)) index.set(`${tile.x},${tile.y},${tile.z ?? zone.z ?? 0}`, zone);
  }
  return index;
}

export type PlanDefectFamily =
  | 'facade-decalee' | 'mur-manquant' | 'etage-sur-exterior'
  | 'case-sans-zone' | 'etage-sans-appui'
  | 'zone-hors-bati' | 'zone-debordante'
  | 'enceinte-au-bord' | 'mur-arrete-au-bord' | 'mur-en-impasse' | 'porte-orpheline';

/** OÙ se corrige le défaut — l'éditeur en fait une sélection, le CLI une coordonnée. */
export type PlanDefectAt =
  | { kind: 'cell'; x: number; y: number; z: number }
  | { kind: 'edge'; x: number; y: number; side: CellSide; z: number }
  /** `tiles` = les cases FAUTIVES du défaut, à allumer d'un bloc sur la carte (l'éditeur sélectionne
   *  la zone par `zoneId`, et met en évidence exactement ces cases-là). */
  | { kind: 'zone'; zoneId: string; z: number; tiles: { x: number; y: number; z: number }[] };

/** Cases à ALLUMER pour un défaut de plan : celles que le défaut lui-même désigne — une zone porte ses
 *  cases FAUTIVES (`PlanDefectAt`), qui se comptent souvent par dizaines. PURE : l'éditeur les met en
 *  évidence, la vue les fait défiler, aucun consommateur n'a à monter un composant pour ça. */
export function planFocusTiles(at: PlanDefectAt): { x: number; y: number; z: number }[] {
  return at.kind === 'zone' ? at.tiles : [{ x: at.x, y: at.y, z: at.z }];
}

export interface PlanDefect {
  family: PlanDefectFamily;
  at: PlanDefectAt;
  /** Grille à corriger (le CLI la cite) : 'walled' = grille de murs, 'zone' = zoneMap. */
  grid: 'walled' | 'zone';
  /** Phrase d'AUTEUR en français, autoportante. */
  message: string;
}

export interface PlanDefectFamilyDef {
  id: PlanDefectFamily;
  /** Titre de rubrique en français d'auteur, SANS numéro (le CLI numérote depuis ce registre). */
  title: string;
  /** SUJET du scan : `floorPair` = une dalle d'étage contre l'étage du dessous (`floorPairs` — sans
   *  second étage, la famille n'a rien à regarder) ; `zone` = les zones déclarées, de plain-pied comprises ;
   *  `floor` = la grille de MURS d'un étage, seule (aucune zone, aucun second étage requis). */
  scope: 'floorPair' | 'zone' | 'floor';
}

/** Registre des familles — ORDRE de rapport, source unique des titres et du sujet de chacune. */
export const PLAN_DEFECT_FAMILIES: readonly PlanDefectFamilyDef[] = [
  { id: 'facade-decalee', title: 'Façade décalée entre étages', scope: 'floorPair' },
  { id: 'mur-manquant', title: 'Mur manquant sur un périmètre', scope: 'floorPair' },
  { id: 'etage-sur-exterior', title: 'Étage au-dessus du dehors', scope: 'floorPair' },
  { id: 'case-sans-zone', title: 'Case sans pièce', scope: 'floorPair' },
  { id: 'etage-sans-appui', title: 'Étage sans appui', scope: 'floorPair' },
  { id: 'zone-hors-bati', title: 'Zone hors des murs', scope: 'zone' },
  { id: 'zone-debordante', title: 'Zone débordant hors des murs', scope: 'zone' },
  { id: 'enceinte-au-bord', title: 'Enceinte collée au bord de la carte', scope: 'floor' },
  { id: 'mur-arrete-au-bord', title: 'Mur arrêté sur le bord de la carte', scope: 'floor' },
  { id: 'mur-en-impasse', title: 'Mur en impasse à l’intérieur de la carte', scope: 'floor' },
  { id: 'porte-orpheline', title: 'Porte posée sur une arête isolée', scope: 'floor' },
];

/** Familles scannées par PAIRE d'étages (`floorPairs`) — les familles de zone et celles de grille de
 *  murs en sont exclues : une scène de plain-pied a des zones et des murs, donc un sujet. */
export type FloorPairFamily = Exclude<PlanDefectFamily, 'zone-hors-bati' | 'zone-debordante' | 'enceinte-au-bord' | 'mur-arrete-au-bord' | 'mur-en-impasse' | 'porte-orpheline'>;

export interface Defect {
  family: FloorPairFamily;
  /** Étage/case de la GRILLE à corriger (pas forcément l'étage `above` du scan). */
  grid: 'walled';
  z: number;
  x: number;
  y: number;
  side?: CellSide;
  message: string;
}

interface ZoneDefect {
  family: 'etage-sur-exterior' | 'case-sans-zone';
  grid: 'walled' | 'zone';
  z: number;
  x: number;
  y: number;
  message: string;
}

interface Tremie {
  x: number;
  y: number;
  z: number;
  legitimate: boolean;
  detail: string;
}

const isFloor = (scene: Scene, x: number, y: number, z: number) => !estAbsent(terrainAt(scene, x, y, z));

/** 4-voisinage d'une case — foyer unique des parcours de grille de ce module. */
const NEIGHBORS4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** 8-voisinage — le CONTACT d'une case avec le bâti, par un côté ou par un coin (`supportedFloorCells`). */
const NEIGHBORS8: readonly (readonly [number, number])[] = [...NEIGHBORS4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Composante connexe de vide (à l'étage `z`) qui ATTEINT le bord de la grille — donc communique avec le
 *  dehors véritable — par opposition à une poche de vide ENCERCLÉE par la dalle bâtie (trémie/mezzanine,
 *  garde-corps de galerie sur un vide central). Critère GÉOMÉTRIQUE, ne dépend d'aucune zone déclarée :
 *  marche même sans `zoneMap` (#823 défaut 1), et tranche par la seule géométrie le vide au-dessus d'une
 *  annexe de plain-pied — il rejoint le dehors, donc EXIGE un mur, quelle que soit la présentation
 *  `interior`/`exterior` de la zone du dessous — contre un puits interne, qui n'en exige aucun. */
function exteriorVoidCells(scene: Scene, z: number): Set<string> {
  const { w, h } = scene.dimensions;
  const isVide = (x: number, y: number) => estAbsent(terrainAt(scene, x, y, z));
  const visited = new Set<string>();
  const exterior = new Set<string>();
  for (let y0 = 0; y0 < h; y0++) {
    for (let x0 = 0; x0 < w; x0++) {
      const key0 = `${x0},${y0}`;
      if (visited.has(key0) || !isVide(x0, y0)) continue;
      const stack: [number, number][] = [[x0, y0]];
      const comp: [number, number][] = [];
      visited.add(key0);
      let touchesBorder = false;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        comp.push([cx, cy]);
        if (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1) touchesBorder = true;
        for (const [dx, dy] of NEIGHBORS4) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) { touchesBorder = true; continue; }
          const nk = `${nx},${ny}`;
          if (visited.has(nk) || !isVide(nx, ny)) continue;
          visited.add(nk);
          stack.push([nx, ny]);
        }
      }
      if (touchesBorder) for (const [cx, cy] of comp) exterior.add(`${cx},${cy}`);
    }
  }
  return exterior;
}

const NEIGHBOR_EDGE: Record<CellSide, { x: number; y: number }> = { O: { x: -1, y: 0 }, E: { x: 1, y: 0 }, N: { x: 0, y: -1 }, S: { x: 0, y: 1 } };

/** Les quatre côtés d'une case, dans l'ordre du rapport — foyer unique des balayages d'arêtes. */
const SIDES4: readonly CellSide[] = ['N', 'E', 'S', 'O'];

/** Cases À L'AIR LIBRE d'un étage : remplissage depuis le HORS-GRILLE, avec pour SEULE barrière une
 *  arête MURÉE (`edgeExists` : mur plein, porte, structure, arête grimpable — la géométrie du plan).
 *  Le complément = les cases ENCLOSES, celles qu'une boucle fermée de murs sépare du dehors.
 *
 *  La barrière est l'EXISTENCE du segment, jamais son état : une porte — ouverte, fermée, condamnée —
 *  ferme le périmètre comme un mur, sinon une pièce cesserait d'être une pièce à l'instant où l'on en
 *  pousse la porte. Ce que le passage franchit (`wallIsOpen`) et ce qui délimite un intérieur sont deux
 *  questions distinctes.
 *
 *  Distinct de `exteriorVoidCells`, qui inonde le VIDE d'un étage (les cases sans dalle) et ignore les
 *  murs : là c'est le SURPLOMB d'une dalle qui est en cause, ici l'ENCLOSURE d'une pièce. */
export function outdoorCells(scene: Scene, z: number): Set<string> {
  const { w, h } = scene.dimensions;
  const outdoor = new Set<string>();
  const stack: [number, number][] = [];
  const push = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (outdoor.has(key)) return;
    outdoor.add(key);
    stack.push([x, y]);
  };
  // GRAINES : les cases de bord que rien ne sépare du hors-grille (le dehors véritable).
  for (let x = 0; x < w; x++) {
    if (!edgeExists(scene, x, 0, 'N', z)) push(x, 0);
    if (!edgeExists(scene, x, h - 1, 'S', z)) push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    if (!edgeExists(scene, 0, y, 'O', z)) push(0, y);
    if (!edgeExists(scene, w - 1, y, 'E', z)) push(w - 1, y);
  }
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    for (const side of SIDES4) {
      const nb = NEIGHBOR_EDGE[side];
      const nx = cx + nb.x;
      const ny = cy + nb.y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (edgeExists(scene, cx, cy, side, z)) continue;
      push(nx, ny);
    }
  }
  return outdoor;
}

/** `(x,y,z) → la case est-elle à l'air libre ?` — un seul remplissage par étage, mémoïsé : les zones
 *  d'une scène se jugent toutes contre le même plan. */
export function outdoorLookup(scene: Scene): (x: number, y: number, z: number) => boolean {
  const byZ = new Map<number, Set<string>>();
  return (x, y, z) => {
    let cells = byZ.get(z);
    if (!cells) {
      cells = outdoorCells(scene, z);
      byZ.set(z, cells);
    }
    return cells.has(`${x},${y}`);
  };
}

/** Cache par SCÈNE (`memoByRef`, patron canonique unique) des cellules INTÉRIEURES déjà dérivées,
 *  indexées par étage — une scène immuable ne recalcule jamais deux fois le même étage. */
const interiorCellsByScene = memoByRef((_scene: Scene) => new Map<number, ReadonlySet<string>>());

/** Cellules INTÉRIEURES d'un étage — LA source unique de « où est le bâtiment » (#881), consommée par
 *  la toiture (`realFloorAt`, `sceneEdit.ts`) et par l'enveloppe de rendu (`envelopeEdgesOf`,
 *  `gameIso/builders/walls.ts`).
 *
 *  `intérieur(z) = CLOS(z) (complément de `outdoorCells`) privé des cases déclarées `presentation:
 *  'exterior'` à cet étage.` L'ENCLOSURE SEULE (une boucle fermée de murs) NE SUFFIT PAS : une enceinte
 *  close n'est pas un bâtiment couvert. Mesuré sur `diligence-projet.json` (#881, la propriété entière
 *  est ceinte d'un mur d'enceinte) :
 *   rez    clos 1066 − exterior 472 = 594   (l'auteur avait déclaré 593 `interior` ; écart de 1 case
 *          dérivée sans déclaration, (10,36))
 *   étage  clos  430 − exterior  44 = 386   (l'auteur avait déclaré 373 `interior` ; écart de 13 cases
 *          dérivées sans déclaration — EXACTEMENT ses deux volées d'escalier, qui n'ont aujourd'hui
 *          aucune zone et se faisaient pousser un toit parasite)
 *  Zéro perte aux deux niveaux : sans le filtre `exterior`, les deux cours, le passage couvert et le
 *  potager (472 cases au rez) recevraient une toiture. Le sens de l'authoring s'INVERSE : l'auteur ne
 *  déclare plus le bâtiment (déjà tracé en murs), il déclare seulement ce qui est à ciel ouvert. */
export function interiorCells(scene: Scene, z: number): ReadonlySet<string> {
  const byZ = interiorCellsByScene(scene);
  const cached = byZ.get(z);
  if (cached) return cached;
  const outdoor = outdoorCells(scene, z);
  const exterior = new Set<string>();
  for (const zone of scene.effectZones ?? []) {
    if (zone.presentation !== 'exterior' || (zone.z ?? 0) !== z) continue;
    for (const tile of sceneZoneTiles(zone)) exterior.add(`${tile.x},${tile.y}`);
  }
  const { w, h } = scene.dimensions;
  const out = new Set<string>();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const key = `${x},${y}`;
      if (!outdoor.has(key) && !exterior.has(key)) out.add(key);
    }
  byZ.set(z, out);
  return out;
}

const SHIFT: Record<CellSide, [number, number][]> = {
  O: [[-1, 0], [1, 0]],
  E: [[-1, 0], [1, 0]],
  N: [[0, -1], [0, 1]],
  S: [[0, -1], [0, 1]],
};

/** Cases de VOLÉE de `belowZ` : marches dont les cotes montent par crans franchissables (`STEP_MAX_M`,
 *  `relief.ts`) jusqu'au niveau du plancher de `aboveZ` (`METRES_PER_LEVEL` par étage). Le vide de
 *  `aboveZ` posé au-dessus d'une telle marche est une TRÉMIE — l'ouverture par laquelle on monte —,
 *  jamais un « bâti dans le vide ». La case de `aboveZ` doit être vide : MÊME invariant que le plan de
 *  volée de l'éditeur (`stairFlight.ts`, refus « trémie bouchée »). Le seuil de cran vient de
 *  `gradeBetween` — foyer unique, aucune copie ici. */
export function stairFlightCells(scene: Scene, belowZ: number, aboveZ: number): Set<string> {
  const baseBelow = belowZ * METRES_PER_LEVEL;
  const floorAbove = aboveZ * METRES_PER_LEVEL;
  const { w, h } = scene.dimensions;
  const eligible = (x: number, y: number): boolean =>
    !estAbsent(terrainAt(scene, x, y, belowZ))
    && estAbsent(terrainAt(scene, x, y, aboveZ))
    && heightAt(scene, x, y, belowZ) > baseBelow + 1e-6;

  const cells = new Set<string>();
  const queue: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // GRAINE : le sommet de la volée affleure le plancher du dessus.
      if (!eligible(x, y) || Math.abs(heightAt(scene, x, y, belowZ) - floorAbove) > 1e-6) continue;
      cells.add(`${x},${y}`);
      queue.push([x, y]);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [cx, cy] = queue[i];
    const hCur = heightAt(scene, cx, cy, belowZ);
    for (const [dx, dy] of NEIGHBORS4) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${nx},${ny}`;
      if (cells.has(key) || !eligible(nx, ny)) continue;
      if (gradeBetween(hCur, heightAt(scene, nx, ny, belowZ)) === 'cliff') continue;
      cells.add(key);
      queue.push([nx, ny]);
    }
  }
  return cells;
}

/** Familles 1 (façade décalée) et 2 (mur manquant) — arêtes du périmètre bâti de `aboveZ` dont le vide de
 *  l'autre côté (au MÊME étage `aboveZ`) communique avec le dehors véritable (`exteriorVoidCells`). Refuse
 *  de rendre un verdict sans AUCUNE zone descriptive déclarée (ceinture, symétrique à `auditZoneCoverage`
 *  ci-dessous) : un heuristique géométrique non corroboré par la moindre donnée d'auteur reste un pari —
 *  un faux positif est pire qu'un défaut raté. `applyFilter=false` reproduit le faux positif mesuré sans
 *  le filtre (garde de non-régression, `check.test.ts`). Le vide surplombant une marche de volée
 *  (`stairFlightCells`) est une trémie : aucune de ces deux familles ne s'y prononce. */
export function auditFacade(
  scene: Scene,
  aboveZ: number,
  belowZ: number,
  applyFilter = true,
  zoneIndex: Map<string, SceneEffectZone> = descriptiveZoneIndex(scene),
): Defect[] {
  if (zoneIndex.size === 0) return [];
  const exterior = exteriorVoidCells(scene, aboveZ);
  const flight = stairFlightCells(scene, belowZ, aboveZ);
  const outside = (x: number, y: number) => {
    const { w, h } = scene.dimensions;
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    return exterior.has(`${x},${y}`);
  };
  const out: Defect[] = [];
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) {
      if (!isFloor(scene, x, y, aboveZ)) continue;
      for (const side of SIDES4) {
        const nb = NEIGHBOR_EDGE[side];
        const ax = x + nb.x;
        const ay = y + nb.y;
        if (isFloor(scene, ax, ay, aboveZ)) continue; // arête interne à la dalle
        if (flight.has(`${ax},${ay}`)) continue; // trémie d'une volée de relief (`stairFlightCells`)
        if (applyFilter && !outside(ax, ay)) continue; // vide encerclé par la dalle → écarté
        const hasAbove = edgeExists(scene, x, y, side, aboveZ);
        if (!hasAbove) {
          out.push({ family: 'mur-manquant', grid: 'walled', z: aboveZ, x, y, side, message: `Mur manquant — l'étage ${aboveZ} s'arrête dans le vide à l'arête ${side} de (${x},${y}) : ferme le périmètre, ou retire cette case de plancher.` });
          continue;
        }
        if (edgeExists(scene, x, y, side, belowZ)) continue; // aligné sur le mur du dessous
        const shifted = SHIFT[side].some(([dx, dy]) => edgeExists(scene, x + dx, y + dy, side, belowZ));
        if (shifted) out.push({ family: 'facade-decalee', grid: 'walled', z: aboveZ, x, y, side, message: `Façade décalée — le mur ${side} de (${x},${y}) à l'étage ${aboveZ} ne tombe pas sur le mur du dessous.` });
      }
    }
  }
  return out;
}

/** Cases de la dalle d'étage `aboveZ` qui PORTENT — critère STRUCTUREL : ce qui reprend la charge, pas
 *  une distance. Trois façons de porter, et seulement trois :
 *  - APPUI DIRECT — le dessous est bâti (`builtTerrains()`) ;
 *  - LINTEAU — le long d'un axe (x ou y), la case atteint un appui direct des DEUX côtés sans quitter
 *    la dalle : arche, pont, porte cochère qui enjambe la voie des calèches (`mapSpec.ts`, recette
 *    `gate`). Une travée reprise à ses deux bouts n'a pas de portée à borner ;
 *  - ENCORBELLEMENT — un surplomb porté d'un seul côté ne se PROPAGE pas : le groupe de cases en
 *    surplomb (composante connexe des cases ni directes ni en linteau) ne tient que si CHACUNE de ses
 *    cases est AU CONTACT du bâti du dessous — par un côté ou par un coin (`NEIGHBORS8`), sans quoi le
 *    centre d'une travée portée par quatre piliers d'angle passerait pour un porte-à-faux. Dès qu'une
 *    case du groupe pend derrière une autre, le groupe entier est un porte-à-faux, et chacune de ses
 *    cases se signale.
 *  Aucun seuil : le verdict ne dépend d'aucune échelle métrique de Scène (`metresPerTile`) ni d'aucune
 *  valeur à régler. Calculé une fois par paire d'étages, partagé par les familles 3 et 5. */
export function supportedFloorCells(scene: Scene, aboveZ: number, belowZ: number): Set<string> {
  const { w, h } = scene.dimensions;
  const inSlab = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && isFloor(scene, x, y, aboveZ);
  const batis = builtTerrains();
  const builtBelow = (x: number, y: number) => batis.has(terrainAt(scene, x, y, belowZ));
  const slab: [number, number][] = [];
  const direct = new Set<string>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inSlab(x, y)) continue;
      slab.push([x, y]);
      if (builtBelow(x, y)) direct.add(`${x},${y}`);
    }
  }

  /** Un appui direct est-il atteint en filant dans cette direction sans quitter la dalle ? */
  const bearingTowards = (x: number, y: number, dx: number, dy: number): boolean => {
    for (let nx = x + dx, ny = y + dy; inSlab(nx, ny); nx += dx, ny += dy) if (direct.has(`${nx},${ny}`)) return true;
    return false;
  };
  const spanned = (x: number, y: number): boolean =>
    (bearingTowards(x, y, 1, 0) && bearingTowards(x, y, -1, 0))
    || (bearingTowards(x, y, 0, 1) && bearingTowards(x, y, 0, -1));

  const supported = new Set(direct);
  const overhang: [number, number][] = [];
  for (const [x, y] of slab) {
    const key = `${x},${y}`;
    if (supported.has(key)) continue;
    if (spanned(x, y)) supported.add(key);
    else overhang.push([x, y]);
  }

  const pending = new Set(overhang.map(([x, y]) => `${x},${y}`));
  const touchesBuilt = (x: number, y: number) => NEIGHBORS8.some(([dx, dy]) => builtBelow(x + dx, y + dy));
  const seen = new Set<string>();
  for (const [x0, y0] of overhang) {
    const key0 = `${x0},${y0}`;
    if (seen.has(key0)) continue;
    seen.add(key0);
    const stack: [number, number][] = [[x0, y0]];
    const group: [number, number][] = [];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      group.push([cx, cy]);
      for (const [dx, dy] of NEIGHBORS4) {
        const nk = `${cx + dx},${cy + dy}`;
        if (seen.has(nk) || !pending.has(nk)) continue;
        seen.add(nk);
        stack.push([cx + dx, cy + dy]);
      }
    }
    if (group.every(([x, y]) => touchesBuilt(x, y))) for (const [x, y] of group) supported.add(`${x},${y}`);
  }
  return supported;
}

/** Familles 3 (étage au-dessus d'une zone exterior) et 4 (case sans zone déclarée) — scan des cases de
 *  la dalle d'étage `aboveZ` contre la zone descriptive déclarée à `belowZ`. Vide si la carte n'authore
 *  aucun `zoneMap`/`zoneLegend` (rien à contredire). La famille 3 ne se prononce que sur une case que
 *  rien ne porte (`supportedFloorCells`) : un balcon, un encorbellement au contact du bâti, une galerie
 *  reprise de part et d'autre surplombent légitimement une zone `exterior`. La famille 4 reste par case : une case
 *  recouverte sans zone déclarée manque de donnée d'auteur, appui ou pas. */
export function auditZoneCoverage(
  scene: Scene,
  aboveZ: number,
  belowZ: number,
  zoneIndex: Map<string, SceneEffectZone> = descriptiveZoneIndex(scene),
  supported: Set<string> = supportedFloorCells(scene, aboveZ, belowZ),
): ZoneDefect[] {
  if (zoneIndex.size === 0) return [];
  const out: ZoneDefect[] = [];
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) {
      if (!isFloor(scene, x, y, aboveZ)) continue;
      const zone = zoneIndex.get(`${x},${y},${belowZ}`);
      if (!zone) {
        out.push({ family: 'case-sans-zone', grid: 'zone', z: belowZ, x, y, message: `Case sans pièce — (${x},${y}) est recouverte par l'étage ${aboveZ} mais n'appartient à aucune zone : rattache-la à une pièce en peignant l'emprise de la zone voulue sur elle, ou crée la pièce qui manque.` });
      } else if (zone.presentation === 'exterior' && !supported.has(`${x},${y}`)) {
        out.push({ family: 'etage-sur-exterior', grid: 'walled', z: aboveZ, x, y, message: `Étage au-dessus du dehors — (${x},${y}) porte un plancher à l'étage ${aboveZ} au-dessus de « ${zone.label} », déclarée en extérieur, sans rien qui le porte : ni repris des deux côtés par du bâti (linteau, arche, porte cochère), ni au contact du bâti (encorbellement). Pose un appui bâti sous ce surplomb, ou retire cette case de plancher.` });
      }
    }
  }
  return out;
}

/** Famille 5 — case d'étage dont le dessous est du sol NU (`groundTerrains`) et que rien ne PORTE
 *  (`supportedFloorCells`) : elle flotte. Une travée qui enjambe un chemin de calèches, reprise par du
 *  bâti de part et d'autre, n'est pas un défaut, quelle que soit la largeur du passage. */
export function auditUnsupportedFloor(
  scene: Scene,
  aboveZ: number,
  belowZ: number,
  groundTerrains: Set<string>,
  supported: Set<string> = supportedFloorCells(scene, aboveZ, belowZ),
): Defect[] {
  const out: Defect[] = [];
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) {
      if (!isFloor(scene, x, y, aboveZ) || supported.has(`${x},${y}`)) continue;
      const below = terrainAt(scene, x, y, belowZ);
      if (groundTerrains.has(below)) out.push({ family: 'etage-sans-appui', grid: 'walled', z: aboveZ, x, y, message: `Étage sans appui — (${x},${y}) porte un plancher à l'étage ${aboveZ} au-dessus de « ${below} », sans rien qui le porte : ni repris des deux côtés par du bâti (linteau, arche, porte cochère), ni au contact du bâti (encorbellement). Pose un appui bâti sous ce surplomb, ou retire cette case de plancher.` });
    }
  }
  return out;
}

/** Cases d'une zone qui ne sont PAS des cases de PIÈCE — celles à retailler, à refermer ou à doter d'un
 *  sol. Une pièce, c'est un SOL sous une ENCLOSURE : la case porte un plancher au sens large (`isFloor` —
 *  n'importe quel terrain plutôt que le vide) ET les murs la séparent du dehors (`outdoorLookup`). Le
 *  MATÉRIAU du sol n'entre pas dans le verdict : une forge, des écuries, une brasserie ont un sol de
 *  terre battue, un passage couvert est une route qui passe sous le bâtiment. */
export function zoneOutsideBuildingTiles(
  scene: Scene,
  zone: SceneEffectZone,
  outdoor: (x: number, y: number, z: number) => boolean = outdoorLookup(scene),
): { x: number; y: number; z: number }[] {
  const z = zone.z ?? 0;
  return sceneZoneTiles(zone)
    .map((t) => ({ x: t.x, y: t.y, z: t.z ?? z }))
    .filter((t) => outdoor(t.x, t.y, t.z) || !isFloor(scene, t.x, t.y, t.z));
}

/** Familles 6 et 7 — la zone de pièce tient-elle DANS le bâtiment ? Sujet : les seules zones descriptives
 *  déclarées `interior` ; une zone `exterior` (cour, jardin) est faite pour être à ciel ouvert, elle n'a
 *  rien à refermer. Indépendante de `floorPairs` : une scène de plain-pied a des zones, donc un verdict.
 *  Le défaut porte ses cases fautives (`at.tiles`) : l'auteur les voit toutes allumées d'un coup au lieu
 *  de les déduire du chiffre. */
export function auditZoneFootprint(scene: Scene): PlanDefect[] {
  const out: PlanDefect[] = [];
  const outdoor = outdoorLookup(scene); // un seul remplissage par étage, partagé par toutes les zones
  for (const zone of descriptiveZones(scene)) {
    if (zone.presentation !== 'interior') continue;
    const tiles = sceneZoneTiles(zone);
    if (!tiles.length) continue;
    const z = zone.z ?? 0;
    const off = zoneOutsideBuildingTiles(scene, zone, outdoor);
    if (!off.length) continue;
    const inside = tiles.length - off.length;
    const at: PlanDefectAt = { kind: 'zone', zoneId: zone.id, z, tiles: off };
    if (inside === 0) {
      out.push({
        family: 'zone-hors-bati', at, grid: 'zone',
        message: `${zone.label} — la zone n'est enclose nulle part : aucune de ses ${tiles.length} cases n'est à la fois posée sur un sol et refermée par des murs. Ferme le périmètre de murs autour d'elle, déplace-la dans le bâtiment, ou déclare-la en extérieur si c'est une cour.`,
      });
    } else {
      const pct = Math.round((inside / tiles.length) * 100);
      out.push({
        family: 'zone-debordante', at, grid: 'zone',
        message: `${zone.label} — la zone déborde hors des murs : ${inside} de ses ${tiles.length} cases seulement sont encloses (${pct} %) — retire de son emprise les cases allumées, ou prolonge les murs autour d'elles.`,
      });
    }
  }
  return out;
}

/** Famille informative — trémies (case sans plancher d'étage entourée d'au moins 3/4 voisins bâtis).
 *  LÉGITIME selon l'un OU l'autre des deux modèles d'escalier du moteur : le char de la grille `walled`
 *  du dessous résout une recette `cells.stair` (`stairChars`), ou la case est une marche de volée de
 *  relief (`stairFlightCells`). Sinon reportée comme trou SUSPECT (à vérifier, jamais un défaut compté). */
export function auditStairwells(scene: Scene, aboveZ: number, belowZ: number, stairChars: Set<string> | undefined, charAt: (x: number, y: number) => string): Tremie[] {
  const out: Tremie[] = [];
  const flight = stairFlightCells(scene, belowZ, aboveZ);
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) {
      if (isFloor(scene, x, y, aboveZ)) continue;
      const below = terrainAt(scene, x, y, belowZ);
      if (estAbsent(below)) continue; // rien à trouer : pas dans le bâti
      const covered = NEIGHBORS4.filter(([dx, dy]) => isFloor(scene, x + dx, y + dy, aboveZ)).length;
      if (covered < 3) continue;
      const ch = charAt(x, y);
      const byRecipe = stairChars?.has(ch) ?? false;
      const byRelief = flight.has(`${x},${y}`);
      out.push({ x, y, z: aboveZ, legitimate: byRecipe || byRelief, detail: byRecipe
        ? `trémie d'escalier (z${belowZ}='${ch}' en ${x},${y}) — LÉGITIME, ne pas combler`
        : byRelief
          ? `trémie de volée (marche cotée ${heightAt(scene, x, y, belowZ)} m à z${belowZ} en ${x},${y}) — LÉGITIME, ne pas combler`
          : `trou de plancher NON EXPLIQUÉ en (${x},${y}) (z${belowZ}='${ch}') — à vérifier` });
    }
  }
  return out;
}

/** Étages consécutifs (z, z-1) de la Scène — paires scannées par les audits par étage. */
export function floorPairs(scene: Scene): [number, number][] {
  const zs = scenesZ(scene);
  const pairs: [number, number][] = [];
  for (let i = 1; i < zs.length; i++) pairs.push([zs[i], zs[i - 1]]);
  return pairs;
}

/** Segments d'arête CARDINAUX d'un étage — les seuls qui ferment un périmètre : une diagonale
 *  (`'\\'`/`'/'`) traverse une case sans s'accrocher à deux coins de la trame. */
function cardinalWalls(scene: Scene, z: number): WallSegment[] {
  return (scene.walls ?? [])
    .filter((w) => (w.z ?? 0) === z && (w.side === 'N' || w.side === 'E'))
    .map((w) => ({ x: w.x, y: w.y, side: w.side as 'N' | 'E' }));
}

/** Les deux COINS de trame qu'un segment relie : `N` de (x,y) va de (x,y) à (x+1,y), `E` de (x,y) va
 *  de (x+1,y) à (x+1,y+1). Deux segments qui partagent un coin sont chaînés. */
function wallVertices(seg: WallSegment): [string, string] {
  return seg.side === 'N'
    ? [`${seg.x},${seg.y}`, `${seg.x + 1},${seg.y}`]
    : [`${seg.x + 1},${seg.y}`, `${seg.x + 1},${seg.y + 1}`];
}

/** Famille 8 — un étage MURÉ dont plus AUCUNE case n'est à l'air libre (`outdoorCells` vide). Le
 *  remplissage du dehors s'amorce PAR le bord de la grille : une enceinte posée au ras de ce bord
 *  n'y laisse aucune graine, tout l'étage bascule en `interiorCells` et la carte entière reçoit une
 *  toiture. Le site du défaut est l'arête N de (0,0) : quand le dehors est vide, le bord est muré
 *  partout — la case (0,0) serait une graine sans mur sur son N comme sur son O. */
export function auditEnclosureAtBorder(scene: Scene, z: number): PlanDefect[] {
  if (!cardinalWalls(scene, z).length || outdoorCells(scene, z).size > 0) return [];
  return [{
    family: 'enceinte-au-bord',
    at: { kind: 'edge', x: 0, y: 0, side: 'N', z },
    grid: 'walled',
    message: `Enceinte collée au bord de la carte — aucune case de l'étage ${z} n'est à l'air libre : les murs enferment la grille entière, donc tout y passe pour l'intérieur d'un bâtiment (toiture comprise). Mets l'enceinte en retrait d'au moins une case du bord, ou déclare en extérieur les zones à ciel ouvert qu'elle entoure.`,
  }];
}

type WallSegment = { x: number; y: number; side: 'N' | 'E' };

/** Graphe des murs d'un étage : les segments CARDINAUX et le DEGRÉ de chaque coin de trame (nombre de
 *  segments qui s'y accrochent). Foyer unique des familles qui raisonnent sur les EXTRÉMITÉS de mur —
 *  un coin de degré 1 est un bout libre, un coin de degré 3 une jonction en T. */
function wallGraph(scene: Scene, z: number): { segs: WallSegment[]; degree: Map<string, number> } {
  const segs = cardinalWalls(scene, z);
  const degree = new Map<string, number>();
  for (const seg of segs) for (const v of wallVertices(seg)) degree.set(v, (degree.get(v) ?? 0) + 1);
  return { segs, degree };
}

/** Coin de trame posé sur le BORD de la grille — l'amorce du dehors, pas un mur (famille 9). */
function vertexOnBorder(scene: Scene, v: string): boolean {
  const { w, h } = scene.dimensions;
  const [vx, vy] = v.split(',').map(Number);
  return vx === 0 || vy === 0 || vx === w || vy === h;
}

/** Famille 9 — mur dont une extrémité s'arrête sur le BORD de la carte sans rencontrer d'autre
 *  segment. Le bord n'est pas un mur : c'est l'amorce du dehors. Une pièce adossée au bord et close
 *  par ses seuls murs internes reste donc OUVERTE — elle ne porte ni plancher réel, ni enveloppe, ni
 *  toiture. Un coin de degré 3 (jonction en T d'une cloison) n'est pas une extrémité : seul le
 *  degré 1 l'est. */
export function auditWallDeadEndsAtBorder(scene: Scene, z: number): PlanDefect[] {
  const { segs, degree } = wallGraph(scene, z);
  const out: PlanDefect[] = [];
  for (const seg of segs) {
    for (const v of wallVertices(seg)) {
      if (degree.get(v) !== 1 || !vertexOnBorder(scene, v)) continue;
      out.push({
        family: 'mur-arrete-au-bord',
        at: { kind: 'edge', x: seg.x, y: seg.y, side: seg.side, z },
        grid: 'walled',
        message: `Mur arrêté sur le bord de la carte — le mur ${seg.side} de (${seg.x},${seg.y}) à l'étage ${z} finit au coin (${v}) sans rencontrer d'autre mur, et ce coin est sur le bord de la grille. Le bord n'est pas un mur : c'est par lui que le dehors entre, donc la pièce qu'il devait fermer reste ouverte et ne porte ni plancher réel, ni enveloppe, ni toiture. Prolonge les murs le long du bord jusqu'à refermer la boucle, ou mets le bâtiment en retrait du bord.`,
      });
    }
  }
  return out;
}

/** Famille 10 — porte posée sur une arête ISOLÉE : à son étage, aucun autre segment de mur ne partage
 *  l'un de ses deux coins de trame (`wallVertices`). Une porte n'est pas un objet posé sur le sol : c'est
 *  le segment de mur lui-même, percé. Isolée, elle n'ouvre sur rien — elle se contourne par les deux
 *  côtés, ne ferme aucune pièce, et le rendu lui dresse un chambranle en plein air. Seules les arêtes
 *  CARDINALES comptent (une diagonale ne s'accroche à aucun coin de la trame, cf. `cardinalWalls`).
 *  La partition PAR ÉTAGE est déjà portée par la clé de coin (`wallVertices` y met le `z`) : aucun mur
 *  d'un autre étage n'y rattache une porte. Mesuré : 0 porte orpheline sur les 4 paquets livrés. */
export function auditOrphanDoors(scene: Scene, z: number): PlanDefect[] {
  const { degree } = wallGraph(scene, z);
  const out: PlanDefect[] = [];
  for (const wall of scene.walls ?? []) {
    if (!wall.door || (wall.z ?? 0) !== z || (wall.side !== 'N' && wall.side !== 'E')) continue;
    const seg = { x: wall.x, y: wall.y, side: wall.side };
    if (wallVertices(seg).some((v) => (degree.get(v) ?? 0) > 1)) continue;
    out.push({
      family: 'porte-orpheline',
      at: { kind: 'edge', x: seg.x, y: seg.y, side: seg.side, z },
      grid: 'walled',
      message: `Porte posée sur une arête isolée — la porte ${seg.side} de (${seg.x},${seg.y}) à l'étage ${z} ne touche aucun autre mur par ses coins : elle n'ouvre sur rien, se contourne des deux côtés et se dresse seule au rendu. Rattache-la au mur qu'elle devait percer, ou retire-la.`,
    });
  }
  return out;
}

/** Famille 11 (#1179) — mur dont une extrémité s'arrête EN PLEIN PLANCHER, sans rencontrer d'autre
 *  segment : une cloison qui ne rejoint rien ne ferme rien, elle se contourne par son bout. Symétrique
 *  intérieure de la famille 9 — même graphe, même critère de degré 1 —, avec la même forme d'exemption :
 *  un coin dont l'un des 4 QUADRANTS (les quatre cases qui le touchent) n'est pas CONTOURNABLE n'est pas
 *  une extrémité. Hors grille, c'est le bord, l'amorce du dehors ; sinon c'est le terrain qui tranche,
 *  par le seul critère du pas (`terrainWalkable`) : vide, eau, masse de maçonnerie, fosse, lave. Une
 *  cloison qui meurt là ne laisse aucun bout à contourner — garde-corps de galerie sur un puits interne
 *  (`exteriorVoidCells`), refend qui meurt au bord d'un balcon, cloison qui bute sur un rocher. Quand
 *  les DEUX coins d'un segment sont libres, le message le dit isolé. Un coin de degré 3 (jonction en T)
 *  n'est pas une extrémité. */
export function auditWallDeadEndsInside(scene: Scene, z: number): PlanDefect[] {
  const { segs, degree } = wallGraph(scene, z);
  /** Le bout du mur se CONTOURNE-t-il ? Vrai quand les 4 quadrants du coin se foulent au pas. */
  const contournable = (v: string) => {
    if (vertexOnBorder(scene, v)) return false;
    const [vx, vy] = v.split(',').map(Number);
    return [[vx - 1, vy - 1], [vx, vy - 1], [vx - 1, vy], [vx, vy]]
      .every(([cx, cy]) => terrainWalkable(terrainAt(scene, cx, cy, z)));
  };
  const out: PlanDefect[] = [];
  for (const seg of segs) {
    const libres = wallVertices(seg).filter((v) => degree.get(v) === 1 && contournable(v));
    const isole = libres.length === 2;
    for (const v of libres) {
      out.push({
        family: 'mur-en-impasse',
        at: { kind: 'edge', x: seg.x, y: seg.y, side: seg.side, z },
        grid: 'walled',
        message: isole
          ? `Mur en impasse à l’intérieur de la carte — le mur ${seg.side} de (${seg.x},${seg.y}) à l'étage ${z} est ISOLÉ : ses deux coins (dont ${v}) sont libres, en plein plancher. Il ne ferme aucune pièce et se contourne des deux bouts. Chaîne-le aux murs qu'il devait rejoindre, ou retire-le.`
          : `Mur en impasse à l’intérieur de la carte — le mur ${seg.side} de (${seg.x},${seg.y}) à l'étage ${z} finit au coin (${v}) sans rencontrer d'autre mur, en plein plancher : ni bord de grille, ni à-pic n'arrêtent la cloison là. Elle ne ferme aucune pièce — le pas contourne son bout. Prolonge-la jusqu'au mur qu'elle devait rejoindre, ou retire-la.`,
      });
    }
  }
  return out;
}

/** Position d'un défaut d'étage, dans le vocabulaire partagé `PlanDefectAt`. */
function defectAt(d: Defect | ZoneDefect): PlanDefectAt {
  return 'side' in d && d.side
    ? { kind: 'edge', x: d.x, y: d.y, side: d.side, z: d.z }
    : { kind: 'cell', x: d.x, y: d.y, z: d.z };
}

/** Mémo du POINT D'ENTRÉE : clé = identité de la Scène (toute mutation d'état rend une NOUVELLE réf,
 *  cf. `memoByRef`), dépendance = le TÉMOIN du dataset des terrains. Les audits lisent `groundTerrains()`
 *  À L'APPEL pour qu'une entrée retouchée à l'atelier change le verdict sans rechargement : le témoin est
 *  une COPIE du tableau (le binding de `data/index` est muté EN PLACE par `setDataset`, son identité ne
 *  bouge jamais), comparée entrée par entrée — le même témoin que `indexDesTerrains` (`state/terrain`).
 *  Le tableau rendu est PARTAGÉ entre appels : ses consommateurs le lisent, ils ne le mutent pas. */
const planDefectsMemo = memoByRefDeps<Scene, PlanDefect[]>();

/** POINT D'ENTRÉE UNIQUE — toutes les familles, tous les étages. PUR. */
export function scenePlanDefects(scene: Scene): PlanDefect[] {
  return planDefectsMemo(scene, [...tousLesTerrains()], () => buildPlanDefects(scene));
}

function buildPlanDefects(scene: Scene): PlanDefect[] {
  const zoneIndex = descriptiveZoneIndex(scene);
  const out: PlanDefect[] = [];
  for (const [aboveZ, belowZ] of floorPairs(scene)) {
    const supported = supportedFloorCells(scene, aboveZ, belowZ); // un seul parcours pour les familles 3 et 5
    const perFloor: (Defect | ZoneDefect)[] = [
      ...auditFacade(scene, aboveZ, belowZ, true, zoneIndex),
      ...auditZoneCoverage(scene, aboveZ, belowZ, zoneIndex, supported),
      ...auditUnsupportedFloor(scene, aboveZ, belowZ, groundTerrains(), supported),
    ];
    for (const d of perFloor) out.push({ family: d.family, at: defectAt(d), grid: d.grid, message: d.message });
  }
  out.push(...auditZoneFootprint(scene));
  for (const z of scenesZ(scene)) out.push(...auditEnclosureAtBorder(scene, z), ...auditWallDeadEndsAtBorder(scene, z), ...auditWallDeadEndsInside(scene, z), ...auditOrphanDoors(scene, z));
  return out;
}
