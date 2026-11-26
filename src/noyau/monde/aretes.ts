/**
 * LES ARÊTES TELLES QU'UN HÔTE LES DESSINE (#3476, lot C) : pour chaque mur de la scène, où le poser (sa case, son
 * milieu et son sens, tourné vers son dehors, `outwardSide`), d'où elle se dresse (`piedDeLArete`), quelle pièce y va
 * (`PieceDArete`), à quelle place de son ouverture (`PositionDansLOuverture`, #4471), de quelle famille
 * (`StructureAppearanceDef.kit`, par l'apparence de l'arête, `apparenceDArete`, ou du mur qui porte sa porte), de
 * quelle palette (`paletteDeLApparence`, #4471), et à quelle hauteur.
 */
import { findStructureById, structureAppearances } from '../../data';
import { isDoorEdgeStructure } from '../../engine/structures';
import type { FamilleDuKit, StructureAppearanceDef } from '../../data';
import type { EntreeVivante } from '../../data/schemas/datasets';
import type { RectDeCases } from '../../data/schemas/grammaire/valeurs';
import { apparenceDArete, edgeKey, facadeEdges } from './facades';
import { walkNeighbors, type Pt } from './path';
import { inMapBounds } from './zones';
import { EYE_H, hauteurDeLOeil } from './iso';
import { METRES_PER_LEVEL } from './relief';
import {
  casesDeFace,
  climbEdgeBetween,
  edgeOf,
  heightAt,
  metresDEscalade,
  piedDEscalade,
  solPraticable,
  piedDeLArete,
  porteAuteur,
  porteEnJeu,
  rectJouable,
  sceneMetresPerTile,
  structureIsDown,
  tileAt,
  tuilesEffondreesSignature,
  wallEnds,
  wallIsOpen,
  type Scene,
  type WallSeg,
} from './scene';
import { estAbsent } from './terrain';
import { versionDesDatasets } from '../../data/versionDataset';
import { memoByRef, memoByRefDeps } from './sceneMemo';
import { hash32, hash32AuMillieme } from '../../lib/hash';
import { jsonCanonique } from '../../lib/jsonCanonique.mjs';
import { spaceCellKey } from './volume/architectureVisibility';
import type { Rot } from '../../geometry/iso';
import { cutawayOverhead, frontFacadeCutaway, type ClearedSpace, type FacadePanel } from './volume/architectureVisibility';
import { cotesDeMarchesDeLaScene } from './cotesDeMarches';
import { piecesDeToitDeLaScene } from './piecesDeToit';
import { NEIGHBOURS } from './volume/floors';
import { clearedSpace } from './volume/toits';
import { blocDeLaCase, empreinteDesDecors, octetsDuRetrait, retraitDuMonde, toitsLeves, toutesLesNappes, type RetraitDuMonde } from './volume/volume';
import { meteoDuRegard } from './meteo';
import { aretesHorsDesNavires, provenanceDesNavires } from '../planDeNavire';
import { outwardSide } from './volume/ornements';
import { DIR8_DELTA } from '../../geometry/dir8';
import { wallPartColor } from './volume/structures';
import type { WallPart } from '../../data/schemas/structureAppearance.types';
import type { Slot } from '../../lib/palette';
import type { PIECES_D_ARETE, POSITIONS_DANS_L_OUVERTURE } from './piecesDArete';

/** La pièce qu'une arête porte, l'une de `PIECES_D_ARETE`. */
export type PieceDArete = (typeof PIECES_D_ARETE)[number];

/** La place d'une arête dans son ouverture (`ouverturesDeLaScene`), l'une de `POSITIONS_DANS_L_OUVERTURE`. */
export type PositionDansLOuverture = (typeof POSITIONS_DANS_L_OUVERTURE)[number];

/** Une arête telle qu'un hôte la dessine : sa clé (`edgeKey`), les cases de la carte qu'elle sépare à sa couche
 *  (`casesDeFace`, `inMapBounds` : une ou deux), son milieu et son sens en coins de grille (`wallEnds`,
 *  `sensDeLArete`, celui de son ouverture), la hauteur (m) d'où elle se dresse (`piedDeLArete`), sa pièce, sa place
 *  dans son ouverture, la famille du kit de son apparence, celle du mur qui porte son ouverture pour une porte
 *  (`null` pour une apparence hors du catalogue), sa palette (`paletteDeLApparence`), sa hauteur en mètres
 *  (`wallHeightM`, sinon un étage ; le dénivelé de ses cases pour une échelle), et le bloc de la case du segment à sa
 *  couche (`blocDeLaCase`). */
export interface AreteDessinee {
  cle: string;
  cases: Required<Pt>[];
  milieu: Pt;
  sens: Pt;
  pied: number;
  piece: PieceDArete;
  position: PositionDansLOuverture;
  famille: FamilleDuKit | null;
  palette: Record<string, string>;
  hauteurM: number;
  bloc: string;
}

/** Une arête que le groupe dégage : sa clé (`edgeKey`) et les crans de caméra (`Rot`, `Dims.rot`) sous lesquels elle
 *  tombe : tous si l'une des cases qu'elle sépare est au-dessus de la tête d'un allié (`cutawayOverhead`), sinon ceux
 *  où elle se dresse entre la caméra et l'espace dégagé qu'elle borde (`frontFacadeCutaway`). */
export interface AreteDegagee { cle: string; abattueSous: Rot[] }

const CRANS: readonly Rot[] = [0, 1, 2, 3];

const APPARENCES: ReadonlyMap<string, EntreeVivante<StructureAppearanceDef>> = new Map(structureAppearances.map((a) => [a.id, a]));

/** La pièce de l'arête du segment `seg` de `scene` : une porte en jeu (`porteEnJeu`) ouverte si elle laisse passer
 *  (`wallIsOpen`), une brèche pour tout autre segment qui laisse passer, une fenêtre (`window`, `shuttered`), une échelle
 *  (`climb`, LDB 15 l.55), sinon un mur. */
function pieceDArete(scene: Scene, seg: WallSeg): PieceDArete {
  const ouverte = wallIsOpen(scene, seg);
  if (porteEnJeu(scene, seg)) return ouverte ? 'porte-ouverte' : 'porte-fermee';
  if (ouverte) return 'breche';
  if (seg.window) return seg.shuttered ? 'fenetre-close' : 'fenetre';
  if (estUneEchelle(seg)) return 'echelle';
  return 'mur';
}

/** Le segment `seg` porte-t-il une échelle (`climb`, LDB 15 l.55) ? */
const estUneEchelle = (seg: WallSeg): boolean => seg.climb?.kind === 'ladder';

/** L'escalade la plus haute que porte l'échelle `seg` de `scene` : parmi les pas que la mécanique franchit par elle
 *  (`climbEdgeBetween`), d'une case qu'elle sépare à sa couche, où l'on se tient (`solPraticable`), à la case de l'autre
 *  côté à sa couche ou à une couche au-dessus, celui de plus de mètres (`metresDEscalade`), son pied la plus basse de
 *  ses deux cases ; aucune hors d'une échelle ou sans pas qui monte. */
function escaladeDeLEchelle(scene: Scene, seg: WallSeg): { pied: Pt; arrivee: Pt; metres: number } | null {
  if (!estUneEchelle(seg)) return null;
  const z = seg.z ?? 0;
  const [a, b] = casesDeFace(seg, 'les-deux');
  const pas = [[a, b], [b, a]].flatMap(([pied, arrivee]) => scene.layers.filter((l) => l.z >= z).flatMap((l) => {
    const [de, vers] = [{ ...pied, z }, { ...arrivee, z: l.z }];
    if (![de, vers].every((c) => inMapBounds(scene.dimensions, c) && solPraticable(scene, c.x, c.y, c.z))) return [];
    const portee = climbEdgeBetween(scene, de, vers);
    if (!portee || edgeKey(portee) !== edgeKey(seg)) return [];
    const bas = piedDEscalade(scene, de, vers);
    const haut = bas === de ? vers : de;
    return [{ pied: bas, arrivee: haut, metres: metresDEscalade(scene, de, vers) }];
  }));
  const plusHaute = pas.reduce<(typeof pas)[number] | null>((m, p) => (!m || p.metres > m.metres ? p : m), null);
  return plusHaute && plusHaute.metres > 0 ? plusHaute : null;
}

/** Le dehors du segment `seg` de `scene`, en pas de grille : pour une échelle, vers le pied de son escalade la plus
 *  haute (`escaladeDeLEchelle`), d'où on la monte ; sinon son dehors (`outwardSide`), s'il en a un. */
function dehorsDuSegment(scene: Scene, seg: WallSeg): { gx: number; gy: number } | null {
  const escalade = escaladeDeLEchelle(scene, seg);
  if (escalade) return { gx: escalade.pied.x - escalade.arrivee.x, gy: escalade.pied.y - escalade.arrivee.y };
  const dehors = outwardSide(scene, seg);
  return dehors ? DIR8_DELTA[dehors] : null;
}

/** Les deux bouts du segment `seg` de `scene` (`wallEnds`), dans l'ordre où son dehors (`dehorsDuSegment`) est à
 *  `(-sens.y, sens.x)` du sens qui va du premier au second ; dans l'ordre de `wallEnds` sans dehors. */
function sensDeLArete(scene: Scene, seg: WallSeg): [Pt, Pt] {
  const [a, b] = wallEnds(seg);
  const dehors = dehorsDuSegment(scene, seg);
  if (!dehors) return [a, b];
  const { gx, gy } = dehors;
  return gy * (b.x - a.x) - gx * (b.y - a.y) < 0 ? [b, a] : [a, b];
}

type Apparence = EntreeVivante<StructureAppearanceDef>;

/** La nature d'ouverture du segment `seg` de `scene` : une porte en jeu (`porteEnJeu`), une porte de ville (un segment
 *  sans porte authorée dont la Structure se pose comme une fermeture, `isDoorEdgeStructure`), sinon aucune. */
export function natureDOuverture(scene: Scene, seg: WallSeg): 'porte-en-jeu' | 'porte-de-ville' | null {
  if (porteEnJeu(scene, seg)) return 'porte-en-jeu';
  const structure = seg.structure ? findStructureById(seg.structure) : undefined;
  return !porteAuteur(seg) && structure && isDoorEdgeStructure(structure) ? 'porte-de-ville' : null;
}

/** Une arête sur sa ligne : son segment, l'intervalle `[t0, t1]` qu'il couvre le long de la direction `d` de la ligne,
 *  sa nature d'ouverture (`natureDOuverture`) et son apparence (`apparenceDArete`). */
interface Posee { seg: WallSeg; t0: number; t1: number; nature: ReturnType<typeof natureDOuverture>; apparence: string }

/** La ligne du segment `seg` : sa clé (couche, direction `d` de signe canonique, décalage) et la direction `d`. */
function ligneDuSegment(seg: WallSeg): { ligne: string; d: Pt } {
  const [a, b] = wallEnds(seg);
  const d = b.x > a.x || (b.x === a.x && b.y > a.y) ? { x: b.x - a.x, y: b.y - a.y } : { x: a.x - b.x, y: a.y - b.y };
  return { ligne: `${seg.z ?? 0}|${d.x},${d.y}|${d.x * a.y - d.y * a.x}`, d };
}

/** La place d'une arête dans son ouverture : sa position, ses deux bouts dans le sens commun à l'ouverture, et
 *  l'apparence du mur qui porte l'ouverture, s'il en est un. */
interface DansLOuverture { position: PositionDansLOuverture; bouts: [Pt, Pt]; porteur?: Apparence }

/** Les ouvertures de `scene`, par la clé (`edgeKey`) de chacune de leurs arêtes : une ouverture est la suite maximale
 *  d'arêtes hors des navires (`aretesHorsDesNavires`) alignées et bout à bout, de même couche, de même nature
 *  d'ouverture (`natureDOuverture`) et de même apparence. Son sens est celui de sa première arête qui a un dehors
 *  (`outwardSide`), sinon de sa première ; le mur qui porte une ouverture de portes est l'arête sans nature
 *  d'ouverture qui la prolonge sur sa ligne, au bout -X, sinon au bout +X, d'une apparence du catalogue. Retenues par
 *  scène et par la version des datasets (`memoByRef`). */
const ouverturesDeLaScene = memoByRef((scene: Scene): ReadonlyMap<string, DansLOuverture> => {
  const lignes = new Map<string, { d: Pt; poses: Posee[] }>();
  for (const seg of aretesHorsDesNavires(scene)) {
    const { ligne, d } = ligneDuSegment(seg);
    const [t0, t1] = wallEnds(seg).map((p) => p.x * d.x + p.y * d.y).sort((u, v) => u - v);
    const posee = { seg, t0, t1, nature: natureDOuverture(scene, seg), apparence: apparenceDArete(scene, seg) };
    (lignes.get(ligne) ?? lignes.set(ligne, { d, poses: [] }).get(ligne)!).poses.push(posee);
  }
  const ouvertures = new Map<string, DansLOuverture>();
  for (const { d, poses } of lignes.values()) {
    poses.sort((u, v) => u.t0 - v.t0);
    for (let i = 0, j = 1; i < poses.length; i = j, j = i + 1) {
      const { nature, apparence } = poses[i];
      if (!nature) continue;
      const prolonge = (p: Posee | undefined, t: number) =>
        p?.nature === nature && p.t0 === t && p.apparence === apparence;
      while (prolonge(poses[j], poses[j - 1].t1)) j++;
      const suite = poses.slice(i, j);
      const [ra, rb] = sensDeLArete(scene, (suite.find((p) => outwardSide(scene, p.seg)) ?? suite[0]).seg);
      const croissant = (rb.x - ra.x) * d.x + (rb.y - ra.y) * d.y > 0;
      const bord = (p: Posee | undefined, t: number, bout: 't0' | 't1') =>
        nature === 'porte-en-jeu' && p && !p.nature && p[bout] === t ? APPARENCES.get(p.apparence) : undefined;
      const [avant, apres] = [bord(poses[i - 1], suite[0].t0, 't1'), bord(poses[j], suite[suite.length - 1].t1, 't0')];
      const porteur = croissant ? avant ?? apres : apres ?? avant;
      const rangees = croissant ? suite : [...suite].reverse();
      rangees.forEach(({ seg }, rang) => {
        const [a, b] = wallEnds(seg);
        const dernier = rangees.length - 1;
        const position = !dernier ? 'seule' : rang === 0 ? 'gauche' : rang === dernier ? 'droite' : 'milieu';
        const bouts: [Pt, Pt] = ((b.x - a.x) * d.x + (b.y - a.y) * d.y > 0) === croissant ? [a, b] : [b, a];
        ouvertures.set(edgeKey(seg), { position, bouts, ...(porteur ? { porteur } : {}) });
      });
    }
  }
  return ouvertures;
});

/** Par emplacement de palette (les `surfaces` d'un modèle d'arête), la partie de mur dont il prend la couleur : celles
 *  du mur, puis celles de la menuiserie. */
const PARTIES_DU_MUR = {
  corps: 'face', bois: 'poteau', joint: 'joint', gravats: 'gravats',
} as const satisfies Partial<Record<Slot, WallPart>>;
const PARTIES_DE_LA_MENUISERIE = {
  accent: 'vantail', vet1: 'meneau', metal: 'poignee', planche: 'vantail-planche', vitre: 'vitre',
  barreau: 'herse-barreau', traverse: 'herse-traverse',
} as const satisfies Partial<Record<Slot, WallPart>>;

/** Par emplacement de `parties`, la couleur de sa partie de mur dans l'apparence `apparence` (`wallPartColor`). */
const teintes = (apparence: Apparence, parties: Partial<Record<Slot, WallPart>>): Record<string, string> =>
  Object.fromEntries(Object.entries(parties).map(([emplacement, partie]) => [
    emplacement, wallPartColor(apparence, partie),
  ]));

/** Par emplacement de palette, la couleur de sa partie de mur : celles du mur (`PARTIES_DU_MUR`) dans l'apparence du
 *  mur `porteur`, celles de la menuiserie (`PARTIES_DE_LA_MENUISERIE`) dans l'apparence `apparence` (`wallPartColor`) ;
 *  aucune sans apparence. */
export function paletteDeLApparence(apparence: Apparence | undefined, porteur = apparence): Record<string, string> {
  if (!apparence || !porteur) return {};
  return { ...teintes(porteur, PARTIES_DU_MUR), ...teintes(apparence, PARTIES_DE_LA_MENUISERIE) };
}

/** L'arête dessinée du segment `seg` de `scene` : dans son ouverture (`ouverturesDeLaScene`), une porte prend la
 *  famille et les teintes de mur du mur qui la porte. */
export function areteDessinee(scene: Scene, seg: WallSeg): AreteDessinee {
  const ouverture = ouverturesDeLaScene(scene).get(edgeKey(seg));
  const [a, b] = ouverture?.bouts ?? sensDeLArete(scene, seg);
  const apparence = APPARENCES.get(apparenceDArete(scene, seg));
  const z = seg.z ?? 0;
  const piece = pieceDArete(scene, seg);
  return {
    cle: edgeKey(seg),
    cases: casesDeFace(seg, 'les-deux').filter((c) => inMapBounds(scene.dimensions, c)).map((c) => ({ ...c, z })),
    milieu: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    sens: { x: b.x - a.x, y: b.y - a.y },
    pied: piedDeLArete(scene, seg),
    piece,
    position: ouverture?.position ?? 'seule',
    famille: (ouverture?.porteur ?? apparence)?.kit ?? null,
    palette: paletteDeLApparence(apparence, ouverture?.porteur),
    hauteurM: piece === 'echelle' ? escaladeDeLEchelle(scene, seg)?.metres ?? 0 : (ouverture?.porteur ?? apparence)?.wallHeightM ?? METRES_PER_LEVEL,
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

/** Ce qui se dresse sur une arête de `scene` (une arête dessinée, un côté de marches) : sa clé et le panneau de son
 *  arête (`FacadePanel`, celui de sa façade authorée pour une arête dessinée). */
interface SurUneArete { cle: string; panneau: FacadePanel }

/** Les arêtes dessinées `dessinees` et les côtés de marches de `scene` (`cotesDeMarchesDeLaScene`), sur leur arête. */
function surLesAretes(scene: Scene, dessinees: readonly WallSeg[]): SurUneArete[] {
  const facades = facadeEdges(scene);
  return [
    ...dessinees.map((seg) => { const cle = edgeKey(seg); return { cle, panneau: { ...seg, roomZoneIds: facades.get(cle)?.roomZoneIds } }; }),
    ...cotesDeMarchesDeLaScene(scene).map(({ cle, case: c, cote }) => {
      const [dx, dy] = NEIGHBOURS[cote];
      return { cle, panneau: { ...edgeOf(c.x, c.y, c.x + dx, c.y + dy)!, z: c.z } };
    }),
  ];
}

/** Ce qui se dresse sur les arêtes de `scene` (`surLesAretes`) que l'espace dégagé `cleared` (`clearedSpace`, la loi
 *  de `architectureVisibility`) abat : au-dessus de la tête d'un allié, et sur le bord de l'espace où il se tient. */
function aretesDegagees(scene: Scene, dessinees: readonly WallSeg[], cleared: ClearedSpace): AreteDegagee[] {
  const { w, h } = scene.dimensions;
  return surLesAretes(scene, dessinees).flatMap(({ cle, panneau }): AreteDegagee[] => {
    const abattueSous = casesDeFace(panneau, 'les-deux').some((c) => cutawayOverhead({ ...c, z: panneau.z }, cleared))
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

const couvrantsRetenus = memoByRef((_scene: Scene) => new Map<number, ReadonlySet<string>>());

/** Les cases `x,y,z` de `scene` qui couvrent la couche `couche` : celles d'une couche plus basse dont le sol
 *  (`heightAt`) dépasse celui de la case de `couche` à leur verticale (la hune élevée par le Nid-de-pie au-dessus de la
 *  passerelle, #4040). Retenues par scène et par la version des datasets (`versionDesDatasets` : la présence d'une case
 *  lit le catalogue des terrains, `estAbsent`), chaque couche au premier appel. */
function couvrantsDeLaCouche(scene: Scene, couche: number): ReadonlySet<string> {
  const parCouche = couvrantsRetenus(scene);
  const present = (x: number, y: number, z: number): boolean => !estAbsent(tileAt(scene, x, y, z));
  const { w, h } = scene.dimensions;
  return parCouche.get(couche) ?? parCouche.set(couche, new Set(scene.layers.filter(({ z }) => z < couche).flatMap(({ z }) =>
    Array.from({ length: w * h }, (_, i) => ({ x: i % w, y: Math.floor(i / w) }))
      .filter(({ x, y }) => present(x, y, z) && present(x, y, couche) && heightAt(scene, x, y, z) > heightAt(scene, x, y, couche))
      .map(({ x, y }) => spaceCellKey(x, y, z))))).get(couche)!;
}

/** La couche la plus haute où se tient un allié de `allies` : celle que le regard `plateau` montre, rien au-dessus.
 *  Un allié dont un voisin de marche (`walkNeighbors`) est d'une couche plus haute, à un sol qui ne dépasse pas le sien
 *  (le haut d'une échelle de trappe, au niveau du pont du dessus), se tient à la couche de ce voisin. Un allié debout
 *  sur une case qui couvre une couche plus haute (`couvrantsDeLaCouche`, la hune au-dessus de la passerelle) se tient
 *  à cette couche. */
const coucheDuGroupe = (scene: Scene, allies: readonly Pt[]): number => Math.max(0, ...allies.map((a) => Math.max(a.z ?? 0,
  ...walkNeighbors(scene, a).filter((n) => (n.z ?? 0) > (a.z ?? 0) && piedDe(scene, n) <= piedDe(scene, a)).map((n) => n.z ?? 0),
  ...scene.layers.map(({ z }) => z).filter((z) => couvrantsDeLaCouche(scene, z).has(spaceCellKey(a.x, a.y, a.z ?? 0))))));

/** Ce qu'un regard retire du volume du monde : les couches au-dessus de `activeZ`, les cases du `couvercle` (clés
 *  `x,y,z`) ; et, par id de navire, la hauteur (m) de sa coupe. */
interface RetraitDuRegard {
  activeZ?: number;
  couvercle: ReadonlySet<string>;
  coupes: Record<string, number>;
}

/** Ce que le regard `regard` retire du volume du monde pour le groupe posé sur `allies` : au plateau, les couches
 *  au-dessus de la sienne (`activeZ`) et ce qui la couvre (`couvrantsDeLaCouche`) au-dessus de son pied le plus haut ;
 *  en tactique, le couvercle au-dessus de sa tête (`clearedSpace`, `overheadCells`, ses cases `x,y,z` dont le sol
 *  dépasse le pied le plus haut du groupe) ; en immersion, rien. Un navire dont il ôte des cases de ses ponts
 *  (`provenanceDesNavires`) est coupé au plus bas de leurs sols (`coupes`, en mètres) : son modèle ne montre rien de cette
 *  hauteur et au-dessus, et le volume rien des cases de ses ponts aux couches au-dessus du groupe dont le sol y est. */
function retraitDuRegard(scene: Scene, allies: readonly Pt[], regard: Regard): RetraitDuRegard {
  const couche = coucheDuGroupe(scene, allies);
  const activeZ = regard === 'plateau' ? couche : undefined;
  const pied = Math.max(-Infinity, ...allies.map((a) => piedDe(scene, a)));
  const auDessus = (cle: string): boolean => { const [x, y, z] = cle.split(',').map(Number); return heightAt(scene, x, y, z) > pied; };
  const couvercle = regard === 'tactique' ? new Set([...clearedSpace(scene, allies).overheadCells].filter(auDessus))
    : regard === 'plateau' ? new Set([...couvrantsDeLaCouche(scene, couche)].filter(auDessus)) : new Set<string>();
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

const clesRetenues = memoByRef((scene: Scene): { deLaScene: number; parRegard: Map<Regard, string> } => ({
  deLaScene: hash32(empreinteDesDecors(scene), tuilesEffondreesSignature(scene), empreinteDesNavires(scene), String(versionDesDatasets())),
  parRegard: new Map(),
}));

/** La clé du monde de `scene` (`PlateauDeLaScene.cleDuMonde`) sous le regard `regard` : l'empreinte de ce qui ne tient
 *  qu'à la scène (ses décors, `empreinteDesDecors`, ses tuiles effondrées, `tuilesEffondreesSignature`, ses navires posés,
 *  `empreinteDesNavires`) et de la version des datasets (`versionDesDatasets` : le volume lit les catalogues), poursuivie
 *  par celle de la météo que le regard montre (`meteoDuRegard`). Retenue par scène et par cette version, chaque regard
 *  au premier appel. */
function cleDuMonde(scene: Scene, regard: Regard): string {
  const { deLaScene, parRegard } = clesRetenues(scene);
  return parRegard.get(regard) ?? parRegard.set(regard, hash32(deLaScene, jsonCanonique(meteoDuRegard(scene, regard))).toString(36)).get(regard)!;
}

/** La hauteur de l'œil de chaque case marchable de `scene` où elle est plus basse que debout (`hauteurDeLOeil`), par
 *  sa clé `x,y,z` (`spaceCellKey`). Retenue par scène et par la version des datasets (`versionDesDatasets` : la marche
 *  et le plafond lisent le catalogue des terrains, `solPraticable`, `estAbsent`). */
const oeilsSousPlafond = memoByRef((scene: Scene): Record<string, number> => {
  const { w, h } = scene.dimensions;
  const oeils: Record<string, number> = {};
  for (const { z } of scene.layers)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!solPraticable(scene, x, y, z)) continue;
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
 * aux couches au-dessus de la sienne) et les arêtes qu'il dégage ; au plateau, toutes les nappes de toit, les
 * couches au-dessus de la plus haute où il se tient, arêtes et cases du volume, et les cases d'une couche plus basse
 * dont le sol dépasse celui de cette couche à leur verticale et le pied le plus haut du groupe ; en immersion, rien.
 * Les cases du volume qu'il retire, le masque du retrait les nomme (`retrait`, section « Monde ») ; le volume, lui, ne
 * dépend que de la scène.
 */
export interface PlateauDeLaScene {
  /** ses dimensions : sa largeur, en cases. */
  w: number;
  /** ses dimensions : sa hauteur, en cases. */
  h: number;
  /**
   * le rectangle de cases où se joue la scène, `{ x, y, w, h }` (`rectJouable` : toute la grille sans zone jouable) ;
   * le cadrage de départ vise son centre.
   */
  zoneJouable: RectDeCases;
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
   * (`tuilesEffondreesSignature`), quand un navire bouge (`provenanceDesNavires`) et quand un catalogue est édité
   * (`versionDesDatasets`) : le jeu rappelle alors `monde`.
   */
  cleDuMonde: string;
  /**
   * La clé du retrait, l'empreinte (`hash32AuMillieme`, `src/lib/hash.ts`, en base 36) des octets du masque que le
   * regard retire pour le groupe (`masqueDuRegard`) : le jeu rappelle `retrait` quand elle change.
   */
  cleDuRetrait: string;
  /**
   * L'empreinte des arêtes de la scène (`aretesDeLaScene`), de ses côtés de marches (`cotesDeMarchesDeLaScene`,
   * `src/noyau/monde/cotesDeMarches.ts`) et de ses pièces de toit (`piecesDeToitDeLaScene`, `src/noyau/monde/piecesDeToit.ts`)
   * change quand l'un d'eux change (une porte ouverte, une structure abattue, une masse de toit) : le jeu rappelle
   * alors `aretes`.
   */
  cleDesAretes: string;
  /**
   * les arêtes et les côtés de marches retirés (`{ cle, abattueSous }`, les crans de caméra (`Rot`,
   * `src/geometry/iso.ts` : 0 au sud-est, puis sud-ouest, nord-ouest, nord-est) sous lesquels chacune tombe : tous pour celles d'une couche retirée et celles dont
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
   * Un navire de la scène dont le regard retire des ponts (une couche au-dessus du groupe et une case qui couvre la
   * sienne au-dessus de son pied au plateau, une case du couvercle en tactique) se coupe à la hauteur du sol le plus
   * bas de ceux-là (en mètres, par l'id de son entité ; aucun en immersion), et le masque du retrait retire avec eux
   * les cases des ponts au-dessus de la couche du groupe dont le sol est à cette hauteur ou plus haut
   * (`retraitDuRegard`), pour qu'aucun décor ni sol de pont ne flotte au-dessus de la coupe.
   */
  coupesDesNavires: Record<string, number>;
}

/**
 * Les arêtes de toutes les couches de `scene` hors des ponts de ses navires, que la marche garde et que le modèle du
 * navire montre (`aretesHorsDesNavires`, `src/noyau/planDeNavire.ts`), chacune dessinée (`areteDessinee`), et leur
 * empreinte avec celles des côtés de marches et des pièces de toit de la scène (`cle`, `hash32`, `cotesDeMarchesDeLaScene`,
 * `piecesDeToitDeLaScene`). Retenues par
 * scène et par la version des datasets (`versionDesDatasets` : les ponts d'un navire se lisent à la fiche de son véhicule, le pied d'une arête au catalogue des terrains).
 */
const aretesEtEmpreinte = memoByRef((scene: Scene): { aretes: AreteDessinee[]; cle: string } => {
  const aretes = aretesHorsDesNavires(scene).map((seg) => areteDessinee(scene, seg));
  return { aretes, cle: hash32(...aretes.map(jsonCanonique), ...cotesDeMarchesDeLaScene(scene).map(jsonCanonique), ...piecesDeToitDeLaScene(scene).map(jsonCanonique)).toString(36) };
});

/** Les arêtes dessinées de toutes les couches de `scene` hors des ponts de ses navires (`aretesEtEmpreinte`). */
export const aretesDeLaScene = (scene: Scene): AreteDessinee[] => aretesEtEmpreinte(scene).aretes;

const plateauRetenu = memoByRefDeps<Scene, PlateauDeLaScene>();

/**
 * Le plateau d'une scène tel qu'un hôte le dessine sous le regard `regard` : ses dimensions, sa zone jouable
 * (`rectJouable`), l'empreinte de ses arêtes
 * (`cleDesAretes`, `aretesDeLaScene`), son échelle métrique (`sceneMetresPerTile`), la hauteur de l'œil au-dessus du
 * sol debout (`EYE_H`) et sous le plafond de chaque case qui l'abaisse (`oeilsSousPlafond`), le regard et celui qui le
 * suit dans `REGARDS`, la clé du monde (`cleDuMonde` : météo que le regard montre, décors, tuiles effondrées, navires
 * posés, version des datasets), celle du masque du retrait (`cleDuRetrait`, `masqueDuRegard`), ce que le regard retire pour le groupe posé sur `allies` : les nappes de toit (`toitsLeves`
 * : en tactique, celles qu'il dégage ; au plateau, toutes), les arêtes (`aretesDegagees` : en tactique, celles qu'il
 * dégage ; au plateau, celles des couches au-dessus de la sienne, sous tout cran) et le haut des navires
 * (`coupesDesNavires`, la hauteur de la coupe de chacun, `retraitDuRegard`) ; et les couronnes crénelées tombées
 * (`couronnesAbattues`). Retenu par scène, version des datasets, cases du groupe et regard
 * (`memoByRefDeps`) : une vue relue sans que le groupe, la scène ni un catalogue aient changé rend le même plateau.
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
    return surLesAretes(scene, dessinees).filter(({ panneau }) => (panneau.z ?? 0) > coucheDuGroupe(scene, allies)).map(({ cle }) => ({ cle, abattueSous: [...CRANS] }));
  };
  return {
    w, h, zoneJouable: rectJouable(scene), metresParCase: sceneMetresPerTile(scene), oeilM: EYE_H, oeilsSousPlafond: oeilsSousPlafond(scene), regard, regardSuivant: REGARDS[(REGARDS.indexOf(regard) + 1) % REGARDS.length],
    cleDuMonde: cleDuMonde(scene, regard),
    cleDuRetrait: hash32AuMillieme(octetsDuRetrait(scene, activeZ, couvercle)).toString(36),
    cleDesAretes: aretesEtEmpreinte(scene).cle, aretesDegagees: aretesRetirees(),
    toitsLeves: regard === 'tactique' ? toitsLeves(scene, allies) : regard === 'plateau' ? toutesLesNappes(scene) : [],
    couronnesAbattues: couronnesAbattues(scene, dessinees),
    coupesDesNavires: coupes,
  };
}
