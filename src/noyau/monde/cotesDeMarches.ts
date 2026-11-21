/**
 * LES CÔTÉS D'UNE VOLÉE TELS QU'UN HÔTE LES HABILLE (#4471) : pour chaque case de marches de la scène (`dessusDe`,
 * `./volume/pente.ts`), ses deux côtés de travers à l'axe montant (`axeDuDessus`), chacun classé comme la paroi de son
 * arête (`floorFaces`, `./volume/floors.ts`) : un segment posé sur l'arête ou une voisine plus haute le bordent déjà,
 * la marche d'une volée large le prolonge, une voisine rejointe à pied plus basse ou égale, à au plus `STEP_MAX_M`
 * sous chaque bout du bord, le borde d'un limon, une falaise, une case absente ou une voisine plus basse d'un limon et
 * d'une rampe. La pièce monte de la cote lisse du bord à son premier bout à
 * celle de son second (`hauteurLisse`), partagée par la case voisine sur l'axe : limons et rampes se suivent.
 */
import { edgeOf, tileAt, type CellSide, type Scene } from './scene';
import type { Pt } from './path';
import { aretesA } from './wallIndex';
import { inMapBounds } from './zones';
import { terrainBuilt, terrainKitDEscalier } from './terrain';
import { axeDuDessus, dessusDe, displayHeightAt, hauteurLisse, presenteDansLaGrille, rejointAPied } from './volume/pente';
import { NEIGHBOURS } from './volume/floors';
import { blocDeLaCase } from './volume/volume';
import { memoByRef } from './sceneMemo';
import { STEP_MAX_M } from './relief';
import type { KitDEscalier } from '../../data';
import type { PIECES_D_ESCALIER } from './piecesDArete';
import type { PositionDansLOuverture } from './aretes';

/** La pièce qu'un côté de marches porte, l'une de `PIECES_D_ESCALIER`. */
export type PieceDEscalier = (typeof PIECES_D_ESCALIER)[number];

/** Ce qui borde un côté de marches : une voisine rejointe à pied, plus basse ou égale, à au plus `STEP_MAX_M` sous
 *  chaque bout du bord (`rejointe`), ou le vide d'une falaise, d'une case absente ou d'une voisine plus basse (`vide`). */
type ClasseDeCote = 'rejointe' | 'vide';

/** Les pièces de chaque classe de côté. */
const PIECES_DE_LA_CLASSE: Record<ClasseDeCote, readonly PieceDEscalier[]> = { rejointe: ['limon'], vide: ['limon', 'rampe'] };

/** Les côtés de travers à l'axe montant d'une case de marches. */
const COTES_DE_L_AXE: Record<'x' | 'y', readonly CellSide[]> = { x: ['N', 'S'], y: ['E', 'O'] };

/** Un côté de marches tel qu'un hôte l'habille : sa clé, sa case `{ x, y, z }`, son côté, sa classe et ses pièces, les
 *  cotes (m) du bord du dessus à son premier bout (`entree`) et à son second (`sortie`) dans le `sens`, la famille du
 *  kit d'escalier du terrain de sa case (`kitDEscalier` de `terrains.json`), la place de sa rampe dans sa suite de
 *  rampes (`placerLesRampes`) ; et ce que sa pose demande, comme une
 *  arête (`AreteDessinee`, `./aretes.ts`) : les cases de la carte qu'il sépare (la sienne, puis sa voisine), son milieu
 *  et son sens en coins de grille, son dehors (vers la voisine) à `(-sens.y, sens.x)`, son pied (m), la cote de son
 *  milieu, et le bloc de sa case (`blocDeLaCase`). */
export interface CoteDeMarches {
  cle: string;
  case: Required<Pt>;
  cote: CellSide;
  classe: ClasseDeCote;
  pieces: readonly PieceDEscalier[];
  entree: number;
  sortie: number;
  famille: KitDEscalier;
  position: PositionDansLOuverture;
  cases: Required<Pt>[];
  milieu: Pt;
  sens: Pt;
  pied: number;
  bloc: string;
}

/** La classe du côté `cote` de la case (x,y,z) de marches de `scene`, à la hauteur `h`, dont le bord du dessus monte
 *  de la cote `entree` à la cote `sortie` : aucune si un segment est posé sur son arête (`aretesA`), si sa voisine est
 *  une marche qu'on rejoint (volée large) ou plus haute qu'elle ; `vide` pour une voisine qu'on rejoint à pied sous
 *  l'un des bouts de son bord de plus de `STEP_MAX_M`. */
function classeDuCote(scene: Scene, x: number, y: number, z: number, h: number, cote: CellSide, entree: number, sortie: number): ClasseDeCote | null {
  const [dx, dy] = NEIGHBOURS[cote];
  const [nx, ny] = [x + dx, y + dy];
  const arete = edgeOf(x, y, nx, ny)!;
  if (aretesA(scene, arete.x, arete.y, arete.side, z).length > 0) return null;
  if (!presenteDansLaGrille(scene, nx, ny, z)) return 'vide';
  const hv = displayHeightAt(scene, nx, ny, z);
  if (rejointAPied(scene, x, y, nx, ny, z)) {
    if (dessusDe(scene, nx, ny, z).marches || hv > h) return null;
    return Math.max(entree, sortie) - hv > STEP_MAX_M ? 'vide' : 'rejointe';
  }
  return hv < h ? 'vide' : null;
}

/** Les côtés de marches de la case (x,y,z) de `scene`, aucun hors d'une case de marches montant sur un seul axe. */
function cotesDeLaCase(scene: Scene, x: number, y: number, z: number): Omit<CoteDeMarches, 'position'>[] {
  const d = dessusDe(scene, x, y, z);
  const axe = axeDuDessus(d);
  if (!d.marches || !axe) return [];
  return COTES_DE_L_AXE[axe].flatMap((cote): Omit<CoteDeMarches, 'position'>[] => {
    const [dx, dy] = NEIGHBOURS[cote];
    const sens = { x: dy, y: 0 - dx };
    const bout = (s: number) => hauteurLisse(d, dx / 2 + (s * sens.x) / 2, dy / 2 + (s * sens.y) / 2);
    const [entree, sortie] = [bout(-1), bout(1)];
    const classe = classeDuCote(scene, x, y, z, d.h, cote, entree, sortie);
    if (!classe) return [];
    return [{
      cle: `marches|${x},${y},${z}|${cote}`,
      case: { x, y, z },
      cote,
      classe,
      pieces: PIECES_DE_LA_CLASSE[classe],
      entree,
      sortie,
      famille: terrainKitDEscalier(tileAt(scene, x, y, z))!,
      cases: [{ x, y }, { x: x + dx, y: y + dy }].filter((c) => inMapBounds(scene.dimensions, c)).map((c) => ({ ...c, z })),
      milieu: { x: x + dx / 2, y: y + dy / 2 },
      sens,
      pied: (entree + sortie) / 2,
      bloc: blocDeLaCase({ x, y, z }),
    }];
  });
}

/** Les côtés `cotes`, chacun à la place de sa rampe dans sa suite de rampes, celle des côtés à rampe bout à bout de
 *  même côté de case, de même couche et de même famille, rangée dans leur sens commun (`sens`), comme une arête dans
 *  son ouverture : `gauche` au premier, dont le bout -X de la pièce est l'`entree`, `droite` au dernier, `milieu`
 *  entre eux, `seule` pour une rampe sans voisine et pour un côté sans rampe. */
function placerLesRampes(cotes: Omit<CoteDeMarches, 'position'>[]): CoteDeMarches[] {
  const cle = (x: number, y: number, c: Omit<CoteDeMarches, 'position'>) => `${x},${y},${c.case.z}|${c.cote}|${c.famille}`;
  const aRampe = new Set(cotes.filter((c) => c.pieces.includes('rampe')).map((c) => cle(c.case.x, c.case.y, c)));
  return cotes.map((c): CoteDeMarches => {
    const voisine = (s: number) => aRampe.has(cle(c.case.x + s * c.sens.x, c.case.y + s * c.sens.y, c));
    const [avant, apres] = c.pieces.includes('rampe') ? [voisine(-1), voisine(1)] : [false, false];
    return { ...c, position: avant ? (apres ? 'milieu' : 'droite') : apres ? 'gauche' : 'seule' };
  });
}

/** Les côtés de marches de toutes les couches de `scene` (`cotesDeLaCase`), chacun à la place de sa rampe
 *  (`placerLesRampes`), retenus par scène et par la version des datasets (`memoByRef` : les marches et la famille du
 *  kit se lisent au catalogue des terrains). */
export const cotesDeMarchesDeLaScene = memoByRef((scene: Scene): CoteDeMarches[] => {
  const { w, h } = scene.dimensions;
  return placerLesRampes(scene.layers.flatMap(({ z }) => Array.from({ length: w * h }, (_, i) => ({ x: i % w, y: Math.floor(i / w) }))
    .filter(({ x, y }) => terrainBuilt(tileAt(scene, x, y, z)) && presenteDansLaGrille(scene, x, y, z))
    .flatMap(({ x, y }) => cotesDeLaCase(scene, x, y, z))));
});

/** Les côtés de marches de la couche `z` de `scene` (`cotesDeMarchesDeLaScene`). */
export const cotesDeMarchesDeLaCouche = (scene: Scene, z: number): CoteDeMarches[] => cotesDeMarchesDeLaScene(scene).filter((c) => c.case.z === z);
