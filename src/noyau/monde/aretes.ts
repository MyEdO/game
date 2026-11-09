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
import { casesDeFace, heightAt, piedDeLArete, porteEnJeu, sceneMetresPerTile, structureIsDown, wallEnds, wallIsOpen, type Scene, type WallSeg } from './scene';
import type { Rot } from '../../geometry/iso';
import { cutawayOverhead, frontFacadeCutaway, type ClearedSpace } from './volume/architectureVisibility';
import { clearedSpace } from './volume/toits';
import { empreinteDesDecors, toitsLeves, toutesLesNappes, volumeDuMonde, type VolumeDuMonde } from './volume/volume';
import { aretesHorsDesNavires, provenanceDesNavires } from '../planDeNavire';

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

/** Ce qu'un regard retire du volume du monde : les couches au-dessus de `activeZ`, les cases du `couvercle` (clés
 *  `x,y,z`) ; et, par id de navire, la hauteur (m) de sa coupe. */
interface RetraitDuRegard {
  activeZ?: number;
  couvercle: ReadonlySet<string>;
  coupes: Record<string, number>;
}

/** Ce que le regard `regard` retire du volume du monde pour le groupe posé sur `allies` : au plateau, les couches
 *  au-dessus de la sienne (`activeZ`) ; en tactique, le couvercle au-dessus de sa tête (`clearedSpace`,
 *  `overheadCells`, ses cases `x,y,z`) ; en immersion, rien. Un navire dont il ôte des cases de ses ponts
 *  (`provenanceDesNavires`) est coupé au plus bas de leurs sols (`coupes`, en mètres) : son modèle ne montre rien de cette
 *  hauteur et au-dessus, et le volume rien des cases de ses ponts aux couches au-dessus du groupe dont le sol y est. */
function retraitDuRegard(scene: Scene, allies: readonly Pt[], regard: Regard): RetraitDuRegard {
  const activeZ = regard === 'plateau' ? coucheDuGroupe(allies) : undefined;
  const couvercle = regard === 'tactique' ? clearedSpace(scene, allies).overheadCells : new Set<string>();
  const ponts = [...provenanceDesNavires(scene).cases].map(([cle, navire]) => {
    const [x, y, z] = cle.split(',').map(Number);
    return { cle, navire, z, sol: heightAt(scene, x, y, z) };
  });
  const coupes: Record<string, number> = {};
  for (const { cle, navire, z, sol } of ponts)
    if ((activeZ !== undefined && z > activeZ) || couvercle.has(cle)) coupes[navire] = Math.min(coupes[navire] ?? Infinity, sol);
  const sousLaCoupe = ponts.filter(({ navire, z, sol }) => z > coucheDuGroupe(allies) && sol >= (coupes[navire] ?? Infinity)).map(({ cle }) => cle);
  return { ...(activeZ !== undefined ? { activeZ } : {}), couvercle: new Set([...couvercle, ...sousLaCoupe]), coupes };
}

/** Le volume du monde de `scene` (`volumeDuMonde`) sous le regard `regard`, sans ce qu'il retire pour le groupe posé
 *  sur `allies` (`retraitDuRegard`). PUR. */
export function volumeDuRegard(scene: Scene, allies: readonly Pt[], regard: Regard): VolumeDuMonde {
  const { activeZ, couvercle } = retraitDuRegard(scene, allies, regard);
  return volumeDuMonde(scene, activeZ, couvercle);
}

/**
 * @contrat Vue
 * Le plateau de la scène (`plateauDeLaScene`, `src/noyau/monde/aretes.ts`). Le regard retire pour le groupe posé sur
 * ses cases (chaque héros posé en combat, sinon la case du groupe, `casesDuGroupe`) : en tactique, par la loi de
 * dégagement (`clearedSpace`, `src/noyau/monde/volume/toits.ts`), les nappes de toit qui couvrent l'espace où il se
 * tient, le couvercle au-dessus de sa tête (`overheadCells` : les masses qui le surplombent et l'emprise de sa pièce
 * aux couches au-dessus de la sienne) et les arêtes qu'il dégage ; au plateau, toutes les nappes de toit, et les
 * couches au-dessus de la plus haute où il se tient, volume et arêtes ; en immersion, rien.
 */
export interface PlateauDeLaScene {
  /** ses dimensions : sa largeur, en cases. */
  w: number;
  /** ses dimensions : sa hauteur, en cases. */
  h: number;
  /** son échelle en mètres par case (lue de la scène par `sceneMetresPerTile`, LDB 15 l.12). */
  metresParCase: number;
  /** la hauteur de l'œil au-dessus du sol (`EYE_H`). */
  oeilM: number;
  /** le regard de la partie (`regarder`, `regardDuJeu` : l'immersion cède à la tactique le temps d'un combat). */
  regard: Regard;
  /** celui qui le suit dans `REGARDS`. */
  regardSuivant: Regard;
  /**
   * La clé du volume que le regard demande change quand ce qu'il retire du volume change, et quand un décor de la scène
   * naît, sort ou change en jeu (`empreinteDesDecors`, `src/noyau/monde/volume/volume.ts` : un objet posé au sol, un
   * coffre vidé) : le jeu rappelle alors `monde`.
   */
  cleDuMonde: string;
  /**
   * les arêtes de toutes ses couches hors des ponts de ses navires, que la marche garde et que le modèle du navire
   * montre (`aretesHorsDesNavires`, `src/noyau/planDeNavire.ts`) (chacune `areteDessinee` :
   * `{ cle, case, milieu, sens, pied, piece, famille, hauteurM }`, sa clé `edgeKey`, la case dont elle borde un côté,
   * son milieu et le sens où elle court, en coins de grille (`wallEnds`) ; la hauteur en mètres d'où elle se dresse,
   * celle de la plus basse des deux cases qu'elle sépare (`piedDeLArete`, `src/noyau/monde/scene.ts`) ; sa pièce : une
   * porte en jeu fermée ou ouverte, la brèche d'une structure abattue, une fenêtre aux volets ouverts ou clos, sinon un
   * mur ; la famille du kit de son apparence (`kit` de `structureAppearance.json`, l'apparence étant celle du mur de la
   * façade authorée qui régit l'arête, sinon celle du segment : `apparenceDArete`, `src/noyau/monde/facades/`), `null`
   * pour une apparence hors du catalogue ; la hauteur de son mur en mètres, `wallHeightM` sinon un étage).
   */
  aretes: AreteDessinee[];
  /**
   * les arêtes retirées (`{ cle, abattueSous }`, les crans de caméra (`Rot`, `src/geometry/iso.ts` : 0 au sud-est, puis
   * sud-ouest, nord-ouest, nord-est) sous lesquels chacune tombe : tous pour celles d'une couche retirée et celles dont
   * une case qu'elles séparent est au couvercle, `cutawayOverhead`, et, pour celles qui bordent l'espace où il se
   * tient, ceux où elles se dressent entre la caméra et cet espace, `frontFacadeCutaway`,
   * `src/noyau/monde/volume/architectureVisibility.ts`).
   */
  aretesDegagees: AreteDegagee[];
  /** les nappes retirées (la clé `nappeKey` de chacune). */
  toitsLeves: string[];
  /**
   * les couronnes crénelées tombées avec leur mur abattu (la clé `edgeKey` de chacune ; celle d'un corps de garde
   * reste).
   */
  couronnesAbattues: string[];
  /**
   * Un navire de la scène dont le regard retire des ponts (une couche au-dessus du groupe au plateau, une case du
   * couvercle en tactique) se coupe à la hauteur du sol le plus bas de ceux-là (en mètres, par l'id de son entité ;
   * aucun en immersion), et le volume perd avec eux les cases des ponts au-dessus de la couche du groupe dont le sol
   * est à cette hauteur ou plus haut (`retraitDuRegard`), pour qu'aucun décor ni sol de pont ne flotte au-dessus de la
   * coupe.
   */
  coupesDesNavires: Record<string, number>;
}

/**
 * Le plateau d'une scène tel qu'un hôte le dessine sous le regard `regard` : ses dimensions, les arêtes de toutes ses
 * couches hors des ponts de ses navires (`aretesHorsDesNavires`, `areteDessinee`), son échelle métrique
 * (`sceneMetresPerTile`), la hauteur de l'œil au-dessus du sol (`EYE_H`), le regard et celui qui le suit dans
 * `REGARDS`, la clé du volume que le regard demande (`cleDuMonde`, qui change quand `volumeDuRegard` ou `meteoDuRegard`
 * changent, décors posés ou retirés en jeu compris : `empreinteDesDecors`), ce que le regard retire pour le groupe posé
 * sur `allies` : les nappes de toit (`toitsLeves` : en tactique, celles qu'il dégage ; au plateau, toutes), les arêtes
 * (`aretesDegagees` : en tactique, celles qu'il dégage ; au plateau, celles des couches au-dessus de la sienne, sous
 * tout cran) et le haut des navires (`coupesDesNavires`, la hauteur de la coupe de chacun, `retraitDuRegard`) ; et les
 * couronnes crénelées tombées (`couronnesAbattues`).
 */
export function plateauDeLaScene(scene: Scene, allies: readonly Pt[], regard: Regard): PlateauDeLaScene {
  const { w, h } = scene.dimensions;
  const { activeZ, couvercle, coupes } = retraitDuRegard(scene, allies, regard);
  const dessinees = aretesHorsDesNavires(scene);
  const aretesRetirees = (): AreteDegagee[] => {
    if (regard === 'tactique') return aretesDegagees(scene, dessinees, clearedSpace(scene, allies));
    if (regard === 'immersion') return [];
    return dessinees.filter((seg) => (seg.z ?? 0) > coucheDuGroupe(allies)).map((seg) => ({ cle: edgeKey(seg), abattueSous: [...CRANS] }));
  };
  return {
    w, h, metresParCase: sceneMetresPerTile(scene), oeilM: EYE_H, regard, regardSuivant: REGARDS[(REGARDS.indexOf(regard) + 1) % REGARDS.length],
    cleDuMonde: [regard, scene.weather ?? '', activeZ ?? '', empreinteDesDecors(scene), ...couvercle].join('|'),
    aretes: dessinees.map((seg) => areteDessinee(scene, seg)), aretesDegagees: aretesRetirees(),
    toitsLeves: regard === 'tactique' ? toitsLeves(scene, allies) : regard === 'plateau' ? toutesLesNappes(scene) : [],
    couronnesAbattues: couronnesAbattues(scene, dessinees),
    coupesDesNavires: coupes,
  };
}
