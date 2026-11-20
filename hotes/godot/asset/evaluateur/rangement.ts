/**
 * LES RIGIDES RANGÉS D'UNE TENUE ÉVALUÉE (#4351) : le jeu range un objet sur l'emplacement de la base ou la case d'une
 * pièce (`MontageDeComposition._ranger`, `hotes/godot/pont/CONTRAT.md`, « Atelier 3D »), et lui seul sait où. L'appelant
 * de `evaluer` lui demande la transformation de chaque mesh rangé à chaque instant mesuré (`EntreeDEvaluation.ranger`,
 * `posesDesRanges.mjs`) ; ici, le nœud glTF de ce mesh quitte l'os de sa prise pour cette transformation, et y revient
 * aux instants où le jeu le montre tenu.
 */
import { Matrix4, type Mesh, type Object3D } from 'three';
import type { SceneChargee } from './chargement.ts';
import type { PoseDuGabarit } from '../gabarit.ts';

/** Un instant où le jeu pose la tenue : le gabarit et les morphes de `composer`, le clip (vide au repos) et son instant. */
export interface InstantDeRangement {
  readonly gabarit?: PoseDuGabarit;
  readonly morphes: Readonly<Record<string, number>>;
  readonly clip: string;
  readonly t: number;
}

/** Les meshes rangés d'un élément : par nom de nœud glTF, sa transformation dans le repère de la base à chaque instant
 *  demandé, en 16 nombres colonne par colonne, `null` quand le jeu ne le montre pas rangé ; `offrants`, les rangs, parmi
 *  les éléments, de l'élément qui offre son emplacement, aucun si la base l'offre. */
interface ElementRange {
  readonly meshes: Readonly<Record<string, readonly (readonly number[] | null)[]>>;
  readonly offrants: readonly number[];
}

/** Les poses des éléments d'une évaluation aux `instants`, par élément dans son ordre, `null` sans mesh rangé. */
export type Rangeur = (instants: readonly InstantDeRangement[]) => Promise<readonly (ElementRange | null)[]>;

/** Un nœud rangé : ses meshes, l'élément qui les porte et ceux qui offrent son emplacement. */
interface NoeudRange {
  readonly meshes: readonly Mesh[];
  readonly offrants: readonly number[];
}

/** Les nœuds des `elements` montés sur `base` que `poses` range. `poser(k)` met chacun à sa transformation de l'instant
 *  de rang k, ou le rend à l'os de sa prise si le jeu ne l'y montre pas rangé ; `ranges()` rend ceux que le dernier
 *  `poser` a rangés. Un nom de `poses` qu'aucun nœud de son élément ne porte est refusé. */
export function rangerLesRigides(base: SceneChargee, elements: readonly SceneChargee[], poses: readonly (ElementRange | null)[]) {
  const noeuds = elements.flatMap((element, k) => Object.entries(poses[k]?.meshes ?? {}).map(([nom, matrices]) => {
    const origines = [...element.origines].filter(([, o]) => o.noeud === nom);
    if (!origines.length) throw new Error(`évaluation : mesh rangé « ${nom} » absent de l’élément ${k + 1}`);
    const objet: Object3D = origines[0][1].objet;
    return { objet, matrices, tenu: { parent: objet.parent as Object3D, matrice: objet.matrix.clone() }, meshes: origines.map(([m]) => m), offrants: poses[k]?.offrants ?? [] };
  }));
  const versLaBase = new Matrix4();
  const locale = new Matrix4();
  let ranges: NoeudRange[] = [];
  return {
    poser(instant: number): void {
      base.scene.updateMatrixWorld(true);
      versLaBase.copy(base.scene.matrixWorld).invert();
      ranges = noeuds.filter(({ objet, matrices, tenu }) => {
        const pose = matrices[instant];
        (pose ? base.scene : tenu.parent).add(objet);
        (pose ? locale.fromArray(pose).premultiply(versLaBase) : locale.copy(tenu.matrice)).decompose(objet.position, objet.quaternion, objet.scale);
        return pose !== null;
      });
      base.scene.updateMatrixWorld(true);
    },
    ranges: (): readonly NoeudRange[] => ranges,
  };
}
