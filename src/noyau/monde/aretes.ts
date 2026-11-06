/**
 * LES ARÊTES TELLES QU'UN HÔTE LES DESSINE (#3476, lot C) : pour chaque mur de la scène, où le poser (sa case, son
 * milieu et son sens), d'où elle se dresse (`piedDeLArete`), quelle pièce du kit 3D y va (`PieceDArete`), de quelle
 * famille (`StructureAppearanceDef.kit`, par l'apparence de l'arête, `apparenceDArete`), et à quelle hauteur.
 */
import { structureAppearances } from '../../data';
import type { FamilleDuKit, StructureAppearanceDef } from '../../data/structureAppearance.types';
import { apparenceDArete, edgeKey } from './facades';
import type { Pt } from './path';
import { METRES_PER_LEVEL } from './relief';
import { piedDeLArete, porteEnJeu, sceneMetresPerTile, structureIsDown, wallEnds, wallIsOpen, type Scene, type WallSeg } from './scene';
import { toitsLeves } from './volume/volume';

/** La pièce qu'une arête porte : un mur plein, une porte fermée ou ouverte, une fenêtre aux volets ouverts ou clos, ou
 *  la brèche d'une structure abattue. */
export type PieceDArete = 'mur' | 'porte-fermee' | 'porte-ouverte' | 'fenetre' | 'fenetre-close' | 'breche';

/** Une arête telle qu'un hôte la dessine : la case du segment, son milieu et son sens en coins de grille (`wallEnds`),
 *  la hauteur (m) d'où elle se dresse (`piedDeLArete`), sa pièce, la famille du kit de son apparence (`null` pour une
 *  apparence hors du catalogue), et sa hauteur en mètres
 *  (`wallHeightM`, sinon un étage). */
export interface AreteDessinee { case: Pt; milieu: Pt; sens: Pt; pied: number; piece: PieceDArete; famille: FamilleDuKit | null; hauteurM: number }

const APPARENCES: ReadonlyMap<string, StructureAppearanceDef> = new Map(structureAppearances.map((a) => [a.id, a]));

/** La pièce de l'arête du segment `seg` de `scene` : une porte en jeu (`porteEnJeu`) ouverte si elle laisse passer
 *  (`wallIsOpen`), une brèche pour tout autre segment qui laisse passer, une fenêtre (`window`, `shuttered`), sinon un
 *  mur. */
function pieceDArete(scene: Scene, seg: WallSeg): PieceDArete {
  const ouverte = wallIsOpen(scene, seg);
  if (porteEnJeu(scene, seg)) return ouverte ? 'porte-ouverte' : 'porte-fermee';
  if (ouverte) return 'breche';
  if (seg.window) return seg.shuttered ? 'fenetre-close' : 'fenetre';
  return 'mur';
}

/** L'arête dessinée du segment `seg` de `scene`. */
export function areteDessinee(scene: Scene, seg: WallSeg): AreteDessinee {
  const [a, b] = wallEnds(seg);
  const apparence = APPARENCES.get(apparenceDArete(scene, seg));
  return {
    case: { x: seg.x, y: seg.y },
    milieu: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    sens: { x: b.x - a.x, y: b.y - a.y },
    pied: piedDeLArete(scene, seg),
    piece: pieceDArete(scene, seg),
    famille: apparence?.kit ?? null,
    hauteurM: apparence?.wallHeightM ?? METRES_PER_LEVEL,
  };
}

/** Les arêtes dessinées de la couche `z` de `scene`. */
export function aretesDeLaCouche(scene: Scene, z: number): AreteDessinee[] {
  return (scene.walls ?? []).filter((seg) => (seg.z ?? 0) === z).map((seg) => areteDessinee(scene, seg));
}

/** Les clés (`edgeKey`) des couronnes crénelées de la couche `z` de `scene` (`couronnesDeLaCouche`) tombées avec leur
 *  mur abattu (`structureIsDown`) ; celle d'un corps de garde (`door`) reste sur le linteau de son passage. */
function couronnesAbattues(scene: Scene, z: number): string[] {
  return (scene.walls ?? []).filter((seg) => {
    const apparence = APPARENCES.get(apparenceDArete(scene, seg));
    return (seg.z ?? 0) === z && !!apparence?.parapet && !apparence.door && !!seg.structure && structureIsDown(scene, seg);
  }).map(edgeKey);
}

/** Le plateau d'une scène tel qu'un hôte le dessine : ses dimensions, les arêtes de sa couche de base
 *  (`aretesDeLaCouche`), son échelle métrique (`sceneMetresPerTile`), les nappes de toit que le groupe posé sur
 *  `allies` dégage (`toitsLeves`) et les couronnes crénelées tombées (`couronnesAbattues`). */
export function plateauDeLaScene(scene: Scene, allies: readonly Pt[]): { w: number; h: number; metresParCase: number; aretes: AreteDessinee[]; toitsLeves: string[]; couronnesAbattues: string[] } {
  const { w, h } = scene.dimensions;
  return { w, h, metresParCase: sceneMetresPerTile(scene), aretes: aretesDeLaCouche(scene, 0), toitsLeves: toitsLeves(scene, allies), couronnesAbattues: couronnesAbattues(scene, 0) };
}
