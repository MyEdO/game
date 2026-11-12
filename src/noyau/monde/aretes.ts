/**
 * LES ARÊTES TELLES QU'UN HÔTE LES DESSINE (#3476, lot C) : pour chaque mur de la scène, où le poser (sa case, son
 * milieu et son sens), d'où elle se dresse (`piedDeLArete`), quelle pièce du kit 3D y va (`PieceDArete`), de quelle
 * famille (`StructureAppearanceDef.kit`, par l'apparence de l'arête, `apparenceDArete`), et à quelle hauteur.
 */
import { structureAppearances } from '../../data';
import type { FamilleDuKit, StructureAppearanceDef } from '../../data/structureAppearance.types';
import { apparenceDArete, edgeKey, facadeEdges } from './facades';
import { walkNeighbors, type Pt } from './path';
import { inMapBounds } from './zones';
import { EYE_H, hauteurDeLOeil } from './iso';
import { METRES_PER_LEVEL } from './relief';
import { casesDeFace, heightAt, isWalkable, piedDeLArete, porteEnJeu, sceneMetresPerTile, structureIsDown, tuilesEffondreesSignature, wallEnds, wallIsOpen, type Scene, type WallSeg } from './scene';
import { memoByRef, memoByRefDeps } from './sceneMemo';
import { hash32, hash32AuMillieme } from '../../data/hash';
import { jsonCanonique } from '../../lib/jsonCanonique.mjs';
import { spaceCellKey } from './volume/architectureVisibility';
import type { Rot } from '../../geometry/iso';
import { cutawayOverhead, frontFacadeCutaway, type ClearedSpace } from './volume/architectureVisibility';
import { clearedSpace } from './volume/toits';
import { blocDeLaCase, empreinteDesDecors, octetsDuRetrait, retraitDuMonde, toitsLeves, toutesLesNappes, type RetraitDuMonde } from './volume/volume';
import { meteoDuRegard } from './meteo';
import { aretesHorsDesNavires, provenanceDesNavires } from '../planDeNavire';

/** La pièce qu'une arête porte : un mur plein, une porte fermée ou ouverte, une fenêtre aux volets ouverts ou clos, ou
 *  la brèche d'une structure abattue. */
export type PieceDArete = 'mur' | 'porte-fermee' | 'porte-ouverte' | 'fenetre' | 'fenetre-close' | 'breche';

/** Une arête telle qu'un hôte la dessine : sa clé (`edgeKey`), les cases de la carte qu'elle sépare à sa couche
 *  (`casesDeFace`, `inMapBounds` : une ou deux), son milieu et son sens en coins de grille (`wallEnds`), la hauteur
 *  (m) d'où elle se dresse (`piedDeLArete`), sa pièce, la famille du kit de son apparence (`null` pour une apparence
 *  hors du catalogue), sa hauteur en mètres (`wallHeightM`, sinon un étage), et le bloc de la case du segment à sa
 *  couche (`blocDeLaCase`). */
export interface AreteDessinee { cle: string; cases: Required<Pt>[]; milieu: Pt; sens: Pt; pied: number; piece: PieceDArete; famille: FamilleDuKit | null; hauteurM: number; bloc: string }

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
  const z = seg.z ?? 0;
  return {
    cle: edgeKey(seg),
    cases: casesDeFace(seg, 'les-deux').filter((c) => inMapBounds(scene.dimensions, c)).map((c) => ({ ...c, z })),
    milieu: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    sens: { x: b.x - a.x, y: b.y - a.y },
    pied: piedDeLArete(scene, seg),
    piece: pieceDArete(scene, seg),
    famille: apparence?.kit ?? null,
    hauteurM: apparence?.wallHeightM ?? METRES_PER_LEVEL,
    bloc: blocDeLaCase({ x: seg.x, y: seg.y, z }),
  };
}

/** Les arêtes dessinées de la couche `z` de `scene`, hors des ponts de ses navires, que leur modèle montre
 *  (`aretesHorsDesNavires`). */
export function aretesDeLaCouche(scene: Scene, z: number): AreteDessinee[] {
  return aretesHorsDesNavires(scene).filter((seg) => (seg.z ?? 0) === z).map((seg) => areteDessinee(scene, seg));
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

/** Le sol (m) de la case d'un allié (`heightAt`). */
const piedDe = (scene: Scene, a: Pt): number => heightAt(scene, a.x, a.y, a.z ?? 0);

/** La couche la plus haute où se tient un allié de `allies` : celle que le regard `plateau` montre, rien au-dessus.
 *  Un allié dont un voisin de marche (`walkNeighbors`) est d'une couche plus haute, à un sol qui ne dépasse pas le sien
 *  (le haut d'une échelle de trappe, au niveau du pont du dessus), se tient à la couche de ce voisin. */
const coucheDuGroupe = (scene: Scene, allies: readonly Pt[]): number => Math.max(0, ...allies.map((a) => Math.max(a.z ?? 0,
  ...walkNeighbors(scene, a).filter((n) => (n.z ?? 0) > (a.z ?? 0) && piedDe(scene, n) <= piedDe(scene, a)).map((n) => n.z ?? 0))));

/** Ce qu'un regard retire du volume du monde : les couches au-dessus de `activeZ`, les cases du `couvercle` (clés
 *  `x,y,z`) ; et, par id de navire, la hauteur (m) de sa coupe. */
interface RetraitDuRegard {
  activeZ?: number;
  couvercle: ReadonlySet<string>;
  coupes: Record<string, number>;
}

/** Ce que le regard `regard` retire du volume du monde pour le groupe posé sur `allies` : au plateau, les couches
 *  au-dessus de la sienne (`activeZ`) ; en tactique, le couvercle au-dessus de sa tête (`clearedSpace`,
 *  `overheadCells`, ses cases `x,y,z` dont le sol dépasse le pied le plus haut du groupe) ; en immersion, rien. Un navire dont il ôte des cases de ses ponts
 *  (`provenanceDesNavires`) est coupé au plus bas de leurs sols (`coupes`, en mètres) : son modèle ne montre rien de cette
 *  hauteur et au-dessus, et le volume rien des cases de ses ponts aux couches au-dessus du groupe dont le sol y est. */
function retraitDuRegard(scene: Scene, allies: readonly Pt[], regard: Regard): RetraitDuRegard {
  const couche = coucheDuGroupe(scene, allies);
  const activeZ = regard === 'plateau' ? couche : undefined;
  const pied = Math.max(-Infinity, ...allies.map((a) => piedDe(scene, a)));
  const auDessus = (cle: string): boolean => { const [x, y, z] = cle.split(',').map(Number); return heightAt(scene, x, y, z) > pied; };
  const couvercle = regard === 'tactique' ? new Set([...clearedSpace(scene, allies).overheadCells].filter(auDessus)) : new Set<string>();
  const ponts = [...provenanceDesNavires(scene).cases].map(([cle, navire]) => {
    const [x, y, z] = cle.split(',').map(Number);
    return { cle, navire, z, sol: heightAt(scene, x, y, z) };
  });
  const coupes: Record<string, number> = {};
  for (const { cle, navire, z, sol } of ponts)
    if ((activeZ !== undefined && z > activeZ) || couvercle.has(cle)) coupes[navire] = Math.min(coupes[navire] ?? Infinity, sol);
  const sousLaCoupe = ponts.filter(({ navire, z, sol }) => z > couche && sol >= (coupes[navire] ?? Infinity)).map(({ cle }) => cle);
  return { ...(activeZ !== undefined ? { activeZ } : {}), couvercle: new Set([...couvercle, ...sousLaCoupe]), coupes };
}

/** Le masque de ce que le regard `regard` retire du volume du monde de `scene` (`retraitDuMonde`) pour le groupe posé
 *  sur `allies` (`retraitDuRegard`). PUR. */
export function masqueDuRegard(scene: Scene, allies: readonly Pt[], regard: Regard): RetraitDuMonde {
  const { activeZ, couvercle } = retraitDuRegard(scene, allies, regard);
  return retraitDuMonde(scene, activeZ, couvercle);
}

/** L'empreinte de ce que `provenanceDesNavires` rend de `scene` : les cases, les arêtes et la flottaison de chaque
 *  navire posé. */
const empreinteDesNavires = (scene: Scene): string => {
  const { cases, aretes, flottaison } = provenanceDesNavires(scene);
  return jsonCanonique([[...cases], [...aretes], [...flottaison]]);
};

/** La clé du monde de `scene` (`PlateauDeLaScene.cleDuMonde`) sous chaque regard : l'empreinte de ce qui ne tient qu'à
 *  la scène (ses décors, `empreinteDesDecors`, ses tuiles effondrées, `tuilesEffondreesSignature`, ses navires posés,
 *  `empreinteDesNavires`), poursuivie par celle de la météo que le regard montre (`meteoDuRegard`). Mémoïsée par scène,
 *  chaque regard au premier appel. */
const clesDuMonde = memoByRef((scene: Scene): ((regard: Regard) => string) => {
  const deLaScene = hash32(empreinteDesDecors(scene), tuilesEffondreesSignature(scene), empreinteDesNavires(scene));
  const parRegard = new Map<Regard, string>();
  return (regard) => parRegard.get(regard) ?? parRegard.set(regard, hash32(deLaScene, jsonCanonique(meteoDuRegard(scene, regard))).toString(36)).get(regard)!;
});

/** La hauteur de l'œil de chaque case marchable de `scene` où elle est plus basse que debout (`hauteurDeLOeil`), par
 *  sa clé `x,y,z` (`spaceCellKey`). Mémoïsée par scène. */
const oeilsSousPlafond = memoByRef((scene: Scene): Record<string, number> => {
  const { w, h } = scene.dimensions;
  const oeils: Record<string, number> = {};
  for (const { z } of scene.layers)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!isWalkable(scene, x, y, z)) continue;
        const oeil = hauteurDeLOeil(scene, { x, y, z });
        if (oeil < EYE_H) oeils[spaceCellKey(x, y, z)] = oeil;
      }
  return oeils;
});

/**
 * @contrat Vue
 * Le plateau de la scène (`plateauDeLaScene`, `src/noyau/monde/aretes.ts`). Le regard retire pour le groupe posé sur
 * ses cases (chaque héros posé en combat, sinon la case du groupe, `casesDuGroupe`) : en tactique, par la loi de
 * dégagement (`clearedSpace`, `src/noyau/monde/volume/toits.ts`), les nappes de toit qui couvrent l'espace où il se
 * tient, le couvercle au-dessus de sa tête (`overheadCells` : les masses qui le surplombent et l'emprise de sa pièce
 * aux couches au-dessus de la sienne) et les arêtes qu'il dégage ; au plateau, toutes les nappes de toit, et les
 * couches au-dessus de la plus haute où il se tient, arêtes et cases du volume ; en immersion, rien. Les cases du
 * volume qu'il retire, le masque du retrait les nomme (`retrait`, section « Monde ») ; le volume, lui, ne dépend que
 * de la scène.
 */
export interface PlateauDeLaScene {
  /** ses dimensions : sa largeur, en cases. */
  w: number;
  /** ses dimensions : sa hauteur, en cases. */
  h: number;
  /** son échelle en mètres par case (lue de la scène par `sceneMetresPerTile`, LDB 15 l.12). */
  metresParCase: number;
  /** la hauteur de l'œil au-dessus du sol, debout (`EYE_H`). */
  oeilM: number;
  /**
   * la hauteur de l'œil de chaque case marchable où elle est plus basse, par la clé `x,y,z` de la case
   * (`hauteurDeLOeil`, `src/noyau/monde/iso.ts`) : sous le plus bas des plafonds (le plus bas des sols posés plus haut
   * que le sien sur une couche au-dessus, dans sa colonne) de la case et des cases où un pas la mène (`walkNeighbors`),
   * de `MARGE_SOUS_PLAFOND_M`, l'œil qui marche vers une case basse s'abaissant dès la case d'avant.
   */
  oeilsSousPlafond: Record<string, number>;
  /** le regard de la partie (`regarder`, `regardDuJeu` : l'immersion cède à la tactique le temps d'un combat). */
  regard: Regard;
  /** celui qui le suit dans `REGARDS`. */
  regardSuivant: Regard;
  /**
   * La clé du monde, une empreinte (`hash32`) de ce que `monde` rendrait de neuf, change quand la météo que le regard
   * montre change (`meteoDuRegard`, `src/noyau/monde/meteo.ts` : un regard ou une météo changés sans météo à montrer,
   * en intérieur, ne la changent pas), quand un décor naît, sort ou change en jeu (`empreinteDesDecors`,
   * `src/noyau/monde/volume/volume.ts` : un objet posé au sol, un coffre vidé), quand une tuile s'effondre
   * (`tuilesEffondreesSignature`) et quand un navire bouge (`provenanceDesNavires`) : le jeu rappelle alors `monde`.
   */
  cleDuMonde: string;
  /**
   * La clé du retrait, l'empreinte (`hash32AuMillieme`, `src/data/hash.ts`, en base 36) des octets du masque que le
   * regard retire pour le groupe (`masqueDuRegard`) : le jeu rappelle `retrait` quand elle change.
   */
  cleDuRetrait: string;
  /**
   * L'empreinte des arêtes de la scène (`aretesDeLaScene`) change quand l'une d'elles change (une porte ouverte, une
   * structure abattue) : le jeu rappelle alors `aretes`.
   */
  cleDesAretes: string;
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
   * aucun en immersion), et le masque du retrait retire avec eux les cases des ponts au-dessus de la couche du groupe
   * dont le sol est à cette hauteur ou plus haut (`retraitDuRegard`), pour qu'aucun décor ni sol de pont ne flotte
   * au-dessus de la coupe.
   */
  coupesDesNavires: Record<string, number>;
}

/**
 * Les arêtes de toutes les couches de `scene` hors des ponts de ses navires, que la marche garde et que le modèle du
 * navire montre (`aretesHorsDesNavires`, `src/noyau/planDeNavire.ts`), chacune dessinée (`areteDessinee`), et leur
 * empreinte (`cle`, `hash32`). Mémoïsées par scène.
 */
const aretesEtEmpreinte = memoByRef((scene: Scene): { aretes: AreteDessinee[]; cle: string } => {
  const aretes = aretesHorsDesNavires(scene).map((seg) => areteDessinee(scene, seg));
  return { aretes, cle: hash32(...aretes.map(jsonCanonique)).toString(36) };
});

/** Les arêtes dessinées de toutes les couches de `scene` hors des ponts de ses navires (`aretesEtEmpreinte`). */
export const aretesDeLaScene = (scene: Scene): AreteDessinee[] => aretesEtEmpreinte(scene).aretes;

const plateauRetenu = memoByRefDeps<Scene, PlateauDeLaScene>();

/**
 * Le plateau d'une scène tel qu'un hôte le dessine sous le regard `regard` : ses dimensions, l'empreinte de ses arêtes
 * (`cleDesAretes`, `aretesDeLaScene`), son échelle métrique
 * (`sceneMetresPerTile`), la hauteur de l'œil au-dessus du sol debout (`EYE_H`) et sous le plafond de chaque case qui
 * l'abaisse (`oeilsSousPlafond`), le regard et celui qui le suit dans `REGARDS`, la clé du monde (`cleDuMonde`,
 * `clesDuMonde` : météo que le regard montre, décors, tuiles effondrées, navires posés), celle du masque du retrait (`cleDuRetrait`,
 * `masqueDuRegard`), ce que le regard retire pour le groupe posé sur `allies` : les nappes de toit (`toitsLeves`
 * : en tactique, celles qu'il dégage ; au plateau, toutes), les arêtes (`aretesDegagees` : en tactique, celles qu'il
 * dégage ; au plateau, celles des couches au-dessus de la sienne, sous tout cran) et le haut des navires
 * (`coupesDesNavires`, la hauteur de la coupe de chacun, `retraitDuRegard`) ; et les couronnes crénelées tombées
 * (`couronnesAbattues`). Retenu par scène, cases du groupe et regard (`memoByRefDeps`) : une vue relue sans que le
 * groupe ni la scène aient changé rend le même plateau.
 */
export function plateauDeLaScene(scene: Scene, allies: readonly Pt[], regard: Regard): PlateauDeLaScene {
  return plateauRetenu(scene, [regard, ...allies.flatMap((a) => [a.x, a.y, a.z])], () => plateauDuRegard(scene, allies, regard));
}

function plateauDuRegard(scene: Scene, allies: readonly Pt[], regard: Regard): PlateauDeLaScene {
  const { w, h } = scene.dimensions;
  const { activeZ, couvercle, coupes } = retraitDuRegard(scene, allies, regard);
  const dessinees = aretesHorsDesNavires(scene);
  const aretesRetirees = (): AreteDegagee[] => {
    if (regard === 'tactique') return aretesDegagees(scene, dessinees, clearedSpace(scene, allies));
    if (regard === 'immersion') return [];
    return dessinees.filter((seg) => (seg.z ?? 0) > coucheDuGroupe(scene, allies)).map((seg) => ({ cle: edgeKey(seg), abattueSous: [...CRANS] }));
  };
  return {
    w, h, metresParCase: sceneMetresPerTile(scene), oeilM: EYE_H, oeilsSousPlafond: oeilsSousPlafond(scene), regard, regardSuivant: REGARDS[(REGARDS.indexOf(regard) + 1) % REGARDS.length],
    cleDuMonde: clesDuMonde(scene)(regard),
    cleDuRetrait: hash32AuMillieme(octetsDuRetrait(scene, activeZ, couvercle)).toString(36),
    cleDesAretes: aretesEtEmpreinte(scene).cle, aretesDegagees: aretesRetirees(),
    toitsLeves: regard === 'tactique' ? toitsLeves(scene, allies) : regard === 'plateau' ? toutesLesNappes(scene) : [],
    couronnesAbattues: couronnesAbattues(scene, dessinees),
    coupesDesNavires: coupes,
  };
}
