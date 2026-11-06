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
import { couleurDuSol, recetteDuSol, tintVarFactor, type MatiereDuSol } from './matieres';
import { largeurDUnMontant, WALL_MATTER_M } from './montants';
import { centreDeLaCarte, facesGeometry, trianglesOrientes } from './worldTris';
import type { Face } from './types';

/** Le volume du monde d'une scène, en tableaux plats que l'hôte charge tels quels. */
export interface VolumeDuMonde {
  metresParCase: number;
  /** 3 nombres par sommet, 3 sommets par triangle, dans le sens trigonométrique vu du dehors que la loi d'orientation
   *  lui donne (`orienterPoly`) : une face verticale ouverte regarde hors de la carte, l'hôte la rend des deux côtés. */
  positions: number[];
  /** Normale unitaire de la face de chaque sommet, 3 nombres par sommet. */
  normales: number[];
  /** Couleur sRGB opaque de chaque sommet, canaux dans [0, 1], 4 nombres par sommet (rouge, vert, bleu, alpha). */
  couleurs: number[];
  /** La case `[x, y]` de chaque triangle, dans l'ordre des triangles. */
  cases: [number, number][];
  /** Hauteur (m) de la surface de chaque case, par couche : `rangees[y][x]` (`heightAt`). */
  hauteurs: { z: number; rangees: number[][] }[];
}

/** Trois décimales : le millimètre, et le millième d'un canal de couleur. */
const arrondi = (v: number): number => Math.round(v * 1000) / 1000;

/** La largeur d'un pilier de surplomb, seule face du sol à porter une épaisseur (`largeurDUnMontant`). */
const profondeurDuSol = (face: Face): number | undefined => largeurDUnMontant(face, WALL_MATTER_M);

/** Le volume du monde de `scene` : le sol de la couche `activeZ` et de celles du dessous (terrain, relief, raccords,
 *  piliers), sans les surplombs fantômes des couches au-dessus ; sans `activeZ`, de toutes ses couches. PUR. */
export function volumeDuMonde(scene: Scene, activeZ = Math.max(...scene.layers.map((l) => l.z))): VolumeDuMonde {
  const mpt = sceneMetresPerTile(scene);
  const listees = buildFloors(scene, undefined, { activeZ }).filter((el) => !el.states.ghost).flatMap((el) => el.faces.map((face) => ({ face, cell: el.cell })));
  const geoms = facesGeometry(listees.map((f) => f.face), mpt, profondeurDuSol);
  const centre = centreDeLaCarte(scene.dimensions, mpt);
  const positions: number[] = [];
  const normales: number[] = [];
  const couleurs: number[] = [];
  const cases: [number, number][] = [];
  geoms.forEach((g, i) => {
    const matiere = listees[i].face.material as MatiereDuSol;
    const [r, v, b] = parseHex(couleurDuSol(matiere)) ?? parseHex(MISSING_TONE)!;
    const k = tintVarFactor(recetteDuSol(matiere), listees[i].cell) / 255;
    const couleur = [...[r, v, b].map((c) => arrondi(Math.min(1, c * k))), 1];
    const { x, y } = listees[i].cell;
    for (const { sommets, normale } of trianglesOrientes(g, centre)) {
      const n = normale ?? { x: 0, y: 1, z: 0 };
      cases.push([x, y]);
      for (const p of sommets) {
        positions.push(arrondi(p.x), arrondi(p.y), arrondi(p.z));
        normales.push(arrondi(n.x), arrondi(n.y), arrondi(n.z));
        couleurs.push(...couleur);
      }
    }
  });
  const { w, h } = scene.dimensions;
  const hauteurs = scene.layers.map((l) => ({ z: l.z, rangees: Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => heightAt(scene, x, y, l.z))) }));
  return { metresParCase: mpt, positions, normales, couleurs, cases, hauteurs };
}
