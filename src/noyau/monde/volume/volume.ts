/**
 * LE VOLUME DU MONDE d'une scène (#3476), que tout hôte du noyau dessine : les faces des builders purs, triangulées
 * (`facesGeometry`), orientées (`trianglesOrientes`) et colorées depuis la donnée, en tableaux plats, avec la hauteur de
 * la surface de chaque case de chaque couche. Repère des builders : X = est, Y = haut, Z = sud, en mètres, la case
 * (x, y) centrée sur (x·m, y·m) où m = `metresParCase`.
 */
import { heightAt, piedDeLArete, sceneMetresPerTile, tileAt, wallEnds, type Scene } from '../scene';
import { terrainOverlayProp, terrainsAvecGlyphe } from '../terrain';
import { garanti } from '../../../lib/garanti';
import { facesDuDessus } from './pente';
import { parseHex } from '../../../lib/couleurHex';
import { MISSING_TONE } from './missing';
import { buildFloors } from './floors';
import { facesDuDecor } from './propVolumes';
import { ancreDuDecor } from '../footprint';
import { piedDuDecor } from '../poseDuDecor';
import { matieresDe } from '../../../data';
import { hash32 } from '../../../data/hash';
import { jsonCanonique } from '../../../lib/jsonCanonique.mjs';
import { couleurDeMatiere, recetteDeMatiere, tintVarFactor } from './matieres';
import { faceDepthM } from './profondeur';
import { crownFaces, cretesDePerimetre } from './creneaux';
import { edgeAppearance } from './structures';
import { edgeKey, facadeEdges } from '../facades';
import { WALL_H_M } from '../iso';
import { centreDeLaCarte, facesGeometry, trianglesOrientes } from './worldTris';
import { buildRoofs, nappeKey } from './toits';
import { spaceCellKey } from './architectureVisibility';
import { aretesHorsDesNavires, provenanceDesNavires } from '../../planDeNavire';
import type { Face } from './types';
import type { MaterialRef } from '../../../data/materials.types';

/** D'où viennent des faces du volume : `navire`, l'id de l'entité du navire dont les ponts les posent
 *  (`provenanceDesNavires`), que l'hôte touche sans les peindre, le navire se montrant par son modèle 3D ; `flottaison`,
 *  l'id du navire dont elles sont la mer, sur l'emprise de ses ponts à sa flottaison, que l'hôte peint hors de la coque
 *  de son modèle et que le rayon du pointeur traverse. */
interface Provenance {
  navire?: string;
  flottaison?: string;
}

/** Les triangles d'une matière du volume, nommée `<domaine>--<id>` (`nomDeMatiere`) : ses sommets de `debut` inclus à
 *  `fin` exclu, et leur provenance. */
interface SurfaceDuVolume extends Provenance {
  matiere: string;
  debut: number;
  fin: number;
}

/** Une face listée du volume : sa case et sa couche, et sa provenance. */
interface FaceListee extends Provenance {
  face: Face;
  cell: { x: number; y: number; z: number };
}

/** La mer qui porte un navire posé, sur sa flottaison : le terrain du glyphe `~` des plans. */
const MER = garanti(terrainsAvecGlyphe()['~'], '~', 'terrain de la mer');

/**
 * @contrat Monde
 * Des faces du monde triangulées, en tableaux plats que l'hôte charge tels quels.
 */
interface GeometrieDuMonde {
  /**
   * 3 nombres par sommet, 3 sommets par triangle, dans le sens trigonométrique vu du dehors. Chaque triangle porte le
   * dehors que lui donne la loi d'orientation (`orienterPoly`, `src/noyau/monde/volume/worldTris.ts`) : vers le haut
   * une face horizontale, hors de la carte une face verticale ouverte (une falaise, une paroi), qui peut donc tourner
   * le dos à la caméra ; le monde de Godot rend et touche le volume des deux côtés.
   */
  positions: number[];
  /** Normale unitaire de la face de chaque sommet, 3 nombres par sommet. */
  normales: number[];
  /** Couleur sRGB opaque de chaque sommet, canaux dans [0, 1], 4 nombres par sommet (rouge, vert, bleu, alpha). */
  couleurs: number[];
  /** La case `[x, y, z]` de chaque triangle, sa couche comprise, dans l'ordre des triangles. */
  cases: [number, number, number][];
  /**
   * une par matière (et provenance), ses sommets de `debut` à `fin` exclu, dans l'ordre des triangles. Les triangles
   * d'une même matière se suivent (`surfaces`) ; le sol et les crêtes d'une case que posent les ponts d'un navire de
   * la scène
   * (`provenanceDesNavires`, `src/noyau/planDeNavire.ts`) forment des surfaces à part, qui portent `navire`, l'id de
   * l'entité du navire : le monde les touche (`cases`, forme du rayon du pointeur et de la marche de l'œil) sans les
   * peindre (`VolumeDeScene._maillage_de`), le navire se montrant par son modèle (section « Corps d'un combattant »,
   * `navires`) ; ses décors restent peints ; sur sa flottaison, le rectangle de ses ponts à la couche de son pont le
   * plus bas, chaque case est sa mer (`MER`, le terrain du glyphe `~`) à la hauteur 0, à la place du sol de la scène
   * hors de ses ponts : des surfaces à part, qui portent `flottaison`, l'id de l'entité du navire, que le rayon du
   * pointeur traverse et que le monde peint hors de la coque du modèle posé, sous la hauteur 0
   * (`VolumeDeScene.border_la_mer`,
   * `MontageDeVehicule.contour_sous`, recette `projet/recettes/coupe-du-navire.gd`) ; une matière se nomme
   * `<domaine>--<id>` (`terrain--herbe`, `relief--pierre`).
   */
  surfaces: SurfaceDuVolume[];
}

/**
 * @contrat Monde
 * Le volume du monde (`volumeDuMonde`, `src/noyau/monde/volume/volume.ts`) est la géométrie que les builders purs du
 * noyau dérivent de la scène, triangulée, orientée et colorée depuis la donnée : le sol de toutes les couches (terrain
 * par case et sa variance de teinte, relief, raccords, piliers), la crête qui ceinture chaque zone crénelée
 * (`cretesDePerimetre`, `src/noyau/monde/volume/creneaux.ts`, matière `structure--<id>` de l'apparence que porte
 * `Layer.crenellated`) et les décors, chacun modelé par la recette de son type (`facesDuDecor`,
 * `src/noyau/monde/volume/propVolumes.ts`) : celui que le terrain pose sur chacune de ses cases (`terrainOverlayProp`,
 * les arbres du bois) et les entités `prop` de la scène, à la couleur de leur matériau de décor (matière `prop--<id>`).
 * Il se publie dans le repère des builders, en mètres : X à l'est, Y en haut, Z au sud, la case (x, y) centrée sur (x ·
 * `metresParCase`, y · `metresParCase`).
 *
 * Les faces verticales du volume, des nappes et des couronnes prennent l'épaisseur que leur matière authore
 * (`faceDepthM`, `src/noyau/monde/volume/profondeur.ts`).
 */
export interface VolumeDuMonde extends GeometrieDuMonde {
  /** L'échelle de la scène, en mètres par case (`sceneMetresPerTile`). */
  metresParCase: number;
  /** Hauteur (m) de la surface de chaque case, par couche : `rangees[y][x]` (`heightAt`). */
  hauteurs: { z: number; rangees: number[][] }[];
  /**
   * Ce que le regard retire du volume (les cases des couches au-dessus de la couche active et du couvercle, section
   * « Vue ») forme son `ombre`, de la même forme (`positions`, `normales`, `couleurs`, `cases`, `surfaces`), que le
   * monde ne montre ni ne touche et dont il garde l'ombre (`VolumeDeScene._mailler`, un maillage en ombre seule) : sous un
   * étage retiré, le rez reste à l'ombre (#3758).
   */
  ombre: GeometrieDuMonde;
}

/** La nappe de toit d'une masse de bâtiment (`nappeKey`) : ses pans et ses pignons (`buildRoofs`), que l'hôte lève
 *  quand le groupe est dessous (`toitsLeves`). */
export interface NappeDuMonde extends GeometrieDuMonde {
  cle: string;
}

/** Le nom d'une matière dans le volume : son domaine et son id. */
const nomDeMatiere = ({ domain, id }: MaterialRef): string => `${domain}--${id}`;

/** Les noms des matières de décor du monde (domaine `prop` de `materials.json`), dont un modèle 3D habille ses surfaces. */
export const matieresDeDecor = (): string[] => matieresDe('prop').map(({ id }) => nomDeMatiere({ domain: 'prop', id }));

/** Trois décimales : le millimètre, et le millième d'un canal de couleur. */
const arrondi = (v: number): number => Math.round(v * 1000) / 1000;

/** Les faces des décors volumiques de la scène (`facesDuDecor`), chacune avec sa case, de toutes ses couches : le
 *  décor que son terrain pose sur chaque case (`terrainOverlayProp`, le bois et ses arbres), au centre de la case, et
 *  les entités `prop`, à leur ancre (`ancreDuDecor`) et à leur cap, sur leur pied (`piedDuDecor` : le sol de leur case ou
 *  le dessus de leur support). */
function decorsVolumiques(scene: Scene, mpt: number): FaceListee[] {
  const { w, h } = scene.dimensions;
  const duTerrain = scene.layers.flatMap(({ z }) =>
    Array.from({ length: w * h }, (_, i) => ({ x: i % w, y: Math.floor(i / w), z })).flatMap((cell) => {
      const faces = facesDuDecor(terrainOverlayProp(tileAt(scene, cell.x, cell.y, z)), { ancre: cell, baseHeightM: heightAt(scene, cell.x, cell.y, z) }, mpt);
      return (faces ?? []).map((face) => ({ face, cell }));
    }));
  return duTerrain.concat(scene.entities.flatMap((ent) => {
    const z = ent.z ?? 0;
    if (ent.kind !== 'prop') return [];
    const faces = facesDuDecor(ent.ref, { ancre: ancreDuDecor(ent, mpt), ...(ent.facing ? { facing: ent.facing } : {}), baseHeightM: piedDuDecor(scene, ent), entId: ent.id }, mpt);
    return (faces ?? []).map((face) => ({ face, cell: { ...ent.pos, z } }));
  }));
}

/** L'empreinte des entités `prop` de la scène, celles que le volume pose (`decorsVolumiques`), chacune entière : elle
 *  change quand un décor est ajouté, retiré ou changé en jeu. PUR. */
export function empreinteDesDecors(scene: Scene): string {
  return hash32(...scene.entities.flatMap((e) => (e.kind === 'prop' ? [jsonCanonique(e)] : []))).toString(36);
}

/** Les faces `listees` triangulées (`facesGeometry`), orientées (`trianglesOrientes`) et colorées depuis la donnée, chacune
 *  à la variance de teinte de sa case, les triangles d'une même matière à la suite. */
function emballer(scene: Scene, listees: readonly FaceListee[]): GeometrieDuMonde {
  const mpt = sceneMetresPerTile(scene);
  const geoms = facesGeometry(listees.map((f) => f.face), mpt, faceDepthM);
  const centre = centreDeLaCarte(scene.dimensions, mpt);
  const parMatiere = new Map<string, Provenance & { matiere: string; faces: number[] }>();
  geoms.forEach((_, i) => {
    const { face, navire, flottaison } = listees[i];
    const matiere = nomDeMatiere(face.material);
    const cle = `${navire ?? ''}|${flottaison ?? ''}|${matiere}`;
    const groupe = parMatiere.get(cle) ?? parMatiere.set(cle, { matiere, ...(navire ? { navire } : {}), ...(flottaison ? { flottaison } : {}), faces: [] }).get(cle)!;
    groupe.faces.push(i);
  });
  const positions: number[] = [];
  const normales: number[] = [];
  const couleurs: number[] = [];
  const cases: [number, number, number][] = [];
  const surfaces: SurfaceDuVolume[] = [];
  for (const { faces, ...surface } of parMatiere.values()) {
    const debut = positions.length / 3;
    for (const i of faces) {
      const m = listees[i].face.material;
      const [r, v, b] = parseHex(couleurDeMatiere(m)) ?? parseHex(MISSING_TONE)!;
      const k = tintVarFactor(recetteDeMatiere(m), listees[i].cell) / 255;
      const couleur = [...[r, v, b].map((c) => arrondi(Math.min(1, c * k))), 1];
      const { x, y, z } = listees[i].cell;
      for (const { sommets, normale } of trianglesOrientes(geoms[i], centre)) {
        const n = normale ?? { x: 0, y: 1, z: 0 };
        cases.push([x, y, z]);
        for (const p of sommets) {
          positions.push(arrondi(p.x), arrondi(p.y), arrondi(p.z));
          normales.push(arrondi(n.x), arrondi(n.y), arrondi(n.z));
          couleurs.push(...couleur);
        }
      }
    }
    surfaces.push({ ...surface, debut, fin: positions.length / 3 });
  }
  return { positions, normales, couleurs, cases, surfaces };
}

/** Le volume du monde de `scene` : le sol de la couche `activeZ` et de celles du dessous (terrain, relief, raccords,
 *  piliers), les crêtes de ses zones crénelées (`cretesDePerimetre`) et les décors volumiques qui s'y posent, sans les
 *  surplombs fantômes des couches au-dessus ; sans `activeZ`, de toutes ses couches ; sans les cases du `couvercle`
 *  (clés `x,y,z`, `volumeDuRegard`). Ce qu'il en retire, les cases des couches au-dessus de `activeZ` et du `couvercle`,
 *  forme son `ombre`. Le sol et les crêtes d'une case que les ponts d'un navire posent portent ce navire
 *  (`provenanceDesNavires`) ; ses décors, non. Sur la flottaison d'un navire (`provenanceDesNavires`), chaque case est sa
 *  mer (`MER`), à la hauteur 0, à la place du sol de la scène hors de ses ponts. PUR. */
export function volumeDuMonde(scene: Scene, activeZ = Math.max(...scene.layers.map((l) => l.z)), couvercle: ReadonlySet<string> = new Set()): VolumeDuMonde {
  const mpt = sceneMetresPerTile(scene);
  const haut = Math.max(...scene.layers.map((l) => l.z));
  const { cases: navires, flottaison } = provenanceDesNavires(scene);
  const cleDe = (cell: { x: number; y: number; z: number }): string => spaceCellKey(cell.x, cell.y, cell.z);
  const duNavire = (cell: { x: number; y: number; z: number }): Provenance => {
    const navire = navires.get(cleDe(cell));
    return navire ? { navire } : {};
  };
  const montres = buildFloors(scene, undefined, { activeZ }).filter((el) => !el.states.ghost);
  const dessus = scene.layers.filter((l) => l.z > activeZ).flatMap((l) => buildFloors(scene, undefined, { activeZ: haut, viewZ: l.z }));
  const sol = [...montres.map((el) => ({ el, auDessus: false })), ...dessus.map((el) => ({ el, auDessus: true }))]
    .filter(({ el }) => navires.has(cleDe(el.cell)) || !flottaison.has(cleDe(el.cell)))
    .flatMap(({ el, auDessus }) => el.faces.map((face) => ({ face, cell: el.cell, ...duNavire(el.cell), auDessus })));
  const mer = [...flottaison].flatMap(([cle, navire]) => {
    const [x, y, z] = cle.split(',').map(Number);
    return facesDuDessus({ x, y, h: 0, quarts: [], pente: false, marches: false, divisions: 1 }, MER).map((face) => ({ face, cell: { x, y, z }, flottaison: navire, auDessus: z > activeZ }));
  });
  const cretes = cretesDePerimetre(scene).flatMap((c) => c.faces.map((face) => ({ face, cell: c.arete, ...duNavire(c.case), auDessus: c.case.z > activeZ })));
  const decors = decorsVolumiques(scene, mpt).map((f) => ({ ...f, auDessus: f.cell.z > activeZ }));
  const retiree = ({ cell, auDessus }: { cell: FaceListee['cell']; auDessus: boolean }): boolean => auDessus || couvercle.has(cleDe(cell));
  const listees = [...sol, ...mer, ...cretes, ...decors];
  const geometrie = emballer(scene, listees.filter((f) => !retiree(f)));
  const { w, h } = scene.dimensions;
  const hauteurs = scene.layers.map((l) => ({ z: l.z, rangees: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => heightAt(scene, x, y, l.z))) }));
  return { metresParCase: mpt, ...geometrie, hauteurs, ombre: emballer(scene, listees.filter(retiree)) };
}

/** Les nappes de toit de `scene`, une par masse de bâtiment (`nappeKey`), chacune de ses pans et de ses pignons. PUR. */
export function toitsDuMonde(scene: Scene): NappeDuMonde[] {
  const parNappe = new Map<string, FaceListee[]>();
  for (const el of buildRoofs(scene)) {
    const cle = nappeKey(el.bodyId!, el.sectionId!);
    const faces = parNappe.get(cle) ?? parNappe.set(cle, []).get(cle)!;
    for (const face of el.faces) faces.push({ face, cell: el.cell });
  }
  return [...parNappe].map(([cle, listees]) => ({ cle, ...emballer(scene, listees) }));
}

/** Les nappes de toit que le groupe dégage, posé sur `allies` (`clearedSpace`, `cutawayForSection`) : celles qui
 *  couvrent l'espace où il se tient. PUR. */
export function toitsLeves(scene: Scene, allies: readonly { x: number; y: number; z?: number }[]): string[] {
  return [...new Set(buildRoofs(scene, { allies: [...allies] }).filter((el) => el.states.roofOccupied).map((el) => nappeKey(el.bodyId!, el.sectionId!)))];
}

/** Les clés (`nappeKey`) de toutes les nappes de toit de `scene` (`toitsDuMonde`). PUR. */
export function toutesLesNappes(scene: Scene): string[] {
  return [...new Set(buildRoofs(scene).map((el) => nappeKey(el.bodyId!, el.sectionId!)))];
}

/** Les couronnes crénelées des murs fortifiés de `scene` hors des ponts de ses navires (`aretesHorsDesNavires`), de
 *  toutes ses couches (`crownFaces`, apparence à `parapet`), une par arête, nommée par sa clé (`edgeKey`), posée au
 *  sommet de la face pleine du mur dressé à son pied (`piedDeLArete`, `wallHeightM`, sinon un étage) : l'hôte cache
 *  celles qui tombent avec leur mur (`couronnesAbattues`). PUR. */
export function couronnesDuMonde(scene: Scene): NappeDuMonde[] {
  const facades = facadeEdges(scene);
  return aretesHorsDesNavires(scene).flatMap((seg) => {
    const app = edgeAppearance(facades.get(edgeKey(seg)), seg);
    if (!app.parapet) return [];
    const [a, b] = wallEnds(seg);
    const faces = crownFaces(app, a, b, piedDeLArete(scene, seg) + (app.wallHeightM ?? WALL_H_M));
    return [{ cle: edgeKey(seg), ...emballer(scene, faces.map((face) => ({ face, cell: { x: seg.x, y: seg.y, z: seg.z ?? 0 } }))) }];
  });
}
