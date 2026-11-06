/**
 * LE VOLUME DU MONDE d'une scène (#3476), que tout hôte du noyau dessine : les faces des builders purs, triangulées
 * (`facesGeometry`), orientées (`trianglesOrientes`) et colorées depuis la donnée, en tableaux plats, avec la hauteur de
 * la surface de chaque case de chaque couche. Repère des builders : X = est, Y = haut, Z = sud, en mètres, la case
 * (x, y) centrée sur (x·m, y·m) où m = `metresParCase`.
 */
import { heightAt, sceneMetresPerTile, type Scene } from '../scene';
import { parseHex } from '../../../lib/couleurHex';
import { MISSING_TONE } from './missing';
import { buildFloors } from './floors';
import { facesDuDecor } from './propVolumes';
import { decorAncre } from '../footprint';
import { findPropById } from '../../../data';
import { empreinteDuProp } from '../../../data/props.types';
import { couleurDeMatiere, recetteDeMatiere, tintVarFactor } from './matieres';
import { largeurDUnMontant, WALL_MATTER_M } from './montants';
import { centreDeLaCarte, facesGeometry, trianglesOrientes } from './worldTris';
import { buildRoofs, nappeKey } from './toits';
import type { Face } from './types';
import type { MaterialRef } from '../../../data/materials.types';

/** Les triangles d'une matière du volume, nommée `<domaine>--<id>` (`nomDeMatiere`) : ses sommets de `debut` inclus à
 *  `fin` exclu. */
interface SurfaceDuVolume {
  matiere: string;
  debut: number;
  fin: number;
}

/** Des faces du monde triangulées, en tableaux plats que l'hôte charge tels quels. */
interface GeometrieDuMonde {
  /** 3 nombres par sommet, 3 sommets par triangle, dans le sens trigonométrique vu du dehors que la loi d'orientation
   *  lui donne (`orienterPoly`) : une face verticale ouverte regarde hors de la carte, l'hôte la rend des deux côtés. */
  positions: number[];
  /** Normale unitaire de la face de chaque sommet, 3 nombres par sommet. */
  normales: number[];
  /** Couleur sRGB opaque de chaque sommet, canaux dans [0, 1], 4 nombres par sommet (rouge, vert, bleu, alpha). */
  couleurs: number[];
  /** La case `[x, y]` de chaque triangle, dans l'ordre des triangles. */
  cases: [number, number][];
  /** Les triangles d'une même matière se suivent : une surface par matière, dans l'ordre des triangles. */
  surfaces: SurfaceDuVolume[];
}

/** Le volume du monde d'une scène. */
export interface VolumeDuMonde extends GeometrieDuMonde {
  metresParCase: number;
  /** Hauteur (m) de la surface de chaque case, par couche : `rangees[y][x]` (`heightAt`). */
  hauteurs: { z: number; rangees: number[][] }[];
}

/** La nappe de toit d'une masse de bâtiment (`nappeKey`) : ses pans et ses pignons (`buildRoofs`), que l'hôte lève
 *  quand le groupe est dessous (`toitsLeves`). */
export interface NappeDuMonde extends GeometrieDuMonde {
  cle: string;
}

/** Le nom d'une matière dans le volume : son domaine et son id. */
const nomDeMatiere = ({ domain, id }: MaterialRef): string => `${domain}--${id}`;

/** Trois décimales : le millimètre, et le millième d'un canal de couleur. */
const arrondi = (v: number): number => Math.round(v * 1000) / 1000;

/** La largeur d'un pilier de surplomb, seule face du sol à porter une épaisseur (`largeurDUnMontant`). */
const profondeurDuSol = (face: Face): number | undefined => largeurDUnMontant(face, WALL_MATTER_M);

/** Les faces des décors volumiques posés sur la scène (entités `prop` dont le type porte une recette,
 *  `facesDuDecor`), chacune avec sa case, jusqu'à la couche `activeZ` : ancrés au centre de leur empreinte à leur cap
 *  (`decorAncre`), sur le sol de leur case. */
function decorsVolumiques(scene: Scene, activeZ: number, mpt: number): { face: Face; cell: { x: number; y: number; z: number } }[] {
  return scene.entities.flatMap((ent) => {
    const z = ent.z ?? 0;
    if (ent.kind !== 'prop' || z > activeZ) return [];
    const ancre = decorAncre(ent.pos, empreinteDuProp(findPropById(ent.ref), ent.facing, mpt));
    const faces = facesDuDecor(ent.ref, { ancre, ...(ent.facing ? { facing: ent.facing } : {}), baseHeightM: heightAt(scene, ent.pos.x, ent.pos.y, z), entId: ent.id }, mpt);
    return (faces ?? []).map((face) => ({ face, cell: { ...ent.pos, z } }));
  });
}

/** Les faces `listees` triangulées (`facesGeometry`), orientées (`trianglesOrientes`) et colorées depuis la donnée, chacune
 *  à la variance de teinte de sa case, les triangles d'une même matière à la suite. */
function emballer(scene: Scene, listees: readonly { face: Face; cell: { x: number; y: number; z: number } }[]): GeometrieDuMonde {
  const mpt = sceneMetresPerTile(scene);
  const geoms = facesGeometry(listees.map((f) => f.face), mpt, profondeurDuSol);
  const centre = centreDeLaCarte(scene.dimensions, mpt);
  const parMatiere = new Map<string, number[]>();
  geoms.forEach((_, i) => {
    const nom = nomDeMatiere(listees[i].face.material);
    const faces = parMatiere.get(nom) ?? [];
    faces.push(i);
    parMatiere.set(nom, faces);
  });
  const positions: number[] = [];
  const normales: number[] = [];
  const couleurs: number[] = [];
  const cases: [number, number][] = [];
  const surfaces: SurfaceDuVolume[] = [];
  for (const [matiere, faces] of parMatiere) {
    const debut = positions.length / 3;
    for (const i of faces) {
      const m = listees[i].face.material;
      const [r, v, b] = parseHex(couleurDeMatiere(m)) ?? parseHex(MISSING_TONE)!;
      const k = tintVarFactor(recetteDeMatiere(m), listees[i].cell) / 255;
      const couleur = [...[r, v, b].map((c) => arrondi(Math.min(1, c * k))), 1];
      const { x, y } = listees[i].cell;
      for (const { sommets, normale } of trianglesOrientes(geoms[i], centre)) {
        const n = normale ?? { x: 0, y: 1, z: 0 };
        cases.push([x, y]);
        for (const p of sommets) {
          positions.push(arrondi(p.x), arrondi(p.y), arrondi(p.z));
          normales.push(arrondi(n.x), arrondi(n.y), arrondi(n.z));
          couleurs.push(...couleur);
        }
      }
    }
    surfaces.push({ matiere, debut, fin: positions.length / 3 });
  }
  return { positions, normales, couleurs, cases, surfaces };
}

/** Le volume du monde de `scene` : le sol de la couche `activeZ` et de celles du dessous (terrain, relief, raccords,
 *  piliers) et les décors volumiques qui s'y posent, sans les surplombs fantômes des couches au-dessus ; sans
 *  `activeZ`, de toutes ses couches. PUR. */
export function volumeDuMonde(scene: Scene, activeZ = Math.max(...scene.layers.map((l) => l.z))): VolumeDuMonde {
  const mpt = sceneMetresPerTile(scene);
  const sol = buildFloors(scene, undefined, { activeZ }).filter((el) => !el.states.ghost).flatMap((el) => el.faces.map((face) => ({ face, cell: el.cell })));
  const listees = [...sol, ...decorsVolumiques(scene, activeZ, mpt)];
  const geometrie = emballer(scene, listees);
  const { w, h } = scene.dimensions;
  const hauteurs = scene.layers.map((l) => ({ z: l.z, rangees: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => heightAt(scene, x, y, l.z))) }));
  return { metresParCase: mpt, ...geometrie, hauteurs };
}

/** Les nappes de toit de `scene`, une par masse de bâtiment (`nappeKey`), chacune de ses pans et de ses pignons. PUR. */
export function toitsDuMonde(scene: Scene): NappeDuMonde[] {
  const parNappe = new Map<string, { face: Face; cell: { x: number; y: number; z: number } }[]>();
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
