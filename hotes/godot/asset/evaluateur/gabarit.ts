/**
 * LE GABARIT D'UNE BASE (#2972) : les facteurs `sl`, `legs`, `arms`, `head` et `st` appliqués à la pose de repos d'une
 * scène fraîchement chargée (`chargerScene`), selon la table `gabarit` du manifeste de base, et les shape keys de
 * silhouette. L'axe d'un os est son +Y local, convention des os glTF exportés de Blender.
 */
import type { Bone, Mesh, Object3D } from 'three';
import type { TableDeGabarit } from '../manifesteDeBase.ts';

export interface Facteurs {
  readonly sl: number;
  readonly legs: number;
  readonly arms: number;
  readonly head: number;
  readonly st: number;
}

export const FACTEURS_NEUTRES: Facteurs = Object.freeze({ sl: 1, legs: 1, arms: 1, head: 1, st: 1 });

export const CARRURE_MOINS = 'carrure_moins';
export const CARRURE_PLUS = 'carrure_plus';

const os = (scene: Object3D, nom: string): Bone => {
  const b = scene.getObjectByName(nom);
  if (!(b as Bone | undefined)?.isBone) throw new Error(`gabarit : ${nom} n’est pas un os de la scène`);
  return b as Bone;
};

const borne = (x: number): number => Math.min(1, Math.max(0, x));

/** Pose les shape keys `poids` (silhouettes `feminin`, `corpulence`… ou carrure, par nom) sur chaque mesh de `scene` qui les porte. */
export function poserSilhouettes(scene: Object3D, poids: Readonly<Record<string, number>>): void {
  scene.traverse((n) => {
    const m = n as Mesh;
    if (!m.isMesh || !m.morphTargetDictionary || !m.morphTargetInfluences) return;
    for (const [nom, p] of Object.entries(poids)) {
      const i = m.morphTargetDictionary[nom];
      if (i !== undefined) m.morphTargetInfluences[i] = p;
    }
  });
}

/** Les poids des shape keys de carrure pour `st` : `carrure_moins` sur [min ; 1], `carrure_plus` sur [1 ; max], jamais les deux. */
export const poidsDeCarrure = (st: number, bornes: TableDeGabarit['st']): Record<string, number> => ({
  [CARRURE_MOINS]: st < 1 ? borne((1 - st) / (1 - bornes.min)) : 0,
  [CARRURE_PLUS]: st > 1 ? borne((st - 1) / (bornes.max - 1)) : 0,
});

/** Applique `facteurs` à la pose de repos de `scene` selon `table`. */
export function appliquerGabarit(scene: Object3D, facteurs: Facteurs, table: TableDeGabarit): void {
  os(scene, table.racine).scale.multiplyScalar(facteurs.sl);
  for (const cle of ['legs', 'arms', 'head'] as const) {
    for (const nom of table[cle]) {
      for (const enfant of os(scene, nom).children) if ((enfant as Bone).isBone) enfant.position.y *= facteurs[cle];
    }
  }
  poserSilhouettes(scene, poidsDeCarrure(facteurs.st, table.st));
  scene.updateMatrixWorld(true);
}
