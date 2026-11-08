/**
 * LES ARÊTES TELLES QU'UN HÔTE LES DESSINE (#3476, lot C) : pour chaque mur de la scène, où le poser (sa case, son
 * milieu et son sens), d'où elle se dresse (`piedDeLArete`), quelle pièce du kit 3D y va (`PieceDArete`), de quelle
 * famille (`StructureAppearanceDef.kit`, par l'apparence de l'arête, `apparenceDArete`), et à quelle hauteur.
 */
import { structureAppearances } from '../../data';
import type { FamilleDuKit, StructureAppearanceDef } from '../../data/structureAppearance.types';
import { apparenceDArete, edgeKey, facadeEdges } from './facades';
import type { Pt } from './path';
import { EYE_H } from './iso';
import { METRES_PER_LEVEL } from './relief';
import { casesDeFace, piedDeLArete, porteEnJeu, sceneMetresPerTile, structureIsDown, wallEnds, wallIsOpen, type Scene, type WallSeg } from './scene';
import type { Rot } from '../../geometry/iso';
import { cutawayOverhead, frontFacadeCutaway, type ClearedSpace } from './volume/architectureVisibility';
import { clearedSpace } from './volume/toits';
import { toitsLeves, toutesLesNappes, volumeDuMonde, type VolumeDuMonde } from './volume/volume';
import { aretesHorsDesNavires } from '../planDeNavire';

/** La pièce qu'une arête porte : un mur plein, une porte fermée ou ouverte, une fenêtre aux volets ouverts ou clos, ou
 *  la brèche d'une structure abattue. */
export type PieceDArete = 'mur' | 'porte-fermee' | 'porte-ouverte' | 'fenetre' | 'fenetre-close' | 'breche';

/** Une arête telle qu'un hôte la dessine : sa clé (`edgeKey`), la case du segment, son milieu et son sens en coins de
 *  grille (`wallEnds`), la hauteur (m) d'où elle se dresse (`piedDeLArete`), sa pièce, la famille du kit de son apparence
 *  (`null` pour une apparence hors du catalogue), et sa hauteur en mètres (`wallHeightM`, sinon un étage). */
export interface AreteDessinee { cle: string; case: Pt; milieu: Pt; sens: Pt; pied: number; piece: PieceDArete; famille: FamilleDuKit | null; hauteurM: number }

/** Une arête que le groupe dégage : sa clé (`edgeKey`) et les crans de caméra (`Rot`, `Dims.rot`) sous lesquels elle
 *  tombe : tous si l'une des cases qu'elle sépare est au-dessus de la tête d'un allié (`cutawayOverhead`), sinon ceux
 *  où elle se dresse entre la caméra et l'espace dégagé qu'elle borde (`frontFacadeCutaway`). */
export interface AreteDegagee { cle: string; abattueSous: Rot[] }

const CRANS: readonly Rot[] = [0, 1, 2, 3];

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
    cle: edgeKey(seg),
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

/** Les clés (`edgeKey`) des couronnes crénelées de `scene` (`couronnesDuMonde`) tombées avec leur mur abattu
 *  (`structureIsDown`) ; celle d'un corps de garde (`door`) reste sur le linteau de son passage. */
function couronnesAbattues(scene: Scene, dessinees: readonly WallSeg[]): string[] {
  return dessinees.filter((seg) => {
    const apparence = APPARENCES.get(apparenceDArete(scene, seg));
    return !!apparence?.parapet && !apparence.door && !!seg.structure && structureIsDown(scene, seg);
  }).map(edgeKey);
}

/** Les arêtes de `scene` que l'espace dégagé `cleared` (`clearedSpace`, la loi de `architectureVisibility`) abat :
 *  celles au-dessus de la tête d'un allié, et celles qui bordent l'espace où il se tient. */
function aretesDegagees(scene: Scene, dessinees: readonly WallSeg[], cleared: ClearedSpace): AreteDegagee[] {
  const facades = facadeEdges(scene);
  const { w, h } = scene.dimensions;
  return dessinees.flatMap((seg): AreteDegagee[] => {
    const cle = edgeKey(seg);
    const panneau = { ...seg, roomZoneIds: facades.get(cle)?.roomZoneIds };
    const abattueSous = casesDeFace(seg, 'les-deux').some((c) => cutawayOverhead({ ...c, z: seg.z }, cleared))
      ? [...CRANS]
      : CRANS.filter((rot) => frontFacadeCutaway(panneau, cleared, { w, h, rot }));
    return abattueSous.length ? [{ cle, abattueSous }] : [];
  });
}

/** Le regard qu'un hôte porte sur le plateau (#3476) : à la verticale, comme sur un plateau de jeu (`plateau`) ; de
 *  biais, à la suite du groupe (`tactique`) ; aux yeux du meneur (`immersion`). `REGARDS` les range dans l'ordre où
 *  l'hôte les fait défiler. */
export type Regard = 'plateau' | 'tactique' | 'immersion';
export const REGARDS: readonly Regard[] = ['tactique', 'plateau', 'immersion'];

/** Le regard que le jeu tient pour le regard `voulu` : l'immersion, qui marche avec le groupe en exploration, cède
 *  à la tactique le temps d'un combat. PUR. */
export function regardDuJeu(voulu: Regard, enCombat: boolean): Regard {
  return voulu === 'immersion' && enCombat ? 'tactique' : voulu;
}

/** La couche la plus haute où se tient un allié de `allies` : celle que le regard `plateau` montre, rien au-dessus. */
const coucheDuGroupe = (allies: readonly Pt[]): number => Math.max(0, ...allies.map((a) => a.z ?? 0));

/** Ce que le regard `regard` retire du volume du monde pour le groupe posé sur `allies` : au plateau, les couches
 *  au-dessus de la sienne (`activeZ`) ; en tactique, le couvercle au-dessus de sa tête (`clearedSpace`,
 *  `overheadCells`, ses cases `x,y,z`) ; en immersion, rien. */
function retraitDuRegard(scene: Scene, allies: readonly Pt[], regard: Regard): { activeZ?: number; couvercle: ReadonlySet<string> } {
  if (regard === 'plateau') return { activeZ: coucheDuGroupe(allies), couvercle: new Set() };
  return { couvercle: regard === 'tactique' ? clearedSpace(scene, allies).overheadCells : new Set() };
}

/** Le volume du monde de `scene` (`volumeDuMonde`) sous le regard `regard`, sans ce qu'il retire pour le groupe posé
 *  sur `allies` (`retraitDuRegard`). PUR. */
export function volumeDuRegard(scene: Scene, allies: readonly Pt[], regard: Regard): VolumeDuMonde {
  const { activeZ, couvercle } = retraitDuRegard(scene, allies, regard);
  return volumeDuMonde(scene, activeZ, couvercle);
}

/** Le plateau d'une scène tel qu'un hôte le dessine sous le regard `regard` : ses dimensions, les arêtes de toutes ses
 *  couches hors des ponts de ses navires (`aretesHorsDesNavires`, `areteDessinee`), son échelle métrique (`sceneMetresPerTile`), la hauteur de l'œil au-dessus du sol
 *  (`EYE_H`), le regard et celui qui le suit dans `REGARDS`, la clé du volume que le regard demande (`cleDuMonde`, qui change quand `volumeDuRegard` ou `meteoDuRegard` changent), ce que
 *  le regard retire pour le groupe posé sur `allies` : les nappes de toit (`toitsLeves` : en tactique, celles qu'il
 *  dégage ; au plateau, toutes) et les arêtes (`aretesDegagees` : en tactique, celles qu'il dégage ; au plateau,
 *  celles des couches au-dessus de la sienne, sous tout cran) ; et les couronnes crénelées tombées
 *  (`couronnesAbattues`). */
export function plateauDeLaScene(scene: Scene, allies: readonly Pt[], regard: Regard): { w: number; h: number; metresParCase: number; oeilM: number; regard: Regard; regardSuivant: Regard; cleDuMonde: string; aretes: AreteDessinee[]; aretesDegagees: AreteDegagee[]; toitsLeves: string[]; couronnesAbattues: string[] } {
  const { w, h } = scene.dimensions;
  const { activeZ, couvercle } = retraitDuRegard(scene, allies, regard);
  const dessinees = aretesHorsDesNavires(scene);
  const aretesRetirees = (): AreteDegagee[] => {
    if (regard === 'tactique') return aretesDegagees(scene, dessinees, clearedSpace(scene, allies));
    if (regard === 'immersion') return [];
    return dessinees.filter((seg) => (seg.z ?? 0) > coucheDuGroupe(allies)).map((seg) => ({ cle: edgeKey(seg), abattueSous: [...CRANS] }));
  };
  return {
    w, h, metresParCase: sceneMetresPerTile(scene), oeilM: EYE_H, regard, regardSuivant: REGARDS[(REGARDS.indexOf(regard) + 1) % REGARDS.length],
    cleDuMonde: [regard, scene.weather ?? '', activeZ ?? '', ...couvercle].join('|'),
    aretes: dessinees.map((seg) => areteDessinee(scene, seg)), aretesDegagees: aretesRetirees(),
    toitsLeves: regard === 'tactique' ? toitsLeves(scene, allies) : regard === 'plateau' ? toutesLesNappes(scene) : [],
    couronnesAbattues: couronnesAbattues(scene, dessinees),
  };
}
